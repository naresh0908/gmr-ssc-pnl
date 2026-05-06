import { useDashStore } from '../store/useDashStore'
import { motion } from 'framer-motion'

export default function DeptEBITPanel() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null

  const max = Math.max(...Y.byDept.map((d) => d.ebit), 0.01)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-6"
    >
      <h4 className="m-0 font-display font-medium text-[18px] tracking-[-.2px]">
        Department EBIT · FY {year}
      </h4>
      <div className="text-[12px] text-[var(--muted)] mt-1 mb-4">
        Revenue – Cost, ranked. F&amp;A typically leads on absolute EBIT.
      </div>

      <div className="mt-2">
        {Y.byDept.map((x) => (
          <div key={x.department} className="grid grid-cols-[1.4fr_1fr_90px_70px] gap-3 items-center py-2.5 border-b border-dashed border-[var(--line)] last:border-b-0">
            <div className="text-[13px] font-semibold text-[var(--ink)]">{x.department}</div>
            <div className="h-3.5 bg-[var(--bg)] rounded-sm relative">
              <div
                className="absolute left-0 top-0 h-full rounded-sm"
                style={{
                  width: `${(x.ebit / max) * 100}%`,
                  background: 'linear-gradient(90deg,#1F6FEB,#5B8FF2)'
                }}
              />
            </div>
            <div className="font-mono text-[12.5px] text-[var(--ink-soft)] text-right font-medium">
              ₹{x.ebit.toFixed(2)} Cr
            </div>
            <div className="font-mono text-[12px] text-brand-green text-right font-semibold">
              {x.margin.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
