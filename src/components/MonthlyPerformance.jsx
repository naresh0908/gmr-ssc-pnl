import { useMemo, useState } from 'react'
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
  const [targetView, setTargetView] = useState('fc1')
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
        {/* Legend - top right */}
        <div className="flex items-center justify-end gap-4 px-5 py-2.5 border-b border-[var(--line)] bg-[var(--bg)] flex-wrap overflow-x-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)] shrink-0"><span className="w-3 h-2 rounded-sm bg-brand-blue inline-block" /> Positive</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)] shrink-0"><span className="w-3 h-2 rounded-sm bg-brand-blue-soft inline-block" /> Below target</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)] shrink-0"><span className="w-3 h-2 rounded-sm bg-brand-red inline-block" /> Negative</span>
          <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--line)] rounded-full p-0.5 shrink-0">
            {[
              { id: 'fc1', label: 'FC1 Target' },
              { id: 'fc2', label: 'FC2 Target' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTargetView(opt.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition whitespace-nowrap ${
                  targetView === opt.id
                    ? 'bg-ink text-bg-light'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--muted)] shrink-0">centre = 0</span>
        </div>

        {/* Scrollable container */}
        <div className="overflow-x-auto">
          {/* Header */}
          <div className="inline-grid grid-cols-[70px_100px_90px_100px_120px] md:grid-cols-[80px_1.5fr_1fr_1fr_1fr] bg-[var(--bg)] border-b border-[var(--line)] text-[10px] md:text-[11px] tracking-[.16em] uppercase font-semibold text-[var(--ink-soft)] min-w-full">
            <div className="p-2 md:p-3.5 px-2 md:px-4 border-r border-[var(--line)] sticky left-0 bg-[var(--bg)] z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Month</div>
            <div className="p-2 md:p-3.5 px-2 md:px-4 border-r border-[var(--line)]">Revenue</div>
            <div className="p-2 md:p-3.5 px-1 md:px-4 text-center border-r border-[var(--line)]">YoY</div>
            <div className="p-2 md:p-3.5 px-2 md:px-4 border-r border-[var(--line)]">NP</div>
            <div className="p-2 md:p-3.5 px-2 md:px-4 text-center">NP Ratio</div>
          </div>

          {/* Rows */}
          {filteredMonthly.map((d) => {
            const revAct = Math.min((d.revAct / REV_AXIS) * 100, 100)
            const revFc1 = Math.min((d.revFc1 / REV_AXIS) * 100, 100)
            const revFc2 = Math.min((d.revFc2 / REV_AXIS) * 100, 100)
            const revTarget = targetView === 'fc1' ? d.revFc1 : d.revFc2
            const revTargetPct = targetView === 'fc1' ? revFc1 : revFc2
            const revBelow = d.revAct < revTarget
            const yoyVal = d.yoy ?? 0
            const npTarget = targetView === 'fc1' ? d.npFc1 : d.npFc2

            return (
              <div key={d.month} className="inline-grid grid-cols-[70px_100px_90px_100px_120px] md:grid-cols-[80px_1.5fr_1fr_1fr_1fr] border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg)] transition min-w-full">
                <div className="p-2 md:p-3.5 px-2 md:px-4 font-mono text-[12px] md:text-[13px] font-semibold tracking-wider bg-[var(--bg)] border-r border-[var(--line)] flex items-center sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                  {d.month.slice(0, 3).toUpperCase()}
                </div>

                {/* Revenue bar - one-directional, never negative */}
                <div className="p-2 md:p-3.5 px-2 md:px-4 border-r border-[var(--line)] flex items-center">
                  <Bar
                    actual={d.revAct}
                    target={revTarget}
                    actualPct={revAct}
                    targetPct={revTargetPct}
                    targetColor={targetView === 'fc1' ? 'bg-ink' : 'bg-brand-amber'}
                    below={revBelow} fmt={(v) => v.toFixed(1)}
                  />
                </div>

                {/* YoY Growth - bidirectional, no target */}
                <div className="p-2 md:p-3.5 px-1 md:px-4 border-r border-[var(--line)] flex items-center">
                  <BiBar
                    actual={yoyVal}
                    maxAbs={yoyMax}
                    fmt={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  />
                </div>

                {/* Net Profit - bidirectional with selected benchmark */}
                <div className="p-2 md:p-3.5 px-2 md:px-4 border-r border-[var(--line)] flex items-center">
                  <BiBar
                    actual={d.npAct}
                    target={npTarget}
                    targetColor={targetView === 'fc1' ? 'bg-ink' : 'bg-brand-amber'}
                    maxAbs={npMax}
                    fmt={(v) => v < 0 ? `(${Math.abs(v).toFixed(2)})` : v.toFixed(2)}
                  />
                </div>

                {/* Net Profit Ratio - bidirectional, no target tick */}
                <div className="p-2 md:p-3.5 px-2 md:px-4 flex items-center">
                  <BiBar
                    actual={d.npRatio}
                    maxAbs={npRatioMax}
                    fmt={(v) => v < 0 ? `(${Math.abs(v).toFixed(1)}%)` : `${v.toFixed(1)}%`}
                  />
                </div>
              </div>
            )
          })}
        </div>

      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

function Bar({ actual, target, actualPct, targetPct, targetColor, below, fmt }) {
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
      {/* selected target tick */}
      <div className={`absolute -top-[3px] h-[28px] w-[3px] rounded-sm z-10 ${targetColor ?? 'bg-ink'}`} style={{ left: `calc(${targetPct}% - 1.5px)` }} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-[var(--ink-soft)]">
        {fmt(target)}
      </span>
    </div>
  )
}

function BiBar({ actual, target, targetColor, maxAbs, fmt }) {
  const HALF = 50
  const actualHalfPct = Math.min((Math.abs(actual) / maxAbs) * HALF, HALF)
  const targetHalfPct = target !== undefined ? Math.min((Math.abs(target) / maxAbs) * HALF, HALF) : 0
  const isActNeg = actual < 0
  const isTgtNeg = target !== undefined && target < 0
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

      {/* selected target tick */}
      {target !== undefined && (
        <div
          className={`absolute -top-[3px] h-[28px] w-[3px] rounded-sm z-20 ${targetColor ?? 'bg-ink'}`}
          style={{ left: isTgtNeg ? `calc(50% - ${targetHalfPct}% - 1.5px)` : `calc(50% + ${targetHalfPct}% - 1.5px)` }}
        />
      )}

      {/* Actual value label */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold z-30 ${labelColor}`}
        style={labelStyle}
      >
        {fmt(actual)}
      </span>

      {/* selected target value label - far edge */}
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
