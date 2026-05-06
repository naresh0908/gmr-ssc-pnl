import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import { motion } from 'framer-motion'

const REV_AXIS = 22

export default function MonthlyPerformance() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null

  const yoyMax = Math.max(15, ...Y.monthly.map(d => Math.abs(d.yoy ?? 0)))
  const npMax = Math.max(2.5, ...Y.monthly.flatMap(d => [Math.abs(d.npAct), Math.abs(d.npFc1), Math.abs(d.npFc2 ?? 0)]))
  const npRatioMax = Math.max(15, ...Y.monthly.map(d => Math.abs(d.npRatio)))

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
        <div className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr] bg-[var(--bg)] border-b border-[var(--line)] text-[11px] tracking-[.16em] uppercase font-semibold text-[var(--ink-soft)]">
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Month</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Revenue (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center border-r border-[var(--line)]">YoY Growth</div>
          <div className="p-3.5 px-4 border-r border-[var(--line)]">Net Profit (₹ Cr)</div>
          <div className="p-3.5 px-4 text-center">Net Profit Ratio</div>
        </div>

        {/* Rows */}
        {Y.monthly.map((d) => {
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

        {/* Legend */}
        <div className="border-t border-[var(--line)] bg-[var(--bg)]">
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 text-[12px] text-[var(--ink-soft)] items-center">
            <span className="font-semibold uppercase tracking-wider text-[10.5px]">Revenue</span>
            <Legend swatch="bg-brand-blue" label="Above Target (Actual)" />
            <Legend swatch="bg-brand-blue-soft" label="Below Target (Actual)" />
            <Legend swatch="bg-brand-grey" label="Target (FC1)" />
            <span className="inline-flex items-center gap-2">
              <span className="w-[3px] h-4 bg-ink rounded-sm" />
              <span>FC1 Target</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-[3px] h-4 bg-brand-amber rounded-sm" />
              <span>FC2 Target</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pb-3 text-[12px] text-[var(--ink-soft)] items-center border-t border-dashed border-[var(--line)] pt-3">
            <span className="font-semibold uppercase tracking-wider text-[10.5px]">Bidirectional Bars</span>
            <Legend swatch="bg-brand-blue" label="Positive / Above Target" />
            <Legend swatch="bg-brand-blue-soft" label="Below Target (Actual)" textCls="text-brand-blue" />
            <Legend swatch="bg-brand-red" label="Negative Actual" />
            <span className="inline-flex items-center gap-2">
              <span className="w-[3px] h-4 bg-ink rounded-sm" />
              <span>FC1 Target</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-[3px] h-4 bg-brand-amber rounded-sm" />
              <span>FC2 Target</span>
            </span>
            <span className="ml-auto text-[var(--muted)]">Center line = 0 baseline</span>
          </div>
        </div>
      </motion.div>
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
