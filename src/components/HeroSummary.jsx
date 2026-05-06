import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'

export default function HeroSummary() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null

  const k = Y.kpis
  const revGap = (k.totalRevenue - k.revFc1).toFixed(1)
  const revGapFc2 = (k.totalRevenue - k.revFc2).toFixed(1)
  const yoy = k.yoyGrowth   // undefined for the base year
  const isBaseYear = yoy == null

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
          FY {year} · Executive Summary
        </div>
        <h2 className="font-display font-normal text-[42px] leading-[1.05] tracking-[-1px] mt-2.5 mb-1.5 relative">
          {isBaseYear ? (
            <>FY {year} –{' '}<em className="not-italic text-brand-blue font-medium italic">base year</em>,<br /></>
          ) : (
            <>Revenue {yoy >= 0 ? 'up' : 'down'}{' '}<em className="not-italic text-brand-blue font-medium italic">{Math.abs(yoy).toFixed(1)}%</em>,<br /></>
          )}
          execution {revGap < 0 ? 'trailing' : 'beating'} plan by{' '}
          <em className="not-italic text-brand-blue font-medium italic">
            ₹{Math.abs(revGap)} Cr
          </em>
          .
        </h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-soft)] max-w-[60ch] leading-[1.55] relative">
          Actuals are running {revGap < 0 ? 'below' : 'above'} FC1 across service lines, primarily driven by hiring
          timing and CAPEX deferrals, partially offset by OPEX discipline. FC2 was already revised — actuals are now
          tracking close to FC2.
        </p>
        <div className="mt-5 flex flex-wrap gap-5 text-[12px] text-[var(--muted)] relative">
          <span>Reporting period · <b className="text-[var(--ink)] font-semibold">Jan – Dec {year}</b></span>
          <span>Departments · <b className="text-[var(--ink)] font-semibold">{derived.departments.length}</b></span>
          <span>Cost lines · <b className="text-[var(--ink)] font-semibold">15</b></span>
        </div>
      </div>

      <div className="rounded-[18px] p-6 text-[#F6F4EE] flex flex-col justify-between"
           style={{ background: 'linear-gradient(135deg,#0E1116 0%,#1A2030 100%)' }}>
        <div className="text-[11px] tracking-[.18em] uppercase text-[#9AA4B5] font-semibold">
          Executive Verdict
        </div>
        <div className="font-display text-[24px] leading-[1.25] font-normal my-3">
          {revGap < 0 && yoy >= 0
            ? <>Plan was ambitious. <em className="not-italic italic text-[#7BB0FF]">Execution is steady but conservative.</em></>
            : revGap > 0
            ? <>Beating plan — <em className="not-italic italic text-[#7BB0FF]">lock in baseline upgrade for next year.</em></>
            : <>Year held flat — <em className="not-italic italic text-[#7BB0FF]">growth pipeline needs attention.</em></>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Pill label="Actual vs FC1" value={`₹${revGap} Cr`} dir={revGap < 0 ? 'down' : 'up'} />
          <Pill label="Actual vs FC2" value={`₹${revGapFc2} Cr`} dir={revGapFc2 < 0 ? 'down' : 'up'} />
          <Pill
            label="YoY Growth"
            value={isBaseYear ? '— N/A' : `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`}
            dir={isBaseYear ? 'neutral' : yoy >= 0 ? 'up' : 'down'}
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
      <span className={`font-mono font-semibold ${color}`}>
        {arrow}{arrow ? ' ' : ''}{value}
      </span>
    </span>
  )
}
