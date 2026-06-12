import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Goals from './pages/Goals'
import Masters from './pages/Masters'
import Digest from './pages/Digest'
import Review from './pages/Review'

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

  return (
    <div className="min-h-screen font-body bg-gray-50 dark:bg-void-950 text-zinc-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar dark={dark} onToggleDark={() => setDark(d => !d)} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/masters" element={<Masters />} />
        <Route path="/digest" element={<Digest />} />
        <Route path="/review" element={<Review />} />
      </Routes>
    </div>
  )
}
