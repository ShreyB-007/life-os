import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { createPortal } from 'react-dom'

const NODE_COUNT = 28
const CONNECTION_DIST = 150
const PULSE_DURATION = 600

function makeNodes(w, h) {
  return Array.from({ length: NODE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: 3.5,
  }))
}

const NeuralConstellation = forwardRef(function NeuralConstellation({ allDone }, ref) {
  const canvasRef = useRef(null)
  const stateRef = useRef({
    nodes: [],
    cursor: null,
    isDark: true,
    pulses: [],
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

    function onMouseMove(e) {
      state.cursor = { x: e.clientX, y: e.clientY }
    }
    function onMouseLeave() {
      state.cursor = null
    }
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

      // Compute per-node glow intensity from active pulses
      const nodeGlow = new Float32Array(nodes.length)

      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pulse = pulses[pi]
        const elapsed = now - pulse.startMs
        if (elapsed > PULSE_DURATION) { pulses.splice(pi, 1); continue }

        // Lazily compute wave neighbors on first frame of each pulse
        if (!pulse.wave1) {
          const origin = nodes[pulse.originIdx]
          pulse.wave1 = []
          nodes.forEach((n, i) => {
            if (i === pulse.originIdx) return
            if (Math.hypot(n.x - origin.x, n.y - origin.y) < CONNECTION_DIST) {
              pulse.wave1.push(i)
            }
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

        // Origin: 0–200ms
        if (elapsed < 200) {
          nodeGlow[pulse.originIdx] = Math.max(
            nodeGlow[pulse.originIdx],
            Math.sin((elapsed / 200) * Math.PI),
          )
        }
        // Wave 1: 150–400ms
        if (elapsed >= 150 && elapsed < 400) {
          const t = (elapsed - 150) / 250
          const g = Math.sin(Math.min(t, 1) * Math.PI)
          pulse.wave1.forEach(i => { nodeGlow[i] = Math.max(nodeGlow[i], g) })
        }
        // Wave 2: 300–600ms, 70% intensity
        if (elapsed >= 300 && elapsed < 600) {
          const t = (elapsed - 300) / 300
          const g = Math.sin(Math.min(t, 1) * Math.PI) * 0.7
          pulse.wave2.forEach(i => { nodeGlow[i] = Math.max(nodeGlow[i], g) })
        }
      }

      // Update node positions
      nodes.forEach(n => {
        // Gentle magnetic pull toward cursor
        if (cursor) {
          const dx = cursor.x - n.x
          const dy = cursor.y - n.y
          const dist = Math.hypot(dx, dy)
          if (dist > 0 && dist < CONNECTION_DIST) {
            const strength = (1 - dist / CONNECTION_DIST) * 0.025
            n.vx += (dx / dist) * strength
            n.vy += (dy / dist) * strength
          }
        }

        // Damping + speed cap
        n.vx *= 0.99
        n.vy *= 0.99
        const speed = Math.hypot(n.vx, n.vy)
        if (speed > 0.8) {
          n.vx = (n.vx / speed) * 0.8
          n.vy = (n.vy / speed) * 0.8
        }

        n.x += n.vx
        n.y += n.vy

        // Bounce off edges
        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx) }
        if (n.x > w)  { n.x = w;  n.vx = -Math.abs(n.vx) }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy) }
        if (n.y > h)  { n.y = h;  n.vy = -Math.abs(n.vy) }
      })

      // Draw
      ctx.clearRect(0, 0, w, h)
      const nodeRGB = isDark ? '99,102,241' : '90,80,160'
      const lineRGB = isDark ? '99,102,241' : '221,221,240'

      // Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist >= CONNECTION_DIST) continue
          const proximity = 1 - dist / CONNECTION_DIST
          const baseOp = proximity * (isDark ? 0.08 : 0.12)
          const glowBoost = Math.max(nodeGlow[i], nodeGlow[j]) * 0.4
          const opacity = Math.min(baseOp + glowBoost, 0.55)
          ctx.strokeStyle = `rgba(${lineRGB},${opacity.toFixed(3)})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      // Nodes
      nodes.forEach((n, i) => {
        const glow = nodeGlow[i]
        const baseOpacity = isDark ? 0.45 : 0.55
        const opacity = baseOpacity + glow * 0.55
        const radius = n.radius + glow * 3.5

        ctx.save()
        if (glow > 0.05) {
          ctx.shadowBlur = 8 + glow * 14
          ctx.shadowColor = `rgba(${nodeRGB},${(glow * 0.9).toFixed(3)})`
        }
        ctx.fillStyle = `rgba(${nodeRGB},${opacity.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
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

  // allDone celebration: 3 staggered pulses
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      stateRef.current.prevAllDone = allDone
      return
    }
    const state = stateRef.current
    if (allDone && !state.prevAllDone && state.nodes.length > 0) {
      const indices = []
      while (indices.length < 3) {
        const r = Math.floor(Math.random() * state.nodes.length)
        if (!indices.includes(r)) indices.push(r)
      }
      indices.forEach((idx, i) => {
        setTimeout(() => {
          state.pulses.push({ originIdx: idx, startMs: performance.now() })
        }, i * 150)
      })
    }
    state.prevAllDone = allDone
  }, [allDone])

  // Portal to document.body so the canvas is in the root stacking context (z-index 0),
  // behind the cursor spotlight (z-index 1) and all content (z-index 2).
  return createPortal(
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />,
    document.body,
  )
})

export default NeuralConstellation
