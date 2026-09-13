import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Goals from './pages/Goals'
import Masters from './pages/Masters'
import MastersCountryReport from './pages/MastersCountryReport'
import MastersUniversityReport from './pages/MastersUniversityReport'
import Digest from './pages/Digest'
import Review from './pages/Review'
import NotFound from './pages/NotFound'
import FloatingIcons from './components/FloatingIcons'

export default function App() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light'
  })

  useEffect(() => {
    const html = document.documentElement
    if (dark) {
      html.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  // Cursor spotlight — track mouse position into CSS custom properties
  useEffect(() => {
    function onMouseMove(e) {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  return (
    <div className="relative min-h-screen font-body text-zinc-900 dark:text-os-fg transition-colors duration-200">

      {/* Floating background icons (z=1) — behind constellation canvas (z=2) */}
      <FloatingIcons />

      {/* Cursor spotlight (z=3) — follows mouse, dark mode atmospheric */}
      <div
        className="fixed inset-0 pointer-events-none hidden dark:block"
        style={{
          zIndex: 3,
          background: 'radial-gradient(500px circle at var(--cursor-x, 50%) var(--cursor-y, 50%), rgba(99,102,241,0.07), transparent 40%)',
        }}
      />

      {/* All content (z=4) above all background layers */}
      <div className="relative" style={{ zIndex: 4 }}>
        <Navbar dark={dark} onToggleDark={() => setDark(d => !d)} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/masters" element={<Masters />} />
          <Route path="/masters/country/:countryId" element={<MastersCountryReport />} />
          <Route path="/masters/university/:universityId" element={<MastersUniversityReport />} />
          <Route path="/digest" element={<Digest />} />
          <Route path="/review" element={<Review />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}
