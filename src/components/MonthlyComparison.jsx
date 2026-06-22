import { useMemo, useState } from 'react'
import { useDashStore } from '../store/useDashStore'
import { MONTHS } from '../utils/computeDerived'

const METRICS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'cost',    label: 'Cost' },
  { key: 'margin',  label: 'Margin' },
  { key: 'ratio',   label: 'Cost/Rev %' },
]

const TITLE_COLOR = '#0F2747'

const fmtNumber = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const fmtRupee = (n) => `₹${fmtNumber(n)}`
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`

const subtitleFor = (metric) => {
  switch (metric) {
    case 'cost':    return 'Per-month cost compared across years (year-over-year growth)'
    case 'margin':  return 'Per-month margin compared across years (year-over-year growth)'
    case 'ratio':   return 'Per-month cost-to-revenue ratio compared across years (year-over-year change)'
    default:        return 'Per-month revenue compared across years (year-over-year growth)'
  }
}

export default function MonthlyComparison() {
  const { derived, year: globalYear } = useDashStore()
  const years = derived.years
  if (!years || years.length === 0) return null

  const [metric, setMetric] = useState('revenue')
  // Default: earliest year on the left, latest year on the right (2024 → 2026).
  const initialYearA = years[0]
  const initialYearB = years.length > 1 ? years.at(-1) : years[0]
  const [yearA, setYearA] = useState(initialYearA)
  const [yearB, setYearB] = useState(initialYearB)

  // Build per-month values for both years for the chosen metric
  const { rowsA, rowsB } = useMemo(() => {
    const monthlyByYear = (y) => derived.byYear[y]?.monthly ?? []
    const valueFor = (row) => {
      if (!row) return 0
      if (metric === 'revenue') return row.revAct
      if (metric === 'cost')    return row.costAct
      if (metric === 'margin')  return (row.revAct ?? 0) - (row.costAct ?? 0)
      // ratio = cost ÷ revenue (%) — guard against divide-by-zero
      return row.revAct > 0 ? (row.costAct / row.revAct) * 100 : 0
    }
    const mapYear = (y) => {
      const monthly = monthlyByYear(y)
      return Object.fromEntries(MONTHS.map((m) => {
        const r = monthly.find((x) => x.month === m)
        return [m, r ? valueFor(r) : 0]
      }))
    }
    return { rowsA: mapYear(yearA), rowsB: mapYear(yearB) }
  }, [derived, metric, yearA, yearB])

  // For bar widths: scale to the max value across both years for fair comparison
  const maxValue = useMemo(() => {
    const all = [...Object.values(rowsA), ...Object.values(rowsB)].map((v) => Math.abs(v))
    return Math.max(1, ...all)
  }, [rowsA, rowsB])

  const isPercent = metric === 'ratio'
  const fmtValue = (v) => {
    if (isPercent) return fmtPct(v)
    // Display in raw rupees (image style) — multiply Cr → ₹ when value < 1000
    const raw = v * 1e7   // monthly values are in Cr; image shows ₹ amounts
    if (Math.abs(raw) >= 1_00_00_000) return `₹${(raw / 1_00_00_000).toFixed(2)} Cr`
    if (Math.abs(raw) >= 1_00_000)    return `₹${(raw / 1_00_000).toFixed(2)} L`
    return fmtRupee(raw)
  }

  // YoY: percentage change from yearA → yearB
  const yoyFor = (m) => {
    const a = rowsA[m] ?? 0
    const b = rowsB[m] ?? 0
    if (Math.abs(a) < 1e-9) return null
    return ((b - a) / Math.abs(a)) * 100
  }

  return (
    <div
      className="mt-4 md:mt-5 rounded-[18px] border border-[var(--line)] p-5 md:p-6"
      style={{ background: 'var(--card)' }}
    >
      {/* Header */}
      <div className="pb-4 md:pb-5 border-b border-[var(--line)]">
        <h3 className="font-display font-bold text-[16px] md:text-[19px] tracking-tight" style={{ color: TITLE_COLOR }}>
          Monthly Performance Comparison
        </h3>
        <p className="text-[11.5px] md:text-[12.5px] text-[var(--muted)] mt-1">
          {subtitleFor(metric)}
        </p>
      </div>

      {/* Controls: metric tabs + year selectors */}
      <div className="flex flex-wrap items-center gap-4 md:gap-7 py-4 md:py-5">
        <div className="inline-flex rounded-[12px] border border-[var(--line)] p-1 bg-[var(--bg)]">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 md:px-4 py-1.5 text-[12px] md:text-[13px] font-semibold rounded-[8px] transition ${
                metric === m.key
                  ? 'bg-white text-brand-blue shadow-[0_1px_2px_rgba(15,39,71,0.08)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <YearPicker label="Year:" value={yearA} options={years} onChange={setYearA} />
        <YearPicker label="Compare with:" value={yearB} options={years} onChange={setYearB} />
      </div>

      {/* Table */}
      <div className="grid grid-cols-[80px_1fr_1fr_100px] md:grid-cols-[110px_1fr_1fr_120px] gap-x-4 md:gap-x-6 items-center text-[11px] md:text-[12px] uppercase tracking-[.18em] text-[var(--muted)] font-semibold border-b border-[var(--line)] pb-2.5">
        <div>Month</div>
        <div className="text-center">{yearA}</div>
        <div className="text-center">{yearB}</div>
        <div className="text-right">YOY</div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {MONTHS.map((m) => {
          const a = rowsA[m] ?? 0
          const b = rowsB[m] ?? 0
          const yoy = yoyFor(m)
          if (a === 0 && b === 0) return null  // skip rows with no data either side
          return (
            <Row
              key={m}
              month={m}
              valueA={a}
              valueB={b}
              maxValue={maxValue}
              fmt={fmtValue}
              yoy={yoy}
              lowerIsBetter={metric === 'cost' || metric === 'ratio'}
            />
          )
        })}
      </div>
    </div>
  )
}

function YearPicker({ label, value, options, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] md:text-[13px] text-[var(--ink-soft)] font-medium">
      <span>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="appearance-none pr-7 pl-3 py-1.5 rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] font-semibold text-[12.5px] md:text-[13px] focus:outline-none focus:border-brand-blue cursor-pointer"
        >
          {options.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px]">▾</span>
      </div>
    </label>
  )
}

function Row({ month, valueA, valueB, maxValue, fmt, yoy, lowerIsBetter }) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr_100px] md:grid-cols-[110px_1fr_1fr_120px] gap-x-4 md:gap-x-6 items-center py-4 md:py-5">
      <div className="font-bold text-[12.5px] md:text-[13.5px] tracking-[.16em] text-[var(--ink)] uppercase">
        {month}
      </div>
      <Bar value={valueA} maxValue={maxValue} fmt={fmt} />
      <Bar value={valueB} maxValue={maxValue} fmt={fmt} />
      <YoyBadge value={yoy} lowerIsBetter={lowerIsBetter} />
    </div>
  )
}

function Bar({ value, maxValue, fmt }) {
  const pct = maxValue > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / maxValue) * 100)) : 0
  const text = fmt(value)
  // Show label inside the bar when wide enough, otherwise just to its right
  const labelInside = pct > 28
  return (
    <div className="relative w-full">
      <div className="h-9 md:h-10 rounded-[8px] bg-[var(--bg)] overflow-hidden">
        <div
          className="h-full rounded-[8px] flex items-center justify-end pr-3 text-white font-bold text-[12px] md:text-[13px] tracking-wide"
          style={{ width: `${pct}%`, background: '#1F6FEB' }}
        >
          {labelInside && <span>{text}</span>}
        </div>
      </div>
      {!labelInside && (
        <span
          className="absolute top-1/2 -translate-y-1/2 text-[12px] md:text-[13px] text-[var(--ink-soft)] font-semibold"
          style={{ left: `calc(${pct}% + 8px)` }}
        >
          {text}
        </span>
      )}
    </div>
  )
}

function YoyBadge({ value, lowerIsBetter = false }) {
  if (value == null || !isFinite(value)) {
    return <div className="text-right text-[12px] text-[var(--muted)]">–</div>
  }
  const positive = value >= 0
  // For cost / cost-to-revenue ratio, a lower number is better, so invert the color.
  const isGood = lowerIsBetter ? !positive : positive
  return (
    <div className="flex justify-end">
      <span
        className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-[8px] text-[12px] md:text-[13px] font-bold tracking-wide ${
          isGood ? 'bg-[#DCF1E2] text-[#1F8A4C]' : 'bg-[#FAE3E3] text-[#C0392B]'
        }`}
      >
        {positive ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  )
}
