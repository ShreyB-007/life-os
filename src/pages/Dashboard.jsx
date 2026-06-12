import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { computeStreak, computeOverallStreak } from '../lib/streaks'
import TopBar from '../components/TopBar'
import AllDoneBanner from '../components/AllDoneBanner'
import GymCard from '../components/GymCard'
import JapaneseCard from '../components/JapaneseCard'
import DSACard from '../components/DSACard'
import GoalsSection from '../components/GoalsSection'
import BottomRow from '../components/BottomRow'

export default function Dashboard() {
  const [logs, setLogs] = useState({ gym: [], japanese: [], dsa: [] })
  const [todayLogs, setTodayLogs] = useState({ gym: null, japanese: null, dsa: null })
  const [goals, setGoals] = useState([])
  const initialized = useRef(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    const today = todayStr()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 400)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const [logsRes, goalsRes] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('*')
        .gte('log_date', cutoffStr)
        .order('log_date', { ascending: false }),
      supabase.from('goals').select('*').eq('status', 'active').order('sort_order'),
    ])

    if (logsRes.data) {
      const allLogs = logsRes.data
      const gymLogs = allLogs.filter(l => l.habit_key === 'gym')
      const japaneseLogs = allLogs.filter(l => l.habit_key === 'japanese')
      const dsaLogs = allLogs.filter(l => l.habit_key === 'dsa')

      setLogs({ gym: gymLogs, japanese: japaneseLogs, dsa: dsaLogs })
      setTodayLogs({
        gym: gymLogs.find(l => l.log_date === today) ?? null,
        japanese: japaneseLogs.find(l => l.log_date === today) ?? null,
        dsa: dsaLogs.find(l => l.log_date === today) ?? null,
      })
    }

    if (goalsRes.data) setGoals(goalsRes.data)
    initialized.current = true
  }

  // Called by each card after every log operation (optimistic).
  // Replaces today's entry in logs[] and updates todayLogs.
  function onLog(habitKey, logEntry) {
    const date = logEntry.log_date
    setLogs(prev => ({
      ...prev,
      [habitKey]: [logEntry, ...prev[habitKey].filter(l => l.log_date !== date)],
    }))
    setTodayLogs(prev => ({ ...prev, [habitKey]: logEntry }))
  }

  const gymStreak = computeStreak(logs.gym, [0])
  const japaneseStreak = computeStreak(logs.japanese, [])
  const dsaStreak = computeStreak(logs.dsa, [])
  const overallStreak = computeOverallStreak(logs.gym, logs.japanese, logs.dsa)

  // Derived — recomputes whenever todayLogs changes, handles un-logging correctly.
  const allDone =
    (todayLogs.gym?.done === true || todayLogs.gym?.is_rest_day === true) &&
    todayLogs.japanese?.done === true &&
    todayLogs.dsa?.done === true

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <TopBar overallStreak={overallStreak} gymStreak={gymStreak} />

      <AllDoneBanner visible={allDone} />

      <div className="mb-6">
        <p className="text-[11px] font-body font-semibold uppercase tracking-widest mb-3" style={{ color: '#4A4A60' }}>
          Today's check-ins
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GymCard
            streak={gymStreak}
            todayLog={todayLogs.gym}
            allLogs={logs.gym}
            onLog={onLog}
          />
          <JapaneseCard
            streak={japaneseStreak}
            todayLog={todayLogs.japanese}
            allLogs={logs.japanese}
            onLog={onLog}
          />
          <DSACard
            streak={dsaStreak}
            todayLog={todayLogs.dsa}
            onLog={onLog}
          />
        </div>
      </div>

      <GoalsSection goals={goals} />
      <BottomRow goals={goals} />
    </div>
  )
}
