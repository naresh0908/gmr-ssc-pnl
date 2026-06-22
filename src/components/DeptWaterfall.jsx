import { useState } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'

export default function DeptWaterfall() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  const [selected, setSelected] = useState(null)

  if (!Y) return null

  const dept = selected ?? Y.byDept[0]?.department
  const row = Y.byDept.find((d) => d.department === dept)
  if (!row) return null

  // Steps: FC1 → planning change → FC2 → execution change → Actual
  const fc1 = row.costFc1
  const fc2 = row.costFc2
  const act = row.costAct
  const planChange = row.planChange   // FC2 - FC1 (negative = revised down = saving)
  const execChange = row.execChange   // Actual - FC2 (negative = under-spent = saving)

  const steps = [
    { kind: 'anchor', label: 'FC1 Plan',     value: fc1, runningTo: fc1 },
    { kind: planChange < 0 ? 'down' : 'up', label: planChange < 0 ? 'Plan revised down' : 'Plan revised up',
      value: planChange, runningTo: fc2 },
    { kind: 'anchor', label: 'FC2 Revised',  value: fc2, runningTo: fc2 },
    { kind: execChange < 0 ? 'down' : 'up', label: execChange < 0 ? 'Under-spent' : 'Over-spent',
      value: execChange, runningTo: act },
    { kind: 'anchor', label: 'Actual',       value: act, runningTo: act }
  ]

  // Y-axis scale - pad ±5% around min/max of [fc1, fc2, act]
  const allVals = [fc1, fc2, act]
  const yMax = Math.max(...allVals) * 1.04
  const yMin = Math.max(0, Math.min(...allVals) * 0.92)

  const W = 1100, H = 320
  const PAD_L = 70, PAD_R = 30, PAD_T = 40, PAD_B = 60
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const stepW = innerW / steps.length
  const barW = stepW * 0.55

  const yScale = (v) => PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  // Track running total to position floating bars
  let running = 0
  const bars = steps.map((s, i) => {
    const cx = PAD_L + stepW * i + stepW / 2
    let yTop, yBot, color, label, valueText
    if (s.kind === 'anchor') {
      yTop = yScale(s.value)
      yBot = yScale(yMin)
      color = i === 0 ? '#0E1116' : i === steps.length - 1 ? '#1F6FEB' : '#3B4252'
      label = s.label
      valueText = `₹${s.value.toFixed(2)}`
      running = s.value
    } else {
      const start = running
      const end = running + s.value
      yTop = yScale(Math.max(start, end))
      yBot = yScale(Math.min(start, end))
      color = s.kind === 'down' ? '#1F8A4C' : '#C0392B'
      label = s.label
      valueText = `${s.value >= 0 ? '+' : ''}${s.value.toFixed(2)}`
      running = end
    }
    return { i, cx, yTop, yBot, color, label, valueText, kind: s.kind }
  })

  const yTicks = [yMin, yMin + (yMax - yMin) * 0.33, yMin + (yMax - yMin) * 0.66, yMax]

  return (
    <div className="mt-7">
      <SectionHead num="04" title={`Cost Waterfall · ${row.department} · ${year}`}>
        FC1 → planning revision → FC2 → execution variance → Actual. Switch department to see drivers per service line.
      </SectionHead>

      {/* Department selector chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Y.byDept.map((d) => (
          <button
            key={d.department}
            onClick={() => setSelected(d.department)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition ${
              d.department === dept
                ? 'bg-ink text-bg-light border-ink'
                : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'
            }`}
          >
            {d.department}
          </button>
        ))}
      </div>

      <motion.div
        key={dept}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-6"
      >
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="FC1 Plan"      value={`₹${fc1.toFixed(2)} Cr`} />
          <Stat label="FC2 Revised"   value={`₹${fc2.toFixed(2)} Cr`}
                delta={`${planChange >= 0 ? '+' : ''}${planChange.toFixed(2)} vs FC1`}
                deltaUp={planChange < 0} />
          <Stat label="Actual"        value={`₹${act.toFixed(2)} Cr`}
                delta={`${execChange >= 0 ? '+' : ''}${execChange.toFixed(2)} vs FC2`}
                deltaUp={execChange < 0} />
          <Stat label="Total Variance" value={`₹${(act - fc1).toFixed(2)} Cr`}
                delta={`${(((act - fc1) / fc1) * 100).toFixed(1)}% vs FC1`}
                deltaUp={(act - fc1) < 0} />
        </div>

        {/* SVG Waterfall */}
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
            {/* Y-axis ticks */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD_L} x2={W - PAD_R}
                  y1={yScale(t)} y2={yScale(t)}
                  stroke="var(--line)" strokeDasharray="2 4"
                />
                <text x={PAD_L - 8} y={yScale(t) + 4} textAnchor="end"
                      className="font-mono fill-[var(--muted)]" style={{ fontSize: 11 }}>
                  {t.toFixed(0)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {bars.map((b) => (
              <g key={b.i}>
                <rect
                  x={b.cx - barW / 2} y={b.yTop}
                  width={barW} height={Math.max(2, b.yBot - b.yTop)}
                  fill={b.color}
                  rx={3}
                  opacity={b.kind === 'anchor' ? 1 : 0.92}
                />
                {/* Value on top */}
                <text x={b.cx} y={b.yTop - 8} textAnchor="middle"
                      className="font-mono"
                      style={{ fontSize: 12, fontWeight: 600, fill: b.color }}>
                  {b.valueText}
                </text>
                {/* Label below axis */}
                <text x={b.cx} y={H - PAD_B + 22} textAnchor="middle"
                      className="font-mono fill-[var(--ink-soft)]"
                      style={{ fontSize: 11 }}>
                  {b.label}
                </text>
              </g>
            ))}

            {/* Connector dashed lines between bars */}
            {bars.slice(0, -1).map((b, i) => {
              const next = bars[i + 1]
              const y1 = b.yTop
              const y2 = next.yTop
              return (
                <line
                  key={`c${i}`}
                  x1={b.cx + barW / 2} y1={b.kind === 'anchor' ? b.yTop : Math.min(b.yTop, b.yBot)}
                  x2={next.cx - barW / 2} y2={next.kind === 'anchor' ? next.yTop : Math.min(next.yTop, next.yBot)}
                  stroke="var(--muted)" strokeDasharray="3 3" strokeWidth={1}
                  opacity={0.5}
                />
              )
            })}

            {/* Baseline */}
            <line x1={PAD_L} x2={W - PAD_R} y1={yScale(yMin)} y2={yScale(yMin)} stroke="var(--ink)" strokeWidth={1} />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[var(--line)] text-[12px] text-[var(--ink-soft)]">
          <span className="font-semibold uppercase tracking-wider text-[10.5px]">Legend</span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-sm" style={{ background: '#0E1116' }} /> Anchor (FC1 / FC2 / Actual)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-sm" style={{ background: '#1F8A4C' }} /> Saving
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-sm" style={{ background: '#C0392B' }} /> Overrun
          </span>
        </div>
      </motion.div>
    </div>
  )
}

function Stat({ label, value, delta, deltaUp }) {
  return (
    <div className="p-3.5 px-4 bg-[var(--bg)] border border-[var(--line)] rounded-[12px]">
      <div className="text-[10.5px] text-[var(--muted)] tracking-wider uppercase font-semibold">{label}</div>
      <div className="font-display text-[20px] font-medium mt-0.5">{value}</div>
      {delta && (
        <div className={`text-[11.5px] font-mono font-medium mt-0.5 ${deltaUp ? 'text-brand-green' : 'text-brand-red'}`}>
          {delta}
        </div>
      )}
    </div>
  )
}
