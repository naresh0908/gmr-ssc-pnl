import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodKPIs } from '../utils/periodUtils'

export default function KPISection() {
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

  // Always compare against the earliest available year (FY2024 base), not the immediately prior year.
  // This avoids FY2025 (a disrupted year) acting as the baseline when viewing FY2026.
  const baseYear  = derived.years[0]
  const prevYear  = year !== baseYear ? baseYear : null
  const prevY     = prevYear ? derived.byYear[prevYear] : null
  const prevAvail = useMemo(
    () => (prevYear ? getAvailMonths(rawRevenue, prevYear) : []),
    [rawRevenue, prevYear]
  )
  const prevActive = useMemo(
    () => (prevYear ? getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, prevAvail) : []),
    [periodMode, selectedQ, selectedPeriodMonth, prevAvail, prevYear]
  )
  const prevPk = useMemo(
    () => (prevY ? derivePeriodKPIs(prevY.monthly, prevActive) ?? prevY.kpis : null),
    [prevY, prevActive]
  )

  const deltaLabel = periodMode === 'year' ? `FY${prevYear}` : `${periodLabel.replace(` · FY ${year}`, '')} FY${prevYear}`

  const cards = [
    {
      label: 'Total Revenue', value: pk.totalRevenue, unit: 'Cr',
      delta: prevPk ? `${pk.totalRevenue >= prevPk.totalRevenue ? '▲' : '▼'} ₹${Math.abs(pk.totalRevenue - prevPk.totalRevenue).toFixed(1)} Cr vs ${deltaLabel}` : '—',
      sub: `FC1: ₹${(pk.revFc1 ?? 0).toFixed(1)} · FC2: ₹${(pk.revFc2 ?? 0).toFixed(1)} Cr`,
      up: prevPk ? pk.totalRevenue >= prevPk.totalRevenue : true,
    },
    {
      label: 'Total Cost', value: pk.totalCost, unit: 'Cr',
      delta: prevPk ? `${pk.totalCost > prevPk.totalCost ? '▲' : '▼'} ₹${Math.abs(pk.totalCost - prevPk.totalCost).toFixed(1)} Cr vs ${deltaLabel}` : '—',
      sub: `FC1: ₹${(pk.costFc1 ?? 0).toFixed(1)} · FC2: ₹${(pk.costFc2 ?? 0).toFixed(1)} Cr`,
      up: prevPk ? pk.totalCost <= prevPk.totalCost : false,
    },
    {
      label: 'EBIT',
      value: pk.ebit ?? Y.kpis.ebit ?? null,
      unit: 'Cr',
      delta: prevPk
        ? `${(pk.ebit ?? 0) >= (prevPk.ebit ?? 0) ? '▲' : '▼'} ₹${Math.abs((pk.ebit ?? 0) - (prevPk.ebit ?? 0)).toFixed(1)} Cr vs ${deltaLabel}`
        : '—',
      sub: `FC1: ₹${(pk.ebitFc1 ?? 0).toFixed(1)} · FC2: ₹${(pk.ebitFc2 ?? 0).toFixed(1)} Cr · ${(pk.ebitMargin ?? 0).toFixed(1)}% margin`,
      up: prevPk ? (pk.ebit ?? 0) >= (prevPk.ebit ?? 0) : (pk.ebit ?? 0) >= 0,
    },
    {
      label: 'Net Profit', value: pk.netProfit, unit: 'Cr',
      delta: prevPk ? `${pk.netProfit >= prevPk.netProfit ? '▲' : '▼'} ₹${Math.abs(pk.netProfit - prevPk.netProfit).toFixed(1)} Cr vs ${deltaLabel}` : '—',
      sub: `FC1: ₹${(pk.netProfitFc1 ?? 0).toFixed(1)} · FC2: ₹${(pk.netProfitFc2 ?? 0).toFixed(1)} Cr`,
      up: prevPk ? pk.netProfit >= prevPk.netProfit : true,
    },
    {
      label: 'Profit Margin', value: pk.margin, unit: '%',
      delta: prevPk ? `${pk.margin >= prevPk.margin ? '▲' : '▼'} ${Math.abs(pk.margin - prevPk.margin).toFixed(1)} pts vs ${deltaLabel}` : '—',
      sub: 'Cost vs revenue trajectory',
      up: prevPk ? pk.margin >= prevPk.margin : true,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 * i }}
          className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4 px-5"
        >
          <div className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] font-semibold">{c.label}</div>
          <div className="font-display font-medium text-[30px] tracking-[-.5px] mt-2">
            {c.value != null ? c.value.toFixed(1) : '—'}
            <span className="font-mono text-[13px] text-[var(--muted)] font-medium ml-1">{c.value != null ? c.unit : ''}</span>
          </div>
          <div className={`text-[12px] mt-1.5 font-mono font-medium ${c.up == null ? 'text-[var(--muted)]' : c.up ? 'text-brand-green' : 'text-brand-red'}`}>
            {c.delta}
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-1">{c.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}
