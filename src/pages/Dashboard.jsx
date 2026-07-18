import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getLocalDate } from '../lib/dateUtils'
import { computeStreak, computeOverallStreak } from '../lib/streaks'
import TopBar from '../components/TopBar'
import AllDoneBanner from '../components/AllDoneBanner'
import GymCard from '../components/GymCard'
import JapaneseCard from '../components/JapaneseCard'
import DSACard from '../components/DSACard'
import GoalsSection from '../components/GoalsSection'
import BottomRow from '../components/BottomRow'
import NeuralConstellation from '../components/NeuralConstellation'

export default function Dashboard() {
  const [logs, setLogs] = useState({ gym: [], japanese: [], dsa: [] })
  const [todayLogs, setTodayLogs] = useState({ gym: null, japanese: null, dsa: null })
  const [selectedDate, setSelectedDate] = useState(getLocalDate())
  const [goals, setGoals] = useState([])
  const constellationRef = useRef(null)
  const gymCardRef = useRef(null)
  const japaneseCardRef = useRef(null)
  const dsaCardRef = useRef(null)
  // Bumped by every todayLogs write — both local optimistic writes (onLog) and each
  // new fetch (fetchAll's initial load, loadLogsForDate's date-change load). A fetch
  // that resolves after being superseded (by a click that landed while it was in
  // flight, or by a newer fetch from rapid date navigation) sees its captured version
  // no longer match and discards its result instead of clobbering fresher state.
  const todayLogsVersionRef = useRef(0)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    const today = getLocalDate()
    if (selectedDate > today) {
      setSelectedDate(today)
      return
    }
    loadLogsForDate(selectedDate)
  }, [selectedDate])

  async function fetchAll() {
    const version = ++todayLogsVersionRef.current
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 400)
    const y = cutoff.getFullYear(), mo = String(cutoff.getMonth()+1).padStart(2,'0'), d = String(cutoff.getDate()).padStart(2,'0')
    const cutoffStr = `${y}-${mo}-${d}`

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
      if (todayLogsVersionRef.current === version) {
        setTodayLogs({
          gym: gymLogs.find(l => l.log_date === selectedDate) ?? null,
          japanese: japaneseLogs.find(l => l.log_date === selectedDate) ?? null,
          dsa: dsaLogs.find(l => l.log_date === selectedDate) ?? null,
        })
      }
    }

    if (goalsRes.data) setGoals(goalsRes.data)
  }

  async function loadLogsForDate(date) {
    const version = ++todayLogsVersionRef.current
    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .in('habit_key', ['gym', 'japanese', 'dsa'])
      .eq('log_date', date)

    if (todayLogsVersionRef.current !== version) return

    const newTodayLogs = { gym: null, japanese: null, dsa: null }
    data?.forEach(log => {
      newTodayLogs[log.habit_key] = log
    })
    setTodayLogs(newTodayLogs)
  }

  // Called by each card after every log operation (optimistic).
  // Replaces the selected date's entry in logs[] and updates todayLogs.
  function onLog(habitKey, logEntry) {
    const date = logEntry.log_date
    const cardRefs = { gym: gymCardRef, japanese: japaneseCardRef, dsa: dsaCardRef }

    if (date === selectedDate) {
      todayLogsVersionRef.current += 1
      setTodayLogs(prev => {
        const wasAlreadyDone =
          prev[habitKey]?.done === true || prev[habitKey]?.is_rest_day === true
        const nowDone = logEntry.done === true || logEntry.is_rest_day === true
        if (nowDone && !wasAlreadyDone) {
          // Pulse fires after state update so the card el is correct
          setTimeout(() => {
            constellationRef.current?.triggerPulse(cardRefs[habitKey]?.current)
          }, 0)
        }
        return { ...prev, [habitKey]: logEntry }
      })
    }

    setLogs(prev => {
      const existing = prev[habitKey] ?? []
      return {
        ...prev,
        [habitKey]: sortLogsDesc([logEntry, ...existing.filter(l => l.log_date !== date)])
      }
    })
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
  const isViewingToday = selectedDate === getLocalDate()

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <NeuralConstellation ref={constellationRef} allDone={allDone} />
      <TopBar
        overallStreak={overallStreak}
        selectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
      />

      {!isViewingToday && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2 text-xs font-body"
          style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.28)',
            color: '#F59E0B',
          }}
        >
          <span>Viewing {formatSelectedDate(selectedDate)} - changes will be saved for that date</span>
          <button
            onClick={() => setSelectedDate(getLocalDate())}
            className="font-semibold hover:opacity-80 transition-opacity"
            type="button"
          >
            x Back to today
          </button>
        </div>
      )}

      <AllDoneBanner visible={allDone} selectedDate={selectedDate} />

      <div className="mb-6">
        <p className="text-[11px] font-body font-semibold uppercase tracking-widest mb-3" style={{ color: '#4A4A60' }}>
          {isViewingToday ? "Today's check-ins" : `${formatSelectedDate(selectedDate)} check-ins`}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GymCard
            ref={gymCardRef}
            streak={gymStreak}
            todayLog={todayLogs.gym}
            allLogs={logs.gym}
            selectedDate={selectedDate}
            onLog={onLog}
          />
          <JapaneseCard
            ref={japaneseCardRef}
            streak={japaneseStreak}
            todayLog={todayLogs.japanese}
            allLogs={logs.japanese}
            selectedDate={selectedDate}
            onLog={onLog}
          />
          <DSACard
            ref={dsaCardRef}
            streak={dsaStreak}
            todayLog={todayLogs.dsa}
            allLogs={logs.dsa}
            selectedDate={selectedDate}
            onLog={onLog}
          />
        </div>
      </div>

      <GoalsSection goals={goals} />
      <BottomRow goals={goals} />
    </div>
  )
}

function formatSelectedDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function sortLogsDesc(entries) {
  return [...entries].sort((a, b) => b.log_date.localeCompare(a.log_date))
}
