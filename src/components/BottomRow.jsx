import { Link } from 'react-router-dom'
import { compareDateStrings } from '../lib/goals'

export default function BottomRow({ goals }) {
  const nextMilestoneGoal = goals
    ?.filter(g => g.target_date && g.status === 'active')
    .sort((a, b) => compareDateStrings(a.target_date, b.target_date))[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Link to="/digest" className="habit-card card-interactive rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-news text-base text-os-muted" />
          <span className="text-sm font-display font-semibold text-os-secondary">Today's digest</span>
        </div>
        <p className="text-xs font-body text-os-muted">Global, India, and AI/ML news — tap to open</p>
      </Link>

      {/* Next milestone card */}
      <div className="habit-card card-interactive rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-flag text-base text-os-muted" />
          <span className="text-sm font-display font-semibold text-os-secondary">Next milestone</span>
        </div>
        {nextMilestoneGoal ? (
          <>
            <div className="flex items-center gap-2">
              <i className={`ti ti-${nextMilestoneGoal.icon} text-sm`} style={{ color: nextMilestoneGoal.color }} />
              <span className="text-sm font-body text-os-secondary">{nextMilestoneGoal.name}</span>
              <span
                className="text-[11px] font-body font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: nextMilestoneGoal.color + '22', color: nextMilestoneGoal.color }}
              >
                {nextMilestoneGoal.label}
              </span>
            </div>
            <p className="text-[11px] font-body mt-1.5 text-os-muted">Tap Goals to update progress</p>
          </>
        ) : (
          <p className="text-xs font-body text-os-muted">No upcoming milestones</p>
        )}
      </div>
    </div>
  )
}
