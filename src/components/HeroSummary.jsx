import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodKPIs } from '../utils/periodUtils'

export default function HeroSummary() {
  const { derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const pk          = useMemo(() => derivePeriodKPIs(Y.monthly, activeMonths) ?? Y.kpis, [Y.monthly, Y.kpis, activeMonths])
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  const revGap    = (pk.totalRevenue - (pk.revFc1  ?? 0)).toFixed(1)
  const revGapFc2 = (pk.totalRevenue - (pk.revFc2  ?? 0)).toFixed(1)
  const yoy       = periodMode === 'year' ? Y.kpis.yoyGrowth : null  // YoY only meaningful in full-year mode

  return null
}

function Pill({ label, value, dir }) {
  const color = dir === 'up' ? 'text-[#7DDBA0]' : dir === 'down' ? 'text-[#FF7A7A]' : 'text-[#9AA4B5]'
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''
  return (
    <span className="bg-white/5 border border-white/10 px-3 py-2 rounded-[10px] text-[12.5px] text-[#E8ECF3] inline-flex items-center gap-2">
      <span>{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{arrow}{arrow ? ' ' : ''}{value}</span>
    </span>
  )
}
