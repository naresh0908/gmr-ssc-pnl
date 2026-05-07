import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel, derivePeriodKPIs } from '../utils/periodUtils'

export default function HeroSummary() {
  const { derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const pk          = useMemo(() => derivePeriodKPIs(Y.monthly, activeMonths) ?? Y.kpis, [Y.monthly, Y.kpis, activeMonths])
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  const revGap    = (pk.totalRevenue - (pk.revFc1  ?? 0)).toFixed(1)
  const revGapFc2 = (pk.totalRevenue - (pk.revFc2  ?? 0)).toFixed(1)
  const yoy       = periodMode === 'year' ? Y.kpis.yoyGrowth : null  // YoY only meaningful in full-year mode

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="mt-7 grid lg:grid-cols-[1.4fr_1fr] grid-cols-1 gap-6"
    >
      <div className="relative overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--card)] p-7">
        <div
          className="absolute inset-0 pointer-events-none opacity-70"
          style={{ background: 'radial-gradient(400px 200px at 100% 0%, rgba(31,111,235,.08), transparent 70%)' }}
        />
        <div className="text-[11px] tracking-[.18em] uppercase text-[var(--muted)] font-semibold relative">
          {periodLabel} · Executive Summary
        </div>
        <h2 className="font-display font-normal text-[42px] leading-[1.05] tracking-[-1px] mt-2.5 mb-1.5 relative">
          {yoy != null ? (
            <>Revenue {yoy >= 0 ? 'up' : 'down'}{' '}
              <em className="not-italic text-brand-blue font-medium italic">{Math.abs(yoy).toFixed(1)}%</em>,<br /></>
          ) : (
            <>Revenue{' '}
              <em className="not-italic text-brand-blue font-medium italic">₹{pk.totalRevenue.toFixed(1)} Cr</em>,<br /></>
          )}
          execution {Number(revGap) < 0 ? 'trailing' : 'beating'} plan by{' '}
          <em className="not-italic text-brand-blue font-medium italic">₹{Math.abs(Number(revGap))} Cr</em>.
        </h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-soft)] max-w-[60ch] leading-[1.55] relative">
          {periodMode === 'year'
            ? 'Actuals are running ' + (Number(revGap) < 0 ? 'below' : 'above') + ' FC1 across service lines, primarily driven by hiring timing and CAPEX deferrals. FC2 was already revised - actuals are tracking close to FC2.'
            : `Showing ${periodLabel} actuals. Net profit ₹${pk.netProfit.toFixed(1)} Cr vs FC1 ₹${(pk.netProfitFc1 ?? 0).toFixed(1)} Cr / FC2 ₹${(pk.netProfitFc2 ?? 0).toFixed(1)} Cr.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-5 text-[12px] text-[var(--muted)] relative">
          <span>Reporting period · <b className="text-[var(--ink)] font-semibold">{periodLabel}</b></span>
          <span>Departments · <b className="text-[var(--ink)] font-semibold">{derived.departments.length}</b></span>
          <span>Cost lines · <b className="text-[var(--ink)] font-semibold">15</b></span>
        </div>
      </div>

      <div className="rounded-[18px] p-6 text-[#F6F4EE] flex flex-col justify-between"
           style={{ background: 'linear-gradient(135deg,#0E1116 0%,#1A2030 100%)' }}>
        <div className="text-[11px] tracking-[.18em] uppercase text-[#9AA4B5] font-semibold">
          Executive Verdict · {periodLabel}
        </div>
        <div className="font-display text-[24px] leading-[1.25] font-normal my-3">
          {Number(revGap) < 0 && (yoy == null || yoy >= 0)
            ? <>Plan was ambitious.{' '}<em className="not-italic italic text-[#7BB0FF]">Execution is steady but conservative.</em></>
            : Number(revGap) > 0
            ? <>Beating plan -{' '}<em className="not-italic italic text-[#7BB0FF]">lock in baseline upgrade for next year.</em></>
            : <>Period held flat -{' '}<em className="not-italic italic text-[#7BB0FF]">growth pipeline needs attention.</em></>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Pill label="Actual vs FC1" value={`₹${revGap} Cr`}    dir={Number(revGap)    < 0 ? 'down' : 'up'} />
          <Pill label="Actual vs FC2" value={`₹${revGapFc2} Cr`} dir={Number(revGapFc2) < 0 ? 'down' : 'up'} />
          <Pill
            label={yoy != null ? 'YoY Growth' : 'Net Profit'}
            value={yoy != null ? `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%` : `₹${pk.netProfit.toFixed(1)} Cr`}
            dir={yoy != null ? (yoy >= 0 ? 'up' : 'down') : (pk.netProfit >= 0 ? 'up' : 'down')}
          />
        </div>
      </div>
    </motion.div>
  )
}

function Pill({ label, value, dir }) {
  const color = dir === 'up' ? 'text-[#7DDBA0]' : dir === 'down' ? 'text-[#FF7A7A]' : 'text-[#9AA4B5]'
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''
  return (
    <span className="bg-white/5 border border-white/10 px-3 py-2 rounded-[10px] text-[12.5px] text-[#E8ECF3] inline-flex items-center gap-2">
      <span>{label}</span>
      <span className={`font-mono font-semibold ${color}`}>{arrow}{arrow ? ' ' : ''}{value}</span>
    </span>
  )
}
