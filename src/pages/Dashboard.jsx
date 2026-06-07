import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/date'
import { computeStreak } from '../lib/streaks'
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
  const [habitsDone, setHabitsDone] = useState({ gym: false, japanese: false, dsa: false })
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

      const todayGym = gymLogs.find(l => l.log_date === today) || null
      const todayJapanese = japaneseLogs.find(l => l.log_date === today) || null
      const todayDsa = dsaLogs.find(l => l.log_date === today) || null
      setTodayLogs({ gym: todayGym, japanese: todayJapanese, dsa: todayDsa })

      setHabitsDone({
        gym: todayGym?.done === true || todayGym?.is_rest_day === true,
        japanese: todayJapanese?.done === true,
        dsa: todayDsa?.done === true,
      })
    }

    if (goalsRes.data) {
      setGoals(goalsRes.data)
    }

    initialized.current = true
  }

  function markDone(habit) {
    setHabitsDone(prev => ({ ...prev, [habit]: true }))
  }

  const gymStreak = computeStreak(logs.gym, [0])
  const japaneseStreak = computeStreak(logs.japanese, [])
  const dsaStreak = computeStreak(logs.dsa, [])

  const allDone = habitsDone.gym && habitsDone.japanese && habitsDone.dsa

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <TopBar gymStreak={gymStreak} />

      <AllDoneBanner visible={allDone} />

      {/* Habit cards */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-3">
          Today's check-ins
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GymCard
            streak={gymStreak}
            todayLog={todayLogs.gym}
            onDone={() => markDone('gym')}
          />
          <JapaneseCard
            streak={japaneseStreak}
            todayLog={todayLogs.japanese}
            allLogs={logs.japanese}
            onDone={() => markDone('japanese')}
          />
          <DSACard
            streak={dsaStreak}
            todayLog={todayLogs.dsa}
            onDone={() => markDone('dsa')}
          />
        </div>
      </div>

      <GoalsSection goals={goals} />

      <BottomRow goals={goals} />
    </div>
  )
}
