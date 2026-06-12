import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { createPortal } from 'react-dom'

const NODE_COUNT = 28
const CONNECTION_DIST = 150
const CURSOR_PULL_DIST = 220
const CURSOR_PULL_STRENGTH = 0.16     // 3× stronger than before
const CURSOR_GLOW_DIST = 90
const PULSE_DURATION = 800
const GLOW_DECAY = 0.96
const CELEBRATION_DURATION = 3000
const RING_DURATION = 1500
const BREATHE_SPEED = 2600            // ms per full breathe cycle

// Blue-white stellar nodes (Sirius / blue-giant type) + cool connections
const DARK_THEME = {
  nodeCenter: '210,235,255',   // blue-white stellar core
  nodeInner:  '130,180,255',   // steel blue corona
  nodeOuter:  '80,120,210',    // deep blue outer atmosphere
  lineRGB:    '110,120,240',   // cool blue-indigo connections
  lineBaseMax: 0.08,
  glowBase:    22,             // slightly dimmer than before (was 26)
  glowVary:    9,              // breathe variation (was 11)
  coreBase:    3.2,            // core radius (was 3.8)
  coreVary:    0.8,
  celebRingRGB: '175,210,255', // blue-white ring on allDone
  pullStrength: 0.16,          // cursor pull force (dark mode unchanged)
}

// Soft white/lavender nodes — floating in periwinkle space
const LIGHT_THEME = {
  nodeCenter: '255,255,255',   // pure white
  nodeInner:  '195,200,255',   // soft lavender
  nodeOuter:  '155,165,245',   // periwinkle
  lineRGB:    '120,130,225',   // muted blue
  lineBaseMax: 0.09,
  glowBase:    24,
  glowVary:    9,
  coreBase:    3.4,
  coreVary:    0.7,
  celebRingRGB: '195,200,255', // lavender ring on allDone
  pullStrength: 0.09,          // light mode: ~44% gentler (was 0.16)
}

function makeNodes(w, h) {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.28,
    vy: (Math.random() - 0.5) * 0.28,
    breathePhase: Math.random() * Math.PI * 2, // staggered so they never all pulse together
    persistGlow: 0,
  }))
}

// 3-layer radial gradient node: outer atmospheric glow → inner halo → bright core
function drawNode(ctx, x, y, glow, breathe, theme) {
  const { nodeCenter, nodeInner, nodeOuter, glowBase, glowVary, coreBase, coreVary } = theme

  // breathe ∈ [0,1], 0.5 neutral
  const glowR = glowBase + breathe * glowVary + glow * 18
  const coreR = coreBase + breathe * coreVary + glow * 3.5

  // Layer 1 — wide atmospheric outer glow (the "field" around the neuron body)
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR)
  outerGrad.addColorStop(0,    `rgba(${nodeInner},${(0.14 + glow * 0.20).toFixed(3)})`)
  outerGrad.addColorStop(0.40, `rgba(${nodeOuter},${(0.06 + glow * 0.10).toFixed(3)})`)
  outerGrad.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = outerGrad
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, Math.PI * 2)
  ctx.fill()

  // Layer 2 — inner bright halo
  const haloR = coreR * 3.8
  const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, haloR)
  haloGrad.addColorStop(0,    `rgba(${nodeCenter},${(0.90 + glow * 0.10).toFixed(3)})`)
  haloGrad.addColorStop(0.45, `rgba(${nodeInner},${(0.55 + glow * 0.30).toFixed(3)})`)
  haloGrad.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = haloGrad
  ctx.beginPath()
  ctx.arc(x, y, haloR, 0, Math.PI * 2)
  ctx.fill()

  // Layer 3 — sharp bright core
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR)
  coreGrad.addColorStop(0,    'rgba(255,255,255,0.98)')
  coreGrad.addColorStop(0.50, `rgba(${nodeCenter},0.92)`)
  coreGrad.addColorStop(1,    `rgba(${nodeInner},0)`)
  ctx.fillStyle = coreGrad
  ctx.beginPath()
  ctx.arc(x, y, coreR, 0, Math.PI * 2)
  ctx.fill()
}

const NeuralConstellation = forwardRef(function NeuralConstellation({ allDone }, ref) {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    nodes: [],
    cursor: null,
    isDark: true,
    pulses: [],
    celebrationStart: null,  // when set: all nodes glow simultaneously
    ringStart: null,          // when set: expanding ring from screen center
    prevAllDone: false,
    rafId: null,
    paused: false,
  })
  const isFirstRender = useRef(true)

  useImperativeHandle(ref, () => ({
    triggerPulse(cardEl) {
      if (!cardEl) return
      const rect = cardEl.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const { nodes, pulses } = stateRef.current
      let nearestIdx = 0
      let nearestDist = Infinity
      nodes.forEach((n, i) => {
        const d = Math.hypot(n.x - cx, n.y - cy)
        if (d < nearestDist) { nearestDist = d; nearestIdx = i }
      })
      pulses.push({ originIdx: nearestIdx, startMs: performance.now() })
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = stateRef.current

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      if (state.nodes.length === 0) {
        state.nodes = makeNodes(canvas.width, canvas.height)
      }
    }
    resize()

    function updateTheme() {
      state.isDark = document.documentElement.classList.contains('dark')
    }
    updateTheme()
    const mo = new MutationObserver(updateTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    function onMouseMove(e) { state.cursor = { x: e.clientX, y: e.clientY } }
    function onMouseLeave() { state.cursor = null }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('resize', resize)

    function onVisibility() {
      state.paused = document.hidden
      if (!state.paused && !state.rafId) loop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    function loop() {
      if (state.paused) { state.rafId = null; return }
      state.rafId = requestAnimationFrame(loop)

      const { nodes, cursor, isDark, pulses } = state
      const w = canvas.width
      const h = canvas.height
      const now = performance.now()
      const theme = isDark ? DARK_THEME : LIGHT_THEME

      // ── Compute pulse glow ────────────────────────────────
      const pulseGlow = new Float32Array(nodes.length)

      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pulse = pulses[pi]
        const elapsed = now - pulse.startMs
        if (elapsed > PULSE_DURATION) { pulses.splice(pi, 1); continue }

        if (!pulse.wave1) {
          const origin = nodes[pulse.originIdx]
          pulse.wave1 = []
          nodes.forEach((n, i) => {
            if (i === pulse.originIdx) return
            if (Math.hypot(n.x - origin.x, n.y - origin.y) < CONNECTION_DIST) pulse.wave1.push(i)
          })
          const wave1Set = new Set(pulse.wave1)
          const wave2Set = new Set()
          pulse.wave1.forEach(w1i => {
            const w1n = nodes[w1i]
            nodes.forEach((n, i) => {
              if (i === pulse.originIdx || wave1Set.has(i)) return
              if (Math.hypot(n.x - w1n.x, n.y - w1n.y) < CONNECTION_DIST) wave2Set.add(i)
            })
          })
          pulse.wave2 = [...wave2Set]
        }

        if (elapsed < 250) {
          const g = Math.sin((elapsed / 250) * Math.PI)
          pulseGlow[pulse.originIdx] = Math.max(pulseGlow[pulse.originIdx], g)
          nodes[pulse.originIdx].persistGlow = Math.max(nodes[pulse.originIdx].persistGlow, g * 0.8)
        }
        if (elapsed >= 180 && elapsed < 500) {
          const g = Math.sin(Math.min((elapsed - 180) / 320, 1) * Math.PI)
          pulse.wave1.forEach(i => { pulseGlow[i] = Math.max(pulseGlow[i], g) })
        }
        if (elapsed >= 380 && elapsed < PULSE_DURATION) {
          const g = Math.sin(Math.min((elapsed - 380) / (PULSE_DURATION - 380), 1) * Math.PI) * 0.7
          pulse.wave2.forEach(i => { pulseGlow[i] = Math.max(pulseGlow[i], g) })
        }
      }

      // ── Celebration glow ──────────────────────────────────
      // All nodes boost simultaneously; decays over CELEBRATION_DURATION
      let celebGlow = 0
      if (state.celebrationStart !== null) {
        const elapsed = now - state.celebrationStart
        if (elapsed < CELEBRATION_DURATION) {
          // Starts at full brightness, eases out slowly (^0.55 keeps it bright longer)
          celebGlow = Math.pow(1 - elapsed / CELEBRATION_DURATION, 0.55)
        } else {
          state.celebrationStart = null
        }
      }

      // ── Update physics ────────────────────────────────────
      nodes.forEach(n => {
        if (cursor) {
          const dx = cursor.x - n.x
          const dy = cursor.y - n.y
          const dist = Math.hypot(dx, dy)
          if (dist > 0 && dist < CURSOR_PULL_DIST) {
            const strength = (1 - dist / CURSOR_PULL_DIST) * theme.pullStrength
            n.vx += (dx / dist) * strength
            n.vy += (dy / dist) * strength
          }
        }

        n.vx *= 0.98
        n.vy *= 0.98
        const speed = Math.hypot(n.vx, n.vy)
        if (speed > 1.5) { n.vx = (n.vx / speed) * 1.5; n.vy = (n.vy / speed) * 1.5 }

        n.x += n.vx
        n.y += n.vy

        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx) }
        if (n.x > w)  { n.x = w;  n.vx = -Math.abs(n.vx) }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy) }
        if (n.y > h)  { n.y = h;  n.vy = -Math.abs(n.vy) }

        n.persistGlow *= GLOW_DECAY
      })

      // ── Final glow per node ───────────────────────────────
      const nodeGlow = new Float32Array(nodes.length)
      nodes.forEach((n, i) => {
        let g = Math.max(pulseGlow[i], n.persistGlow, celebGlow)
        if (cursor) {
          const dist = Math.hypot(cursor.x - n.x, cursor.y - n.y)
          if (dist < CURSOR_GLOW_DIST) g = Math.max(g, (1 - dist / CURSOR_GLOW_DIST) * 0.42)
        }
        nodeGlow[i] = g
      })

      // ── Draw ──────────────────────────────────────────────
      ctx.clearRect(0, 0, w, h)

      // Connections — organic quadratic bezier curves
      // Each pair (i,j) gets a deterministic bend bias so lines feel like tendrils
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist >= CONNECTION_DIST) continue

          const proximity = 1 - dist / CONNECTION_DIST
          const baseOp = proximity * theme.lineBaseMax
          // Active nodes lift connection opacity — makes the network feel responsive
          const glowBoost = Math.max(nodeGlow[i], nodeGlow[j]) * 0.5
          const opacity = Math.min(baseOp + glowBoost, 0.70)

          // Deterministic perpendicular bend — consistent per pair, organic feel
          const biasMag = ((i * 17 + j * 11) % 28 - 14) / 115
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const dx = b.x - a.x
          const dy = b.y - a.y
          // Control point displaced perpendicular to the midpoint
          const cpx = mx - dy * biasMag
          const cpy = my + dx * biasMag

          ctx.strokeStyle = `rgba(${theme.lineRGB},${opacity.toFixed(3)})`
          ctx.lineWidth = 0.75
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.quadraticCurveTo(cpx, cpy, b.x, b.y)
          ctx.stroke()
        }
      }

      // Nodes — 3-layer radial gradient (atmospheric glow → inner halo → core)
      nodes.forEach((n, i) => {
        // Per-node independent breathe: maps sin to [0,1]
        const breathe = (Math.sin(now / BREATHE_SPEED + n.breathePhase) + 1) / 2
        drawNode(ctx, n.x, n.y, nodeGlow[i], breathe, theme)
      })

      // Expanding ring — fires from screen center on allDone
      if (state.ringStart !== null) {
        const elapsed = now - state.ringStart
        if (elapsed < RING_DURATION) {
          const progress = elapsed / RING_DURATION
          // Ease out expansion: fast at start, slows toward edge
          const radius = Math.pow(progress, 0.65) * Math.max(w, h) * 0.88
          // Fade from opaque to transparent as it expands
          const opacity = Math.pow(1 - progress, 1.6)

          ctx.save()
          // Soft wide halo around the ring
          ctx.strokeStyle = `rgba(${theme.celebRingRGB},${(opacity * 0.18).toFixed(3)})`
          ctx.lineWidth = 24
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2)
          ctx.stroke()
          // Crisp leading edge
          ctx.strokeStyle = `rgba(${theme.celebRingRGB},${(opacity * 0.60).toFixed(3)})`
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        } else {
          state.ringStart = null
        }
      }
    }

    loop()

    return () => {
      if (state.rafId) cancelAnimationFrame(state.rafId)
      state.rafId = null
      mo.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // allDone: boost ALL nodes simultaneously + fire center ring
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      stateRef.current.prevAllDone = allDone
      return
    }
    const state = stateRef.current
    if (allDone && !state.prevAllDone && state.nodes.length > 0) {
      const now = performance.now()
      state.celebrationStart = now
      state.ringStart = now
    }
    state.prevAllDone = allDone
  }, [allDone])

  // Portal to document.body — canvas at z-index 2 in root stacking context,
  // above floating icons (1), behind cursor spotlight (3) and all content (4).
  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    />,
    document.body,
  )
})

export default NeuralConstellation
