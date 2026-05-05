import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import { motion } from 'framer-motion'

const REV_AXIS = 22
const NP_AXIS = 2.5

export default function MonthlyPerformance() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null

  return (
    <div className="mt-7">
      <SectionHead num="02" title={`Monthly Performance · FY ${year}`}>
        Actuals against FC1 (initial plan target). Solid bars are actuals; tick marks denote target.
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* Header */}
        <div className="grid grid-cols-[80px_1fr_130px_1fr_130px] bg-[var(--bg)] border-b border-[var(--line)] text-[11px] tracking-[.16em] uppercase font-semibold text-[var(--ink-soft)]">
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Month</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Revenue (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center border-r border-[var(--line)]">YoY Growth</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Net Profit (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center">Net Profit Ratio</div>
        </div>

        {/* Rows */}
        {Y.monthly.map((d) => {
          const revAct = (d.revAct / REV_AXIS) * 100
          const revFc1 = (d.revFc1 / REV_AXIS) * 100
          const revBelow = d.revAct < d.revFc1

          const npAct = (d.npAct / NP_AXIS) * 100
          const npFc1 = (d.npFc1 / NP_AXIS) * 100
          const npBelow = d.npAct < d.npFc1

          const yoyClass = (d.yoy ?? 0) >= 0
            ? 'bg-brand-green-soft text-brand-green'
            : 'bg-brand-red-soft text-brand-red'
          const npRatioClass =
            d.npRatio >= 9 ? 'bg-brand-green-soft text-brand-green' :
            d.npRatio >= 7.5 ? 'bg-brand-amber-soft text-brand-amber' :
            'bg-brand-red-soft text-brand-red'

          return (
            <div key={d.month} className="grid grid-cols-[80px_1fr_130px_1fr_130px] border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg)] transition">
              <div className="p-3.5 px-4 font-mono text-[13px] font-semibold tracking-wider bg-[var(--bg)] border-r border-[var(--line)] flex items-center">
                {d.month.toUpperCase()}
              </div>

              {/* Revenue bar */}
              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center">
                <Bar
                  actual={d.revAct} target={d.revFc1}
                  actualPct={revAct} targetPct={revFc1}
                  below={revBelow} fmt={(v) => v.toFixed(1)}
                />
              </div>

              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center justify-center">
                <div className={`w-full text-center py-1.5 px-2.5 rounded-md font-mono text-[12.5px] font-semibold ${yoyClass}`}>
                  {(d.yoy ?? 0) >= 0 ? '+' : ''}{(d.yoy ?? 0).toFixed(1)}%
                </div>
              </div>

              {/* Net Profit bar */}
              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center">
                <Bar
                  actual={d.npAct} target={d.npFc1}
                  actualPct={npAct} targetPct={npFc1}
                  below={npBelow} fmt={(v) => v.toFixed(2)}
                />
              </div>

              <div className="p-3.5 px-4 flex items-center justify-center">
                <div className={`w-full text-center py-1.5 px-2.5 rounded-md font-mono text-[12.5px] font-semibold ${npRatioClass}`}>
                  {d.npRatio.toFixed(1)}%
                </div>
              </div>
            </div>
          )
        })}

        {/* ===== LEGEND (with Net Profit Ratio bands as requested) ===== */}
        <div className="border-t border-[var(--line)] bg-[var(--bg)]">
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-[12px] text-[var(--ink-soft)] items-center">
            <span className="font-semibold uppercase tracking-wider text-[10.5px]">Bars</span>
            <Legend swatch="bg-brand-blue" label="Above Target (Actual)" />
            <Legend swatch="bg-brand-blue-soft" label="Below Target (Actual)" />
            <Legend swatch="bg-brand-grey" label="Target (FC1)" />
            <span className="inline-flex items-center gap-2">
              <span className="w-[3px] h-4 bg-ink rounded-sm" />
              <span>Target tick</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pb-3 text-[12px] text-[var(--ink-soft)] items-center border-t border-dashed border-[var(--line)] pt-3">
            <span className="font-semibold uppercase tracking-wider text-[10.5px]">Net Profit Ratio</span>
            <Legend swatch="bg-brand-green-soft border border-brand-green/40" label="≥ 9.0% · Healthy" textCls="text-brand-green" />
            <Legend swatch="bg-brand-amber-soft border border-brand-amber/40" label="7.5% – 9.0% · Watch" textCls="text-brand-amber" />
            <Legend swatch="bg-brand-red-soft border border-brand-red/40" label="< 7.5% · At Risk" textCls="text-brand-red" />
            <span className="ml-auto text-[var(--muted)]">YoY uses same band logic (positive = healthy, negative = at risk)</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Bar({ actual, target, actualPct, targetPct, below, fmt }) {
  return (
    <div className="relative w-full h-[22px]">
      <div className="absolute inset-0 bg-[var(--bg)] rounded-[4px]" />
      <div className="absolute top-0 left-0 h-full bg-brand-grey rounded-[4px]" style={{ width: `${targetPct}%` }} />
      <div
        className={`absolute top-0 left-0 h-full rounded-[4px] ${below ? 'bg-brand-blue-soft' : 'bg-brand-blue'}`}
        style={{ width: `${actualPct}%` }}
      >
        <span className={`absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold ${below ? 'text-brand-blue' : 'text-white'}`}>
          {fmt(actual)}
        </span>
      </div>
      <div className="absolute -top-[3px] h-[28px] w-[3px] bg-ink rounded-sm" style={{ left: `calc(${targetPct}% - 1.5px)` }} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-[var(--ink-soft)]">
        {fmt(target)}
      </span>
    </div>
  )
}

function Legend({ swatch, label, textCls = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${textCls}`}>
      <span className={`w-3.5 h-2.5 rounded-sm ${swatch}`} />
      <span>{label}</span>
    </span>
  )
}
