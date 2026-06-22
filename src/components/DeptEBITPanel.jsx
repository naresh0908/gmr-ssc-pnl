import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import { motion } from 'framer-motion'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodByDept } from '../utils/periodUtils'

export default function DeptEBITPanel() {
  const { derived, year, fromMonth, toMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const rawCost    = useDashStore((s) => s.rawCost)
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(fromMonth, toMonth, year)

  const byDept = useMemo(
    () => derivePeriodByDept(rawRevenue, rawCost, derived.departments, year, activeMonths),
    [rawRevenue, rawCost, derived.departments, year, activeMonths]
  )

  const max = Math.max(...byDept.map((d) => d.ebit), 0.01)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-6"
    >
      <h4 className="m-0 font-display font-medium text-[18px] tracking-[-.2px]">
        Department EBIT · {periodLabel}
      </h4>
      <div className="text-[12px] text-[var(--muted)] mt-1 mb-4">
        Revenue – Cost, ranked. F&amp;A typically leads on absolute EBIT.
      </div>

      <div className="mt-2">
        {byDept.map((x) => (
          <div key={x.department} className="grid grid-cols-[1.4fr_1fr_90px_70px] gap-3 items-center py-2.5 border-b border-dashed border-[var(--line)] last:border-b-0">
            <div className="text-[13px] font-semibold text-[var(--ink)]">{x.department}</div>
            <div className="h-3.5 bg-[var(--bg)] rounded-sm relative">
              <div
                className="absolute left-0 top-0 h-full rounded-sm"
                style={{
                  width: `${max > 0 ? (Math.max(x.ebit, 0) / max) * 100 : 0}%`,
                  background: x.ebit >= 0
                    ? 'linear-gradient(90deg,#1F6FEB,#5B8FF2)'
                    : 'linear-gradient(90deg,#C0392B,#E74C3C)'
                }}
              />
            </div>
            <div className="font-mono text-[12.5px] text-[var(--ink-soft)] text-right font-medium">
              ₹{x.ebit.toFixed(2)} Cr
            </div>
            <div className={`font-mono text-[12px] text-right font-semibold ${x.margin >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
              {x.margin.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
