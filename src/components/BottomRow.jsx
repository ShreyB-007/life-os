export default function BottomRow({ goals }) {
  const nextMilestoneGoal = goals
    ?.filter(g => g.target_date && g.status === 'active')
    .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* AI Digest card */}
      <div className="card-interactive rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1C1C2E' }}>
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-news text-base" style={{ color: '#4A4A60' }} />
          <span className="text-sm font-display font-semibold" style={{ color: '#8888A0' }}>Today's AI digest</span>
        </div>
        <p className="text-xs font-body" style={{ color: '#4A4A60' }}>AI Digest coming in Phase 3</p>
      </div>

      {/* Next milestone card */}
      <div className="card-interactive rounded-xl p-4" style={{ background: '#0F0F1A', border: '1px solid #1C1C2E' }}>
        <div className="flex items-center gap-2 mb-2">
          <i className="ti ti-flag text-base" style={{ color: '#4A4A60' }} />
          <span className="text-sm font-display font-semibold" style={{ color: '#8888A0' }}>Next milestone</span>
        </div>
        {nextMilestoneGoal ? (
          <>
            <div className="flex items-center gap-2">
              <i className={`ti ti-${nextMilestoneGoal.icon} text-sm`} style={{ color: nextMilestoneGoal.color }} />
              <span className="text-sm font-body" style={{ color: '#8888A0' }}>{nextMilestoneGoal.name}</span>
              <span
                className="text-[11px] font-body font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: nextMilestoneGoal.color + '22', color: nextMilestoneGoal.color }}
              >
                {nextMilestoneGoal.label}
              </span>
            </div>
            <p className="text-[11px] font-body mt-1.5" style={{ color: '#4A4A60' }}>Tap Goals to update progress</p>
          </>
        ) : (
          <p className="text-xs font-body" style={{ color: '#4A4A60' }}>No upcoming milestones</p>
        )}
      </div>
    </div>
  )
}
