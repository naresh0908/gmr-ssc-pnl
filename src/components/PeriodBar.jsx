import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import { MONTHS } from '../utils/computeDerived'
import { QUARTERS, getAvailMonths } from '../utils/periodUtils'

export default function PeriodBar() {
  const {
    rawRevenue, year,
    periodMode, selectedQ, selectedPeriodMonth,
    setPeriodMode, setSelectedQ, setSelectedPeriodMonth,
  } = useDashStore()

  const availMonths = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const monthHasActual = useMemo(
    () => Object.fromEntries(MONTHS.map((m) => [m, availMonths.includes(m)])),
    [availMonths]
  )

  const availQuarters = useMemo(
    () => Object.keys(QUARTERS).filter((q) => QUARTERS[q].some((m) => availMonths.includes(m))),
    [availMonths]
  )

  const isYear = periodMode === 'year'

  return (
    <div className="mt-3 md:mt-5 flex items-center gap-1 px-1 py-1.5 bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-x-auto">
      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)] px-1.5 md:px-2 select-none shrink-0">
        Period
      </span>

      {/* Full-year pill */}
      <button
        onClick={() => setPeriodMode('year')}
        className={pill(isYear)}
      >
        Full Year
      </button>

      <div className="w-px h-4 bg-[var(--line)] mx-0.5 shrink-0" />

      {/* Quarter buttons */}
      {Object.keys(QUARTERS).map((q) => {
        const hasActuals = availQuarters.includes(q)
        return (
        <button
          key={q}
          onClick={() => hasActuals && setSelectedQ(q)}
          disabled={!hasActuals}
          className={`${pill(periodMode === 'quarter' && selectedQ === q)} ${!hasActuals ? 'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-[var(--ink-soft)]' : ''}`}
          title={hasActuals ? q : `${q} - forecast only`}
        >
          {q}
        </button>
        )
      })}

      <div className="w-px h-4 bg-[var(--line)] mx-0.5 shrink-0" />

      {/* Month buttons */}
      {MONTHS.map((m) => {
        const hasActuals = monthHasActual[m]
        return (
          <button
            key={m}
            onClick={() => hasActuals && setSelectedPeriodMonth(m)}
            disabled={!hasActuals}
            className={`${pill(periodMode === 'month' && selectedPeriodMonth === m)} ${!hasActuals ? 'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-[var(--ink-soft)]' : ''}`}
            title={hasActuals ? m : `${m} - forecast only`}
          >
            {m}
          </button>
        )
      })}
    </div>
  )
}

const pill = (active) =>
  active
    ? 'px-2.5 md:px-3 py-1 text-[9px] md:text-[11px] font-semibold font-mono rounded-full bg-brand-blue text-white transition-all whitespace-nowrap'
    : 'px-2.5 md:px-3 py-1 text-[9px] md:text-[11px] font-semibold font-mono rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-all whitespace-nowrap'
