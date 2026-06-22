import { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths } from '../utils/periodUtils'
import { MONTHS } from '../utils/computeDerived'

const MONTH_DAYS = {
  Jan: 31, Feb: 28, Mar: 31, Apr: 30, May: 31, Jun: 30,
  Jul: 31, Aug: 31, Sep: 30, Oct: 31, Nov: 30, Dec: 31,
}
const ALL = 'All'

export default function FilterBar() {
  const {
    rawRevenue, year,
    fromMonth, toMonth, customer, projectStatus,
    customers, projectStatuses,
    setRange, setCustomer, setProjectStatus,
  } = useDashStore()

  const availMonths = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const labels = availMonths.length ? availMonths : MONTHS

  // Indices into the labels array (0..labels.length-1)
  const fromIdx = Math.max(0, labels.indexOf(fromMonth))
  const toIdx = Math.max(fromIdx, labels.indexOf(toMonth) === -1 ? labels.length - 1 : labels.indexOf(toMonth))

  const onFromChange = (e) => {
    const idx = Number(e.target.value)
    const newFrom = labels[idx]
    const newTo = idx > toIdx ? newFrom : toMonth
    setRange(newFrom, newTo)
  }
  const onToChange = (e) => {
    const idx = Number(e.target.value)
    const newTo = labels[idx]
    const newFrom = idx < fromIdx ? newTo : fromMonth
    setRange(newFrom, newTo)
  }

  const rangeText = `${labels[fromIdx]} ${year} → ${MONTH_DAYS[labels[toIdx]] ?? ''} ${labels[toIdx]} ${year}`.replace(/^\s+/, '')
  const fromLabel = `${labels[fromIdx]} ${year}`
  const toLabel = `${MONTH_DAYS[labels[toIdx]]} ${labels[toIdx]} ${year}`

  const statusOptions = [ALL, ...projectStatuses.filter((s) => s)]
  const customerOptions = [ALL, ...customers]

  return (
    <div className="mt-3 md:mt-5 bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start">
      {/* Snapshot Date Range — two stacked sliders */}
      <div className="md:col-span-5">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
            Snapshot Date Range
          </span>
          <span className="text-[11px] md:text-[12px] font-mono font-semibold text-brand-blue whitespace-nowrap">
            {fromLabel} → {toLabel}
          </span>
        </div>

        <DualSlider
          fromIdx={fromIdx}
          toIdx={toIdx}
          max={labels.length - 1}
          onFromChange={onFromChange}
          onToChange={onToChange}
        />

        <div className="grid mt-2 text-[10px] md:text-[11px] font-mono text-[var(--muted)]" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
          {labels.map((m, i) => (
            <span
              key={m}
              className={`text-center ${i === fromIdx || i === toIdx ? 'text-[var(--ink)] font-semibold' : ''}`}
            >
              {labels.length > 6 ? m : `${MONTH_DAYS[m]} ${m}`}
            </span>
          ))}
        </div>
      </div>

      {/* Customer dropdown */}
      <div className="md:col-span-3">
        <span className="block text-[10px] md:text-[11px] font-bold uppercase tracking-[.18em] text-[var(--muted)] mb-2">
          Customer
        </span>
        <Dropdown
          value={customer}
          options={customerOptions}
          onChange={setCustomer}
          placeholder="All customers"
        />
      </div>

      {/* Project Status pills */}
      <div className="md:col-span-4">
        <span className="block text-[10px] md:text-[11px] font-bold uppercase tracking-[.18em] text-[var(--muted)] mb-2">
          Project Status
        </span>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {statusOptions.map((s) => {
            const active = projectStatus === s || (s === ALL && (!projectStatus || projectStatus === ALL))
            return (
              <button
                key={s}
                onClick={() => setProjectStatus(s)}
                className={`px-3 md:px-3.5 py-1.5 md:py-2 rounded-[8px] text-[11px] md:text-[12px] font-semibold border transition whitespace-nowrap ${
                  active
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                    : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'
                }`}
              >
                {s === ALL ? 'All Projects' : s}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DualSlider({ fromIdx, toIdx, max, onFromChange, onToChange }) {
  const pct = (idx) => max === 0 ? 0 : (idx / max) * 100
  const leftPct = pct(Math.min(fromIdx, toIdx))
  const rightPct = pct(Math.max(fromIdx, toIdx))
  return (
    <div className="relative h-9 md:h-10">
      {/* Track */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[var(--line)]" />
      {/* Filled range */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-brand-blue"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* From slider */}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={fromIdx}
        onChange={onFromChange}
        className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        style={{ zIndex: 3 }}
      />
      {/* To slider */}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={toIdx}
        onChange={onToChange}
        className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        style={{ zIndex: 4 }}
      />
    </div>
  )
}

function Dropdown({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const isAll = !value || value === ALL
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 md:px-4 py-2 md:py-2.5 rounded-full bg-[var(--bg)] border border-[var(--line)] text-[12px] md:text-[13px] text-[var(--ink)] hover:border-[var(--ink)] transition"
      >
        <span className={isAll ? 'text-[var(--muted)]' : ''}>{isAll ? placeholder : value}</span>
        <ChevronDown size={14} className="text-[var(--muted)]" />
      </button>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1.5 bg-[var(--card)] border border-[var(--line)] rounded-[12px] shadow-lg overflow-hidden">
          {options.map((opt) => {
            const selected = (opt === ALL && isAll) || opt === value
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-[12px] md:text-[13px] text-left transition ${
                  selected ? 'bg-[var(--bg)] text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:bg-[var(--bg)]'
                }`}
              >
                <span>{opt === ALL ? placeholder : opt}</span>
                {selected && <Check size={12} className="text-brand-blue" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
