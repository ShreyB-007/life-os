import { useEffect, useMemo, useRef, useState } from 'react'
import { getGreeting, formatDate } from '../lib/date'
import { getLocalDate, getLocalDateString } from '../lib/dateUtils'
import { getStreakTier, getNextMilestone } from '../lib/streaks'

const TIER_CONFIG = {
  cold: {
    label: null,
    numberStyle: { color: 'var(--os-muted)' },
    flameFilter: 'none',
    flameColor: 'var(--os-muted)',
  },
  warm: {
    label: 'warm',
    numberClass: 'text-gradient-amber',
    flameFilter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))',
    flameColor: '#F59E0B',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeColor: '#F59E0B',
  },
  hot: {
    label: 'hot',
    numberClass: 'text-gradient-hot',
    flameFilter: 'drop-shadow(0 0 10px rgba(249,115,22,0.7))',
    flameColor: '#F97316',
    badgeBg: 'rgba(249,115,22,0.12)',
    badgeColor: '#F97316',
  },
  legendary: {
    label: 'legendary',
    numberClass: 'text-gradient-legendary',
    flameFilter: 'drop-shadow(0 0 12px rgba(139,92,246,0.8))',
    flameColor: '#8B5CF6',
    badgeBg: 'rgba(139,92,246,0.15)',
    badgeColor: '#A78BFA',
  },
}

export default function TopBar({ overallStreak, selectedDate, onSelectedDateChange }) {
  const tier = getStreakTier(overallStreak)
  const next = getNextMilestone(overallStreak)
  const cfg = TIER_CONFIG[tier]
  const now = new Date()

  return (
    <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
      {/* Left: greeting + date */}
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight text-os-fg tracking-tight">
          {getGreeting()}, Shrey
        </h1>
        <p className="text-sm font-body text-os-muted mt-1 tracking-wide">{formatDate(now)}</p>
      </div>

      <DateSelector selectedDate={selectedDate} onSelectedDateChange={onSelectedDateChange} />

      {/* Right: streak display */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          <div className="relative flex items-end gap-2">
            {tier === 'legendary' && (
              <span
                className="absolute inset-0 rounded-full animate-legendary-ring"
                style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)' }}
              />
            )}
            <span
              className={['font-display font-bold leading-none', cfg.numberClass || ''].join(' ')}
              style={{ fontSize: '52px', lineHeight: 1, ...(tier === 'cold' ? cfg.numberStyle : {}) }}
            >
              {overallStreak}
            </span>
            <i
              className={['ti ti-flame mb-1', tier === 'legendary' ? 'animate-float' : ''].join(' ')}
              style={{ fontSize: '28px', color: cfg.flameColor, filter: cfg.flameFilter }}
            />
          </div>

          {cfg.label && (
            <span
              className="self-start mt-2 text-[10px] font-body font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}
            >
              {cfg.label}
            </span>
          )}
        </div>

        <p className="text-[11px] font-body uppercase tracking-widest text-os-muted">
          day streak
        </p>

        {next && (
          <p className="text-[11px] font-body text-os-muted">
            {next.daysRemaining} more to {next.milestone}-day milestone
          </p>
        )}
      </div>
    </div>
  )
}

function DateSelector({ selectedDate, onSelectedDateChange }) {
  const today = getLocalDate()
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(parseDate(selectedDate)))
  const wrapperRef = useRef(null)
  const isToday = selectedDate === today

  useEffect(() => {
    setVisibleMonth(monthStart(parseDate(selectedDate)))
  }, [selectedDate])

  useEffect(() => {
    if (!open) return
    function handleOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function selectDate(dateStr) {
    if (dateStr > today) return
    onSelectedDateChange(dateStr)
    setOpen(false)
  }

  function shiftDay(delta) {
    const next = addDays(parseDate(selectedDate), delta)
    const nextStr = getLocalDateString(next)
    onSelectedDateChange(nextStr > today ? today : nextStr)
  }

  const nextMonthDisabled = monthKey(visibleMonth) >= monthKey(parseDate(today))
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth])

  return (
    <div ref={wrapperRef} className="relative self-center">
      <div className="dashboard-date-selector flex items-center gap-1 rounded-full px-1.5 py-1">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="h-7 w-7 rounded-full text-os-muted hover:text-os-fg transition-colors"
          style={{ background: 'transparent' }}
          title="Previous day"
        >
          <i className="ti ti-chevron-left text-sm" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="min-w-[86px] rounded-full px-3 py-1 text-xs font-body font-semibold text-os-secondary hover:text-os-fg transition-colors"
        >
          {isToday ? 'Today' : formatShortDate(selectedDate)}
        </button>
        <button
          type="button"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          className="h-7 w-7 rounded-full text-os-muted hover:text-os-fg transition-colors disabled:cursor-not-allowed disabled:opacity-35"
          title="Next day"
        >
          <i className="ti ti-chevron-right text-sm" />
        </button>
      </div>

      {open && (
        <div className="dashboard-date-popover absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-xl p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
              className="h-7 w-7 rounded-full text-os-muted hover:text-os-fg transition-colors"
              title="Previous month"
            >
              <i className="ti ti-chevron-left text-sm" />
            </button>
            <p className="font-display text-sm font-semibold text-os-fg">{formatMonth(visibleMonth)}</p>
            <button
              type="button"
              onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
              disabled={nextMonthDisabled}
              className="h-7 w-7 rounded-full text-os-muted hover:text-os-fg transition-colors disabled:cursor-not-allowed disabled:opacity-35"
              title="Next month"
            >
              <i className="ti ti-chevron-right text-sm" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-body uppercase tracking-wide text-os-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dateStr = getLocalDateString(day.date)
              const inMonth = day.date.getMonth() === visibleMonth.getMonth()
              const isFuture = dateStr > today
              const isSelected = dateStr === selectedDate
              const dayIsToday = dateStr === today
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => selectDate(dateStr)}
                  disabled={!inMonth || isFuture}
                  className="h-8 rounded-lg text-xs font-mono transition-colors disabled:cursor-not-allowed"
                  style={{
                    background: isSelected ? '#6366F1' : 'transparent',
                    border: dayIsToday && !isSelected ? '1px solid #6366F1' : '1px solid transparent',
                    color: isSelected
                      ? '#FFFFFF'
                      : isFuture || !inMonth
                        ? 'var(--os-muted)'
                        : 'var(--os-secondary)',
                    opacity: isFuture || !inMonth ? 0.38 : 1,
                  }}
                >
                  {day.date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`)
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthKey(date) {
  return date.getFullYear() * 12 + date.getMonth()
}

function addDays(date, delta) {
  const next = new Date(date)
  next.setDate(next.getDate() + delta)
  return next
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function buildMonthDays(month) {
  const start = monthStart(month)
  const gridStart = addDays(start, -start.getDay())
  return Array.from({ length: 42 }, (_, index) => ({ date: addDays(gridStart, index) }))
}

function formatShortDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatMonth(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}
