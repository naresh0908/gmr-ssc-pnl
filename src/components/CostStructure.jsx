import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import { motion } from 'framer-motion'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodCostByType } from '../utils/periodUtils'

const colors = {
  PEX:   { bg: '#1F6FEB', text: '#fff' },
  OPEX:  { bg: '#5B8FF2', text: '#fff' },
  CAPEX: { bg: '#A9C3F5', text: '#1F2530' }
}

export default function CostStructure() {
  const { derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const rawCost    = useDashStore((s) => s.rawCost)
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  const costByType = useMemo(
    () => derivePeriodCostByType(rawCost, year, activeMonths),
    [rawCost, year, activeMonths]
  )

  const total = costByType.reduce((a, c) => a + c.actual, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-6"
    >
      <h4 className="m-0 font-display font-medium text-[18px] tracking-[-.2px]">
        Cost Structure · {periodLabel}
      </h4>
      <div className="text-[12px] text-[var(--muted)] mt-1 mb-4">
        PEX dominates. CAPEX deferred — savings may surface in next FY.
      </div>

      <div className="flex h-[46px] rounded-[10px] overflow-hidden border border-[var(--line)]">
        {costByType.map((s) => {
          const pct = total > 0 ? (s.actual / total) * 100 : 0
          return (
            <div
              key={s.type}
              className="flex items-center justify-center font-mono text-[12px] font-semibold"
              style={{ flex: `${Math.max(pct, 1)} 0 0`, background: colors[s.type].bg, color: colors[s.type].text }}
            >
              {s.type} · {pct.toFixed(0)}%
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mt-3.5">
        {costByType.map((s) => {
          const varF1 = s.actual - s.fc1
          const varF2 = s.actual - s.fc2
          const pct   = total > 0 ? (s.actual / total) * 100 : 0
          return (
            <div key={s.type} className="p-3.5 border border-[var(--line)] rounded-[12px]"
                 style={{ borderTop: `3px solid ${colors[s.type].bg}` }}>
              <div className="text-[11px] text-[var(--muted)] tracking-wider uppercase font-semibold">{s.type}</div>
              <div className="font-display text-[22px] font-medium mt-1">₹{s.actual.toFixed(1)} Cr</div>
              <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-0.5">{pct.toFixed(1)}%</div>
              <div className="font-mono text-[11px] mt-1 flex gap-3">
                <span className={varF1 <= 0 ? 'text-brand-green' : 'text-brand-red'}>
                  F1: {varF1 < 0 ? '▼' : '▲'} ₹{Math.abs(varF1).toFixed(1)}
                </span>
                <span className={varF2 <= 0 ? 'text-brand-green' : 'text-brand-red'}>
                  F2: {varF2 < 0 ? '▼' : '▲'} ₹{Math.abs(varF2).toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
