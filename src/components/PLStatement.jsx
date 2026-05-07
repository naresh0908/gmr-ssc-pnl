import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { MONTHS } from '../utils/computeDerived'
import { getSectionInsights } from '../utils/sectionInsights'
import { QUARTERS, getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100

// ─── P&L computation ──────────────────────────────────────────────────────────
function buildPL(revenue, cost, year, months) {
  if (!months.length) return null
  const rev   = revenue.filter((r) => r.year === year && months.includes(r.month))
  const cst   = cost.filter((c)   => c.year === year && months.includes(c.month))
  const depts = [...new Set(revenue.filter((r) => r.year === year).map((r) => r.department))]
  const sumC  = (arr, fn) => r2(arr.reduce((s, x) => s + fn(x), 0) / CR)

  const pexR   = cst.filter((c) => c.costType === 'PEX')
  const opexR  = cst.filter((c) => c.costType === 'OPEX')
  const capexR = cst.filter((c) => c.costType === 'CAPEX')

  const pex   = { act: -sumC(pexR,   (c) => c.actual), fc1: -sumC(pexR,   (c) => c.fc1), fc2: -sumC(pexR,   (c) => c.fc2) }
  const opex  = { act: -sumC(opexR,  (c) => c.actual), fc1: -sumC(opexR,  (c) => c.fc1), fc2: -sumC(opexR,  (c) => c.fc2) }
  const capex = { act: -sumC(capexR, (c) => c.actual), fc1: -sumC(capexR, (c) => c.fc1), fc2: -sumC(capexR, (c) => c.fc2) }

  const sfByDept = depts.map((dept) => {
    const dRev = rev.filter((r) => r.department === dept)
    return {
      dept,
      act: sumC(dRev, (r) => r.actServiceFees),
      fc1: sumC(dRev, (r) => r.fc1ServiceFees),
      fc2: sumC(dRev, (r) => r.fc2ServiceFees),
    }
  })
  const sfTotal   = {
    act: r2(sfByDept.reduce((s, d) => s + d.act, 0)),
    fc1: r2(sfByDept.reduce((s, d) => s + d.fc1, 0)),
    fc2: r2(sfByDept.reduce((s, d) => s + d.fc2, 0)),
  }
  const otherInc  = { act: sumC(rev, (r) => r.actOtherIncome), fc1: sumC(rev, (r) => r.fc1OtherIncome), fc2: sumC(rev, (r) => r.fc2OtherIncome) }
  const ebit      = { act: r2(sfTotal.act + otherInc.act + pex.act + opex.act), fc1: r2(sfTotal.fc1 + otherInc.fc1 + pex.fc1 + opex.fc1), fc2: r2(sfTotal.fc2 + otherInc.fc2 + pex.fc2 + opex.fc2) }
  const interest  = { act: sumC(rev, (r) => r.actInterest), fc1: sumC(rev, (r) => r.fc1Interest), fc2: sumC(rev, (r) => r.fc2Interest) }
  const tax       = { act: -sumC(rev, (r) => r.actTax), fc1: -sumC(rev, (r) => r.fc1Tax), fc2: -sumC(rev, (r) => r.fc2Tax) }
  const finResult = { act: r2(interest.act + tax.act), fc1: r2(interest.fc1 + tax.fc1), fc2: r2(interest.fc2 + tax.fc2) }
  const netResult = { act: r2(ebit.act + finResult.act), fc1: r2(ebit.fc1 + finResult.fc1), fc2: r2(ebit.fc2 + finResult.fc2) }

  return { pex, opex, capex, sfByDept, sfTotal, otherInc, ebit, interest, tax, finResult, netResult, depts }
}

const fv   = (v) => (v == null ? '—' : v.toFixed(2))
const vcls = (v) =>
  v > 0.005 ? 'text-brand-green font-semibold' : v < -0.005 ? 'text-brand-red font-semibold' : 'text-[var(--muted)]'

// ─── Main component ───────────────────────────────────────────────────────────
export default function PLStatement() {
  const {
    rawRevenue, rawCost, derived, year,
    periodMode, selectedQ, selectedPeriodMonth,
  } = useDashStore()

  const insights = useMemo(
    () => getSectionInsights('pl', { derived, year, rawRevenue, rawCost }),
    [derived, year, rawRevenue, rawCost]
  )

  const availMonths = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )

  // ── Derived sets ─────────────────────────────────────────────────────────────
  // For month mode: left = MTD, right = YTD
  // For quarter mode: left = QTD, right = YTD to end of quarter
  // For year mode: left only = full year
  const isYear    = periodMode === 'year'
  const isQuarter = periodMode === 'quarter'
  const isMonth   = periodMode === 'month'

  // YTD for month/quarter modes
  const ytdEndMonth  = isMonth
    ? selectedPeriodMonth
    : isQuarter ? (QUARTERS[selectedQ]?.[2] ?? 'Dec') : null

  const ytdMonths = ytdEndMonth
    ? MONTHS.slice(0, MONTHS.indexOf(ytdEndMonth) + 1).filter((m) => availMonths.includes(m))
    : []

  const leftData  = useMemo(() => buildPL(rawRevenue, rawCost, year, isYear ? availMonths : activeMonths), [rawRevenue, rawCost, year, isYear, availMonths, activeMonths])
  const rightData = useMemo(() => (!isYear && ytdMonths.length ? buildPL(rawRevenue, rawCost, year, ytdMonths) : null), [rawRevenue, rawCost, year, isYear, ytdMonths])
  const fullYear  = useMemo(() => buildPL(rawRevenue, rawCost, year, availMonths), [rawRevenue, rawCost, year, availMonths])

  if (!leftData || !fullYear) return null

  const colCount  = isYear ? 6 : 11
  const leftLabel = isYear
    ? `FY ${year} · Full Year`
    : isMonth
      ? `MTD · ${selectedPeriodMonth}`
      : `QTD · ${selectedQ}`
  const rightLabel = isMonth
    ? `YTD · Jan – ${selectedPeriodMonth}`
    : `YTD · Jan – ${ytdEndMonth}`

  return (
    <div className="mt-7">
      <SectionHead num="01" title={`P&L Statement · FY ${year}`}>
        {getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)} · Actuals vs FC1 and FC2. All figures ₹ Cr.
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--line)]">
                <th className="text-left p-3 px-5 text-[10.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-[.12em] min-w-[220px]" />
                <th colSpan={5} className={`text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-amber ${!isYear ? 'border-r-2 border-[var(--line)]' : ''}`}>
                  {leftLabel} · FY {year}
                </th>
                {!isYear && (
                  <th colSpan={5} className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-blue">
                    {rightLabel} · FY {year}
                  </th>
                )}
              </tr>
              <tr className="border-b-2 border-[var(--line)] bg-[var(--bg)]">
                <th className="py-2 px-5 text-left text-[10.5px] font-semibold tracking-[.12em] uppercase text-[var(--ink-soft)]">P&L Line</th>
                <SubHeaders divider={!isYear} />
                {!isYear && <SubHeaders divider={false} />}
              </tr>
            </thead>

            <tbody>
              <SectionBanner label="OPERATING COSTS" color="bg-brand-red/[.07]"   textColor="text-brand-red"   colSpan={colCount} />
              <Row kind="cost"      label="PEX · Personnel Expenses"   left={leftData.pex}       right={rightData?.pex}       compact={isYear} />
              <Row kind="cost"      label="OPEX · Operating Expenses"  left={leftData.opex}      right={rightData?.opex}      compact={isYear} />
              <Divider colSpan={colCount} />

              <SectionBanner label="REVENUE" color="bg-brand-green/[.07]" textColor="text-brand-green" colSpan={colCount} />
              <Row kind="revenue"   label="Service Fee Income"         left={leftData.sfTotal}   right={rightData?.sfTotal}   compact={isYear} />
              {fullYear.depts.map((dept) => {
                const ld = leftData.sfByDept.find((d) => d.dept === dept)  || { act: 0, fc1: 0, fc2: 0 }
                const rd = rightData?.sfByDept.find((d) => d.dept === dept) || { act: 0, fc1: 0, fc2: 0 }
                return <Row key={dept} kind="dept" label={dept} left={ld} right={isYear ? null : rd} compact={isYear} />
              })}
              <Row kind="revenue"   label="Other Income"               left={leftData.otherInc}  right={rightData?.otherInc}  compact={isYear} />
              <Divider thick colSpan={colCount} />

              <Row kind="ebit"      label="EBIT"                       left={leftData.ebit}      right={rightData?.ebit}      compact={isYear} />
              <Divider colSpan={colCount} />

              <SectionBanner label="FINANCIAL RESULT" color="bg-brand-blue/[.05]" textColor="text-brand-blue" colSpan={colCount} />
              <Row kind="financial" label="Interest Income"            left={leftData.interest}  right={rightData?.interest}  compact={isYear} />
              <Row kind="tax"       label="Income Tax"                 left={leftData.tax}       right={rightData?.tax}       compact={isYear} />
              <Row kind="financial" label="Financial Result"           left={leftData.finResult} right={rightData?.finResult} compact={isYear} />
              <Divider thick colSpan={colCount} />

              <Row kind="result"    label="NET RESULT"                 left={leftData.netResult} right={rightData?.netResult} compact={isYear} />
              <Divider thick colSpan={colCount} />

              <Row kind="capex"     label="CAPEX (below the line)"    left={leftData.capex}     right={rightData?.capex}     compact={isYear} />
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] text-[11px] text-[var(--muted)] font-mono flex gap-6 flex-wrap items-center">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block" /> Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block" /> Cost</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block opacity-50" /> Var: favorable</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block opacity-50" /> Var: unfavorable</span>
          <span className="ml-auto">EBIT = Revenue − PEX − OPEX · Net Result = EBIT + Financial Result · All ₹ Cr</span>
        </div>
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SubHeaders({ divider }) {
  return (
    <>
      <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber    min-w-[80px]">Actual</th>
      <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC1</th>
      <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-green    min-w-[72px]">Var·F1</th>
      <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC2</th>
      <th className={`py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue min-w-[72px] ${divider ? 'border-r-2 border-[var(--line)]' : ''}`}>
        Var·F2
      </th>
    </>
  )
}

function SectionBanner({ label, color, textColor, colSpan }) {
  return (
    <tr><td colSpan={colSpan} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${color} ${textColor}`}>{label}</td></tr>
  )
}

function Row({ label, left, right, kind = 'neutral', compact = false }) {
  if (!left) return null

  const var1L = r2(left.act - left.fc1), var2L = r2(left.act - left.fc2)
  const var1R = right ? r2(right.act - right.fc1) : 0
  const var2R = right ? r2(right.act - right.fc2) : 0

  const isSubtotal = kind === 'ebit' || kind === 'result'
  const rowCls = isSubtotal ? 'bg-[var(--bg)] border-y-2 border-[var(--line)]' : 'border-b border-[var(--line)] hover:bg-[var(--bg)]/60 transition-colors'

  const labelPad  = kind === 'dept' ? 'py-2 pl-12 pr-5' : 'py-2.5 px-5'
  const labelText =
    kind === 'cost'      ? 'text-[12.5px] font-semibold text-brand-red' :
    kind === 'revenue'   ? 'text-[12.5px] font-semibold text-brand-green' :
    kind === 'dept'      ? 'text-[11.5px] text-brand-green/80' :
    kind === 'ebit'      ? 'text-[13px] font-bold text-brand-blue uppercase tracking-[.05em]' :
    kind === 'result'    ? 'text-[13.5px] font-bold text-[var(--ink)] uppercase tracking-[.05em]' :
    kind === 'capex'     ? 'text-[12px] text-[var(--muted)] italic' :
    kind === 'tax'       ? 'text-[12.5px] text-brand-amber' :
    kind === 'financial' ? 'text-[12.5px] text-brand-blue' : 'text-[12.5px] text-[var(--ink)]'

  const actCol = (v) => {
    if (kind === 'cost' || kind === 'capex')   return 'text-brand-red font-semibold'
    if (kind === 'revenue' || kind === 'dept') return 'text-brand-green font-semibold'
    if (kind === 'ebit' || kind === 'result')  return v >= 0 ? 'text-brand-blue font-bold' : 'text-brand-red font-bold'
    if (kind === 'tax')       return 'text-brand-amber font-semibold'
    if (kind === 'financial') return 'text-brand-blue'
    return 'text-[var(--ink)]'
  }

  const numSz  = isSubtotal ? 'text-[13px]' : 'text-[12px]'
  const fcText = isSubtotal ? 'text-[13px] text-[var(--ink-soft)] font-medium' : 'text-[12px] text-[var(--ink-soft)]'

  const cells = (data, v1, v2, divider) => (
    <>
      <td className={`py-2.5 px-3 text-right font-mono ${numSz} ${actCol(data.act)}`}>{fv(data.act)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(data.fc1)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(v1)}`}>{fv(v1)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(data.fc2)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${divider ? 'border-r-2 border-[var(--line)]' : ''} ${vcls(v2)}`}>{fv(v2)}</td>
    </>
  )

  return (
    <tr className={rowCls}>
      <td className={`${labelPad} ${labelText}`}>{label}</td>
      {cells(left, var1L, var2L, !compact && right != null)}
      {!compact && right && cells(right, var1R, var2R, false)}
    </tr>
  )
}

function Divider({ thick, colSpan = 11 }) {
  return (
    <tr><td colSpan={colSpan} className={thick ? 'h-[3px] bg-[var(--line)]' : 'h-px bg-[var(--line)] opacity-40'} /></tr>
  )
}
