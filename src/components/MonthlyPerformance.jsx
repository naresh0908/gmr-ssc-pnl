import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { getSectionInsights } from '../utils/sectionInsights'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

export default function MonthlyPerformance() {
  const { derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const Y = derived.byYear[year]
  const insights = useMemo(() => getSectionInsights('monthly', { derived, year }), [derived, year])
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const filteredMonthly = useMemo(
    () => Y.monthly.filter((d) => activeMonths.includes(d.month)),
    [Y.monthly, activeMonths]
  )
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  // Scale revenue axis to the data for this FY (no hardcoded 22 Cr ceiling)
  const REV_AXIS = Math.max(
    1,
    ...filteredMonthly.flatMap((d) => [d.revAct, d.revFc1, d.revFc2 ?? 0])
  ) * 1.08

  const yoyMax = Math.max(15, ...filteredMonthly.map(d => Math.abs(d.yoy ?? 0)))
  const npMax = Math.max(2.5, ...filteredMonthly.flatMap(d => [Math.abs(d.npAct), Math.abs(d.npFc1), Math.abs(d.npFc2 ?? 0)]))
  const npRatioMax = Math.max(15, ...filteredMonthly.map(d => Math.abs(d.npRatio)))

  return (
    <div className="mt-7">
      <SectionHead num="02" title={`Monthly Performance · ${periodLabel}`}>
        Actuals against FC1 and FC2 for the selected period. Solid bars are actuals; tick marks denote target.
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* Legend — top right */}
        <div className="flex items-center justify-end gap-4 px-5 py-2.5 border-b border-[var(--line)] bg-[var(--bg)] flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]"><span className="w-3 h-2 rounded-sm bg-brand-blue inline-block" /> Positive</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]"><span className="w-3 h-2 rounded-sm bg-brand-blue-soft inline-block" /> Below target</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]"><span className="w-3 h-2 rounded-sm bg-brand-red inline-block" /> Negative</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]"><span className="w-[3px] h-3.5 bg-ink rounded-sm inline-block" /> FC1</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]"><span className="w-[3px] h-3.5 bg-brand-amber rounded-sm inline-block" /> FC2</span>
          <span className="text-[11px] text-[var(--muted)]">centre = 0</span>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr] bg-[var(--bg)] border-b border-[var(--line)] text-[11px] tracking-[.16em] uppercase font-semibold text-[var(--ink-soft)]">
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Month</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Revenue (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center border-r border-[var(--line)]">YoY Growth</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Net Profit (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center">Net Profit Ratio</div>
        </div>

        {/* Rows */}
        {filteredMonthly.map((d) => {
          const revAct = Math.min((d.revAct / REV_AXIS) * 100, 100)
          const revFc1 = Math.min((d.revFc1 / REV_AXIS) * 100, 100)
          const revFc2 = Math.min((d.revFc2 / REV_AXIS) * 100, 100)
          const revBelow = d.revAct < d.revFc1
          const yoyVal = d.yoy ?? 0

          return (
            <div key={d.month} className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr] border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg)] transition">
              <div className="p-3.5 px-4 font-mono text-[13px] font-semibold tracking-wider bg-[var(--bg)] border-r border-[var(--line)] flex items-center">
                {d.month.toUpperCase()}
              </div>

              {/* Revenue bar — one-directional, never negative */}
              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center">
                <Bar
                  actual={d.revAct} target={d.revFc1} target2={d.revFc2}
                  actualPct={revAct} targetPct={revFc1} target2Pct={revFc2}
                  below={revBelow} fmt={(v) => v.toFixed(1)}
                />
              </div>

              {/* YoY Growth — bidirectional, no target */}
              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center">
                <BiBar
                  actual={yoyVal}
                  maxAbs={yoyMax}
                  fmt={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                />
              </div>

              {/* Net Profit — bidirectional with FC1 + FC2 targets */}
              <div className="p-3.5 px-4 border-r border-[var(--line)] flex items-center">
                <BiBar
                  actual={d.npAct}
                  target={d.npFc1}
                  target2={d.npFc2}
                  maxAbs={npMax}
                  fmt={(v) => v < 0 ? `(${Math.abs(v).toFixed(2)})` : v.toFixed(2)}
                />
              </div>

              {/* Net Profit Ratio — bidirectional, no target tick */}
              <div className="p-3.5 px-4 flex items-center">
                <BiBar
                  actual={d.npRatio}
                  maxAbs={npRatioMax}
                  fmt={(v) => v < 0 ? `(${Math.abs(v).toFixed(1)}%)` : `${v.toFixed(1)}%`}
                />
              </div>
            </div>
          )
        })}

      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

function Bar({ actual, target, target2, actualPct, targetPct, target2Pct, below, fmt }) {
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
      {/* FC1 target tick */}
      <div className="absolute -top-[3px] h-[28px] w-[3px] bg-ink rounded-sm z-10" style={{ left: `calc(${targetPct}% - 1.5px)` }} />
      {/* FC2 target tick */}
      {target2 !== undefined && (
        <div className="absolute -top-[3px] h-[28px] w-[3px] bg-brand-amber rounded-sm z-10" style={{ left: `calc(${target2Pct}% - 1.5px)` }} />
      )}
      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-[var(--ink-soft)]">
        {fmt(target)}
      </span>
    </div>
  )
}

function BiBar({ actual, target, target2, maxAbs, fmt }) {
  const HALF = 50
  const actualHalfPct = Math.min((Math.abs(actual) / maxAbs) * HALF, HALF)
  const targetHalfPct = target !== undefined ? Math.min((Math.abs(target) / maxAbs) * HALF, HALF) : 0
  const target2HalfPct = target2 !== undefined ? Math.min((Math.abs(target2) / maxAbs) * HALF, HALF) : 0
  const isActNeg = actual < 0
  const isTgtNeg = target !== undefined && target < 0
  const isTgt2Neg = target2 !== undefined && target2 < 0
  const isBelowTarget = !isActNeg && target !== undefined && actual < target

  const isWide = actualHalfPct > 15

  const labelStyle = isWide
    ? (isActNeg ? { right: 'calc(50% + 3px)' } : { left: 'calc(50% + 3px)' })
    : (isActNeg
        ? { right: `calc(50% + ${actualHalfPct}% + 5px)` }
        : { left: `calc(50% + ${actualHalfPct}% + 5px)` })

  const labelColor = isActNeg
    ? (isWide ? 'text-white' : 'text-brand-red')
    : isBelowTarget ? 'text-brand-blue' : (isWide ? 'text-white' : 'text-[var(--ink)]')

  const barColor = isActNeg ? 'bg-brand-red' : isBelowTarget ? 'bg-brand-blue-soft' : 'bg-brand-blue'

  return (
    <div className="relative w-full h-[22px]">
      {/* Background track */}
      <div className="absolute inset-0 bg-[var(--bg)] rounded-[4px]" />

      {/* Actual bar */}
      {isActNeg ? (
        <div
          className={`absolute top-0 h-full ${barColor} rounded-l-[4px]`}
          style={{ right: '50%', width: `${actualHalfPct}%` }}
        />
      ) : (
        <div
          className={`absolute top-0 h-full ${barColor} rounded-r-[4px]`}
          style={{ left: '50%', width: `${actualHalfPct}%` }}
        />
      )}

      {/* Zero baseline */}
      <div className="absolute top-0 bottom-0 w-[2px] bg-[var(--line)] z-10" style={{ left: 'calc(50% - 1px)' }} />

      {/* FC1 target tick */}
      {target !== undefined && (
        <div
          className="absolute -top-[3px] h-[28px] w-[3px] bg-ink rounded-sm z-20"
          style={{ left: isTgtNeg ? `calc(50% - ${targetHalfPct}% - 1.5px)` : `calc(50% + ${targetHalfPct}% - 1.5px)` }}
        />
      )}

      {/* FC2 target tick */}
      {target2 !== undefined && (
        <div
          className="absolute -top-[3px] h-[28px] w-[3px] bg-brand-amber rounded-sm z-20"
          style={{ left: isTgt2Neg ? `calc(50% - ${target2HalfPct}% - 1.5px)` : `calc(50% + ${target2HalfPct}% - 1.5px)` }}
        />
      )}

      {/* Actual value label */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold z-30 ${labelColor}`}
        style={labelStyle}
      >
        {fmt(actual)}
      </span>

      {/* FC1 target value label — far edge */}
      {target !== undefined && (
        <span
          className="absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-[var(--ink-soft)] z-20"
          style={{ [isTgtNeg ? 'left' : 'right']: '4px' }}
        >
          {fmt(target)}
        </span>
      )}
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
