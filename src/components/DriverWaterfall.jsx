import { useState, useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { getSectionInsights } from '../utils/sectionInsights'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

/* ─── Constants ─── */
const CR = 1e7

/* colour tokens */
const COL = {
  anchor:   '#0E1116',
  anchorEnd:'#1F6FEB',
  up:       '#C0392B',   // cost over-run = red
  down:     '#1F8A4C',   // cost saving  = green
  line:     '#B0B8C4',
  muted:    '#8A919B',
  connHi:   '#D4A22F',   // gold connector for total Δ
}

/* ─── helpers ─── */
const fmt = (v, unit) => {
  if (unit === 'FTE') return v.toFixed(0)
  return `₹${v.toFixed(2)}`
}
const fmtDelta = (v, unit) => {
  const sign = v >= 0 ? '+' : ''
  if (unit === 'FTE') return `${sign}${v.toFixed(0)}`
  return `${sign}${v.toFixed(2)}`
}

/* ─── single waterfall SVG ─── */
function WaterfallChart({ title, unit, fcTotal, actTotal, drivers }) {
  const totalDelta = actTotal - fcTotal
  const steps = [
    { kind: 'anchor', label: title.includes('FC1') ? 'FC1' : 'FC2', value: fcTotal },
    ...drivers.map(d => ({
      kind: d.delta < 0 ? 'down' : 'up',
      label: d.label,
      value: d.delta,
    })),
    { kind: 'anchorEnd', label: 'Actual', value: actTotal },
  ]

  /* dimensions */
  const W = 960, H = 280
  const PAD_L = 72, PAD_R = 28, PAD_T = 52, PAD_B = 70
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const stepW = innerW / steps.length
  const barW  = Math.min(stepW * 0.58, 64)

  /* y-scale: track running values to find range */
  let running = fcTotal
  const runVals = [fcTotal]
  steps.forEach(s => {
    if (s.kind === 'anchor' || s.kind === 'anchorEnd') {
      running = s.value
    } else {
      running += s.value
    }
    runVals.push(running)
  })
  const yMin = Math.max(0, Math.min(...runVals) * 0.88)
  const yMax = Math.max(...runVals) * 1.08
  const yScale = v => PAD_T + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  /* build bar geometries */
  running = 0
  const bars = steps.map((s, i) => {
    const cx = PAD_L + stepW * i + stepW / 2
    let yTop, yBot, color
    if (s.kind === 'anchor' || s.kind === 'anchorEnd') {
      yTop = yScale(s.value)
      yBot = yScale(yMin)
      color = s.kind === 'anchor' ? COL.anchor : COL.anchorEnd
      running = s.value
    } else {
      const start = running
      const end   = running + s.value
      yTop = yScale(Math.max(start, end))
      yBot = yScale(Math.min(start, end))
      color = s.value < 0 ? COL.down : COL.up
      running = end
    }
    return { ...s, i, cx, yTop, yBot, color, running }
  })

  /* y-axis ticks (4) */
  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + (yMax - yMin) * (i / 3))

  /* total Δ connector from first bar top to last bar top */
  const firstBar = bars[0]
  const lastBar  = bars[bars.length - 1]

  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-5 overflow-x-auto">
      {/* header line */}
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-[13px] font-bold uppercase tracking-wide text-[var(--ink)]">
          {title}
        </span>
        <span className={`text-[12px] font-mono font-semibold ${totalDelta < 0 ? 'text-brand-green' : 'text-brand-red'}`}>
          {fmtDelta(totalDelta, unit)} {unit === 'FTE' ? '' : 'Cr'}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {/* grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L} x2={W - PAD_R}
              y1={yScale(t)} y2={yScale(t)}
              stroke="var(--line)" strokeDasharray="2 4"
            />
            <text x={PAD_L - 8} y={yScale(t) + 4} textAnchor="end"
              fill="var(--muted)" style={{ fontSize: 10, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              {unit === 'FTE' ? t.toFixed(0) : t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* total Δ connector */}
        {(() => {
          const y = Math.min(firstBar.yTop, lastBar.yTop) - 16
          return (
            <g>
              <line x1={firstBar.cx} x2={lastBar.cx} y1={y} y2={y}
                    stroke={COL.connHi} strokeWidth={1.5} />
              <line x1={firstBar.cx} x2={firstBar.cx} y1={y} y2={y + 8}
                    stroke={COL.connHi} strokeWidth={1.5} />
              <line x1={lastBar.cx} x2={lastBar.cx} y1={y} y2={y + 8}
                    stroke={COL.connHi} strokeWidth={1.5} />
                <text x={(firstBar.cx + lastBar.cx) / 2} y={y - 4} textAnchor="middle"
                  fill={COL.connHi} style={{ fontSize: 11, fontWeight: 700, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
                {fmtDelta(totalDelta, unit)}
              </text>
            </g>
          )
        })()}

        {/* bars */}
        {bars.map(b => (
          <g key={b.i}>
            <rect
              x={b.cx - barW / 2} y={b.yTop}
              width={barW} height={Math.max(2, b.yBot - b.yTop)}
              fill={b.color} rx={3}
              opacity={b.kind === 'anchor' || b.kind === 'anchorEnd' ? 1 : 0.88}
            />
            {/* value label */}
            <text x={b.cx} y={b.yTop - 6} textAnchor="middle"
              fill={b.color}
              style={{ fontSize: 10.5, fontWeight: 600, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              {b.kind === 'anchor' || b.kind === 'anchorEnd'
                ? fmt(b.value, unit)
                : fmtDelta(b.value, unit)}
            </text>
            {/* x-axis label */}
            <text x={b.cx} y={H - PAD_B + 16} textAnchor="middle"
              fill="var(--ink-soft)"
              style={{ fontSize: 9.5, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
              {wrapLabel(b.label, b.cx, H - PAD_B + 16)}
            </text>
          </g>
        ))}

        {/* connector dashes between adjacent bars */}
        {bars.slice(0, -1).map((b, i) => {
          const next = bars[i + 1]
          const y1 = (b.kind === 'anchor' || b.kind === 'anchorEnd') ? b.yTop : Math.min(b.yTop, b.yBot)
          const y2 = (next.kind === 'anchor' || next.kind === 'anchorEnd') ? next.yTop : Math.min(next.yTop, next.yBot)
          /* for bridge bars we connect at running level */
          const connY = yScale(b.running)
          return (
            <line key={`c${i}`}
              x1={b.cx + barW / 2} x2={next.cx - barW / 2}
              y1={connY} y2={connY}
              stroke={COL.muted} strokeDasharray="3 3" strokeWidth={0.8} opacity={0.55}
            />
          )
        })}

        {/* baseline */}
        <line x1={PAD_L} x2={W - PAD_R} y1={yScale(yMin)} y2={yScale(yMin)}
              stroke="var(--ink)" strokeWidth={1} />
      </svg>
    </div>
  )
}

/* helper: returns label string (truncate if needed) */
function wrapLabel(text) {
  if (text.length <= 12) return text
  return text.slice(0, 11) + '…'
}

/* ═══════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════ */
export default function DriverWaterfall() {
  const { rawCost, derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const [scenario, setScenario] = useState('fc1')
  const [dept, setDept] = useState('All')
  const insights = useMemo(() => getSectionInsights('waterfall', { derived, year, rawCost }), [derived, year, rawCost])

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  const departments = useMemo(
    () => ['All', ...new Set(rawCost.map(c => c.department))],
    [rawCost]
  )

  /* Compute driver-based waterfall data */
  const waterfallData = useMemo(() => {
    const rows = rawCost.filter(c => c.year === year && activeMonths.includes(c.month) && (dept === 'All' || c.department === dept))

    const fcKey = scenario === 'fc1' ? 'fc1' : 'fc2'

    /* ── PEX waterfall ── */
    const pexRows = rows.filter(r => r.costType === 'PEX')
    const pexSubs = [...new Set(pexRows.map(r => r.subCategory))]
    const pexFcTotal  = pexRows.reduce((a, r) => a + r[fcKey], 0) / CR
    const pexActTotal = pexRows.reduce((a, r) => a + r.actual, 0) / CR
    const pexDrivers = pexSubs.map(sub => {
      const subRows = pexRows.filter(r => r.subCategory === sub)
      const fc  = subRows.reduce((a, r) => a + r[fcKey], 0) / CR
      const act = subRows.reduce((a, r) => a + r.actual, 0) / CR
      return { label: sub, delta: act - fc }
    }).filter(d => Math.abs(d.delta) > 0.005)
      .sort((a, b) => a.delta - b.delta)   // negatives first (savings)

    /* ── OPEX waterfall ── */
    const opexRows = rows.filter(r => r.costType === 'OPEX')
    const opexSubs = [...new Set(opexRows.map(r => r.subCategory))]
    const opexFcTotal  = opexRows.reduce((a, r) => a + r[fcKey], 0) / CR
    const opexActTotal = opexRows.reduce((a, r) => a + r.actual, 0) / CR
    const opexDrivers = opexSubs.map(sub => {
      const subRows = opexRows.filter(r => r.subCategory === sub)
      const fc  = subRows.reduce((a, r) => a + r[fcKey], 0) / CR
      const act = subRows.reduce((a, r) => a + r.actual, 0) / CR
      return { label: sub, delta: act - fc }
    }).filter(d => Math.abs(d.delta) > 0.005)
      .sort((a, b) => a.delta - b.delta)

    /* ── FTE proxy waterfall ──
       Since no actual headcount exists, use Salaries as FTE proxy.
       We break PEX into department-level drivers to show an
       "FTE impact" bridge (Salary variance by department) */
    const depts = [...new Set(rawCost.filter(c => c.year === year && activeMonths.includes(c.month)).map(c => c.department))]
    const salaryRows = rawCost.filter(c => c.year === year && activeMonths.includes(c.month) && c.costType === 'PEX' && c.subCategory === 'Salaries')
    const fteFcTotal = salaryRows.reduce((a, r) => a + r[fcKey], 0) / CR
    const fteActTotal = salaryRows.reduce((a, r) => a + r.actual, 0) / CR

    let fteDrivers
    if (dept === 'All') {
      // break by department
      fteDrivers = depts.map(d => {
        const dRows = salaryRows.filter(r => r.department === d)
        const fc  = dRows.reduce((a, r) => a + r[fcKey], 0) / CR
        const act = dRows.reduce((a, r) => a + r.actual, 0) / CR
        // short name
        const shortName = d.replace(/\s*\(.*?\)\s*/g, '').split(' ').map(w => w[0]).join('')
        return { label: shortName, delta: act - fc }
      }).filter(d => Math.abs(d.delta) > 0.005)
        .sort((a, b) => a.delta - b.delta)
    } else {
      // break by month groups (Q1-Q4)
      const quarters = [
        { label: 'Q1', months: ['Jan','Feb','Mar'] },
        { label: 'Q2', months: ['Apr','May','Jun'] },
        { label: 'Q3', months: ['Jul','Aug','Sep'] },
        { label: 'Q4', months: ['Oct','Nov','Dec'] },
      ]
      const deptSalary = salaryRows.filter(r => r.department === dept)
      fteDrivers = quarters.map(q => {
        const qRows = deptSalary.filter(r => q.months.includes(r.month))
        const fc  = qRows.reduce((a, r) => a + r[fcKey], 0) / CR
        const act = qRows.reduce((a, r) => a + r.actual, 0) / CR
        return { label: q.label, delta: act - fc }
      }).filter(d => Math.abs(d.delta) > 0.005)
    }

    return { pexFcTotal, pexActTotal, pexDrivers, opexFcTotal, opexActTotal, opexDrivers, fteFcTotal, fteActTotal, fteDrivers }
  }, [rawCost, year, scenario, dept, activeMonths])

  if (!waterfallData) return null

  const { pexFcTotal, pexActTotal, pexDrivers, opexFcTotal, opexActTotal, opexDrivers, fteFcTotal, fteActTotal, fteDrivers } = waterfallData
  const scLabel = scenario === 'fc1' ? 'FC1' : 'FC2'

  return (
    <div className="mt-7">
      <SectionHead num="06" title={`Driver-Based Cost Bridge · ${periodLabel}`}>
        Variance decomposed by business driver. Each waterfall bridges from the Forecast
        anchor to the Actual result - showing exactly which categories drove cost over- or under-spend.
      </SectionHead>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        {/* scenario toggle */}
        <div className="flex gap-1 bg-[var(--bg)] border border-[var(--line)] rounded-full p-0.5">
          {['fc1', 'fc2'].map(s => (
            <button key={s} onClick={() => setScenario(s)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition
                ${scenario === s ? 'bg-ink text-bg-light' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}>
              {s.toUpperCase()} vs Actual
            </button>
          ))}
        </div>

        {/* department selector */}
        <div className="flex flex-wrap gap-1.5">
          {departments.map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition
                ${d === dept
                  ? 'bg-ink text-bg-light border-ink'
                  : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'}`}>
              {d === 'All' ? 'All Departments' : d}
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 pt-1 text-[12px] text-[var(--ink-soft)]">
        <span className="font-semibold uppercase tracking-wider text-[10.5px]">Legend</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-2.5 rounded-sm" style={{ background: COL.anchor }} /> Forecast Anchor
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-2.5 rounded-sm" style={{ background: COL.anchorEnd }} /> Actual
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-2.5 rounded-sm" style={{ background: COL.down }} /> Under-spend (Saving)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-2.5 rounded-sm" style={{ background: COL.up }} /> Over-spend
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-0.5" style={{ background: COL.connHi }} /> Total Variance
        </span>
      </div>

      {/* three waterfalls */}
      <div className="space-y-5">
        <WaterfallChart
          title={`Salary Bridge · ${scLabel} → Actual`}
          unit="kEUR"
          fcTotal={fteFcTotal}
          actTotal={fteActTotal}
          drivers={fteDrivers}
        />
        <WaterfallChart
          title={`PEX (Personnel) · ${scLabel} → Actual`}
          unit="kEUR"
          fcTotal={pexFcTotal}
          actTotal={pexActTotal}
          drivers={pexDrivers}
        />
        <WaterfallChart
          title={`OPEX (Operating) · ${scLabel} → Actual`}
          unit="kEUR"
          fcTotal={opexFcTotal}
          actTotal={opexActTotal}
          drivers={opexDrivers}
        />
      </div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}
