import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MastersCountryReport() {
  const { countryId } = useParams()
  const [country, setCountry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCountry() {
      setLoading(true)
      const { data } = await supabase
        .from('countries')
        .select('*')
        .eq('id', countryId)
        .maybeSingle()
      setCountry(data ?? null)
      setLoading(false)
    }

    fetchCountry()
  }, [countryId])

  if (loading) {
    return <ReportShell title="Loading report" subtitle="Fetching country details." />
  }

  if (!country) {
    return <ReportShell title="Country not found" subtitle="Return to Masters and select another country." />
  }

  return (
    <ReportShell
      title={`${country.flag_emoji} ${country.name}`}
      subtitle={
        country.static_research
          ? 'Research in progress - full report coming soon'
          : "This country hasn't been researched yet. Return to Masters to start research."
      }
    />
  )
}

function ReportShell({ title, subtitle }) {
  return (
    <main className="max-w-[900px] mx-auto px-6 py-8">
      <div className="habit-card rounded-xl p-6">
        <Link to="/masters" className="action-pill-btn action-pill-indigo mb-6">
          <i className="ti ti-arrow-left" />
          Masters
        </Link>
        <h1 className="font-display text-3xl font-semibold text-os-fg">{title}</h1>
        <p className="mt-3 text-sm font-body text-os-muted">{subtitle}</p>
      </div>
    </main>
  )
}
