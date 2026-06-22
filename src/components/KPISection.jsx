import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodKPIs } from '../utils/periodUtils'

// Card accent palette — mirrors the reference image (blue / red / yellow / green).
const ACCENTS = {
  blue:   { bar: '#1F6FEB', gradient: 'linear-gradient(180deg, #FFFFFF 0%, #E3EDFA 100%)' },
  red:    { bar: '#E04F4F', gradient: 'linear-gradient(180deg, #FFFFFF 0%, #FAE3E3 100%)' },
  yellow: { bar: '#F1C232', gradient: 'linear-gradient(180deg, #FFFFFF 0%, #FAF1D7 100%)' },
  green:  { bar: '#2CA15D', gradient: 'linear-gradient(180deg, #FFFFFF 0%, #DCEEE3 100%)' },
}

export default function KPISection() {
  const { derived, year, fromMonth, toMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )
  const pk          = useMemo(() => derivePeriodKPIs(Y.monthly, activeMonths) ?? Y.kpis, [Y.monthly, Y.kpis, activeMonths])
  const periodLabel = getPeriodLabel(fromMonth, toMonth, year)

  const { prevPk: _prevPk, deltaLabel: _deltaLabel } = useMemo(() => {
    const prevYear = derived.years[derived.years.indexOf(year) - 1] ?? (year - 1)
    const prevY    = derived.byYear[prevYear]
    if (!prevY) {
      return { prevPk: null, deltaLabel: '' }
    }
    const prevAvail  = getAvailMonths(rawRevenue, prevYear)
    const prevActive = getActivePeriodMonths(fromMonth, toMonth, prevAvail)
    const prevPk     = derivePeriodKPIs(prevY.monthly, prevActive) ?? prevY.kpis
    const deltaLabel = `${prevYear}`
    return { prevPk, deltaLabel }
  }, [fromMonth, toMonth, derived, rawRevenue, year])

  const prevPk = _prevPk
  const deltaLabel = _deltaLabel

  const cards = [
    {
      label:   'Total Revenue',
      value:   pk.totalRevenue,
      unit:    'Cr',
      accent:  'blue',
      sub:     prevPk
        ? `${pk.totalRevenue >= prevPk.totalRevenue ? '▲' : '▼'} ₹${Math.abs(pk.totalRevenue - prevPk.totalRevenue).toFixed(1)} Cr vs ${deltaLabel}`
        : `FC1 ₹${(pk.revFc1 ?? 0).toFixed(1)} · FC2 ₹${(pk.revFc2 ?? 0).toFixed(1)} Cr`,
      up:      prevPk ? pk.totalRevenue >= prevPk.totalRevenue : null,
    },
    {
      label:   'Total Cost',
      value:   pk.totalCost,
      unit:    'Cr',
      accent:  'red',
      sub:     prevPk
        ? `${pk.totalCost > prevPk.totalCost ? '▲' : '▼'} ₹${Math.abs(pk.totalCost - prevPk.totalCost).toFixed(1)} Cr vs ${deltaLabel}`
        : 'Cumulative cost-to-date',
      up:      prevPk ? pk.totalCost <= prevPk.totalCost : null,
    },
    {
      label:   'Total Margin',
      value:   pk.ebit ?? Y.kpis.ebit ?? null,
      unit:    'Cr',
      accent:  'yellow',
      sub:     prevPk
        ? `${(pk.ebit ?? 0) >= (prevPk.ebit ?? 0) ? '▲' : '▼'} ₹${Math.abs((pk.ebit ?? 0) - (prevPk.ebit ?? 0)).toFixed(1)} Cr vs ${deltaLabel}`
        : 'Revenue − Cost',
      up:      prevPk ? (pk.ebit ?? 0) >= (prevPk.ebit ?? 0) : null,
    },
    {
      label:   'Margin %',
      value:   pk.ebitMargin ?? null,
      unit:    '%',
      accent:  'green',
      sub:     prevPk
        ? `${(pk.ebitMargin ?? 0) >= (prevPk.ebitMargin ?? 0) ? '▲' : '▼'} ${Math.abs((pk.ebitMargin ?? 0) - (prevPk.ebitMargin ?? 0)).toFixed(1)} pts vs ${deltaLabel}`
        : 'Portfolio average',
      up:      prevPk ? (pk.ebitMargin ?? 0) >= (prevPk.ebitMargin ?? 0) : null,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-3 md:mt-4">
      {cards.map((c, i) => {
        const accent = ACCENTS[c.accent]
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
            className="relative overflow-hidden rounded-[16px] md:rounded-[18px] border border-[var(--line)] p-4 md:p-5 pt-5 md:pt-6"
            style={{ background: accent.gradient }}
          >
            {/* Coloured top bar */}
            <span
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ background: accent.bar }}
            />

            <div className="text-[10px] md:text-[11px] tracking-[.18em] uppercase text-[var(--muted)] font-semibold">
              {c.label}
            </div>

            <div className="font-display font-semibold text-[28px] md:text-[36px] tracking-[-.5px] mt-1.5 md:mt-2 text-[var(--ink)]">
              {c.value != null ? (c.unit === '%' ? `${c.value.toFixed(1)}%` : `₹${c.value.toFixed(1)}`) : '–'}
              {c.value != null && c.unit !== '%' && (
                <span className="font-mono text-[12px] md:text-[14px] text-[var(--muted)] font-medium ml-1.5">{c.unit}</span>
              )}
            </div>

            <div
              className={`text-[10.5px] md:text-[12px] mt-2 md:mt-2.5 font-mono font-medium ${
                c.up == null ? 'text-[var(--muted)]' : c.up ? 'text-brand-green' : 'text-brand-red'
              }`}
            >
              {c.sub}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
