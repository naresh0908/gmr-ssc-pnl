import { useState, useEffect, useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { MONTHS } from '../utils/computeDerived'
import { getSectionInsights } from '../utils/sectionInsights'

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100

// ─── P&L computation ──────────────────────────────────────────────────────────
function buildPL(revenue, cost, year, months) {
  if (!months.length) return null
  const rev = revenue.filter((r) => r.year === year && months.includes(r.month))
  const cst = cost.filter((c) => c.year === year && months.includes(c.month))
  const depts = [...new Set(revenue.filter((r) => r.year === year).map((r) => r.department))]
  const sumC = (arr, fn) => r2(arr.reduce((s, x) => s + fn(x), 0) / CR)

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
  const sfTotal = {
    act: r2(sfByDept.reduce((s, d) => s + d.act, 0)),
    fc1: r2(sfByDept.reduce((s, d) => s + d.fc1, 0)),
    fc2: r2(sfByDept.reduce((s, d) => s + d.fc2, 0)),
  }
  const otherInc = {
    act: sumC(rev, (r) => r.actOtherIncome),
    fc1: sumC(rev, (r) => r.fc1OtherIncome),
    fc2: sumC(rev, (r) => r.fc2OtherIncome),
  }
  const ebit = {
    act: r2(sfTotal.act + otherInc.act + pex.act + opex.act),
    fc1: r2(sfTotal.fc1 + otherInc.fc1 + pex.fc1 + opex.fc1),
    fc2: r2(sfTotal.fc2 + otherInc.fc2 + pex.fc2 + opex.fc2),
  }
  const interest  = {
    act: sumC(rev, (r) => r.actInterest),
    fc1: sumC(rev, (r) => r.fc1Interest),
    fc2: sumC(rev, (r) => r.fc2Interest),
  }
  const tax = {
    act: -sumC(rev, (r) => r.actTax),
    fc1: -sumC(rev, (r) => r.fc1Tax),
    fc2: -sumC(rev, (r) => r.fc2Tax),
  }
  const finResult = {
    act: r2(interest.act + tax.act),
    fc1: r2(interest.fc1 + tax.fc1),
    fc2: r2(interest.fc2 + tax.fc2),
  }
  const netResult = {
    act: r2(ebit.act + finResult.act),
    fc1: r2(ebit.fc1 + finResult.fc1),
    fc2: r2(ebit.fc2 + finResult.fc2),
  }

  return { pex, opex, capex, sfByDept, sfTotal, otherInc, ebit, interest, tax, finResult, netResult, depts }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fv = (v) => (v == null ? '—' : v.toFixed(2))

const vcls = (v) =>
  v > 0.005 ? 'text-brand-green font-semibold' : v < -0.005 ? 'text-brand-red font-semibold' : 'text-[var(--muted)]'

// ─── Main component ───────────────────────────────────────────────────────────
export default function PLStatement() {
  const { rawRevenue, rawCost, derived, year } = useDashStore()
  const insights = useMemo(() => getSectionInsights('pl', { derived, year }), [derived, year])

  const availMonths = MONTHS.filter((m) => rawRevenue.some((r) => r.year === year && r.month === m))
  const [selectedMonth, setSelectedMonth] = useState(availMonths[availMonths.length - 1] || 'Dec')

  useEffect(() => {
    if (!availMonths.includes(selectedMonth))
      setSelectedMonth(availMonths[availMonths.length - 1] || 'Dec')
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const selIdx    = MONTHS.indexOf(selectedMonth)
  const ytdMonths = MONTHS.slice(0, selIdx + 1).filter((m) => availMonths.includes(m))
  const ytdLabel  = ytdMonths.length > 1 ? `Jan – ${selectedMonth}` : selectedMonth

  const ytd = buildPL(rawRevenue, rawCost, year, ytdMonths)
  const mtd = buildPL(rawRevenue, rawCost, year, [selectedMonth])
  if (!ytd || !mtd) return null

  return (
    <div className="mt-7">
      <SectionHead num="01" title={`P&L Statement · FY ${year}`}>
        Actuals vs FC1 and FC2 for both YTD and MTD. All figures ₹ Cr.
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* Month selector */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--line)] bg-[var(--bg)] flex-wrap">
          <span className="text-[10.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-[.14em]">
            Period
          </span>
          <div className="flex flex-wrap gap-1">
            {availMonths.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-2.5 py-1 text-[10.5px] rounded font-mono font-semibold transition-colors ${
                  selectedMonth === m
                    ? 'bg-brand-amber text-white'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-[var(--muted)] font-mono">
            YTD: {ytdLabel} · MTD: {selectedMonth}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* Period group headers */}
              <tr className="bg-[var(--bg)] border-b border-[var(--line)]">
                <th className="text-left p-3 px-5 text-[10.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-[.12em] min-w-[220px]" />
                <th colSpan={5} className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-amber border-r-2 border-[var(--line)]">
                  YTD · {ytdLabel} · FY {year}
                </th>
                <th colSpan={5} className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-blue">
                  MTD · {selectedMonth} · FY {year}
                </th>
              </tr>
              {/* Column sub-headers */}
              <tr className="border-b-2 border-[var(--line)] bg-[var(--bg)]">
                <th className="py-2 px-5 text-left text-[10.5px] font-semibold tracking-[.12em] uppercase text-[var(--ink-soft)]">
                  P&L Line
                </th>
                {/* YTD columns */}
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber   min-w-[80px]">Actual</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC1</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-green   min-w-[72px]">Var·F1</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC2</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue    min-w-[72px] border-r-2 border-[var(--line)]">Var·F2</th>
                {/* MTD columns */}
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber   min-w-[80px]">Actual</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC1</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-green   min-w-[72px]">Var·F1</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC2</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue    min-w-[72px]">Var·F2</th>
              </tr>
            </thead>

            <tbody>
              {/* ── Cost section ── */}
              <SectionBanner label="OPERATING COSTS" color="bg-brand-red/[.07]" textColor="text-brand-red" />
              <Row kind="cost" label="PEX · Personnel Expenses"
                ytd={ytd.pex} mtd={mtd.pex} />
              <Row kind="cost" label="OPEX · Operating Expenses"
                ytd={ytd.opex} mtd={mtd.opex} />

              <Divider />

              {/* ── Revenue section ── */}
              <SectionBanner label="REVENUE" color="bg-brand-green/[.07]" textColor="text-brand-green" />
              <Row kind="revenue" label="Service Fee Income"
                ytd={ytd.sfTotal} mtd={mtd.sfTotal} />
              {ytd.depts.map((dept) => {
                const yd = ytd.sfByDept.find((d) => d.dept === dept) || { act: 0, fc1: 0, fc2: 0 }
                const md = mtd.sfByDept.find((d) => d.dept === dept) || { act: 0, fc1: 0, fc2: 0 }
                return (
                  <Row key={dept} kind="dept" label={dept} ytd={yd} mtd={md} />
                )
              })}
              <Row kind="revenue" label="Other Income"
                ytd={ytd.otherInc} mtd={mtd.otherInc} />

              <Divider thick />

              {/* ── EBIT ── */}
              <Row kind="ebit" label="EBIT"
                ytd={ytd.ebit} mtd={mtd.ebit} />

              <Divider />

              {/* ── Financial result ── */}
              <SectionBanner label="FINANCIAL RESULT" color="bg-brand-blue/[.05]" textColor="text-brand-blue" />
              <Row kind="financial" label="Interest Income"
                ytd={ytd.interest} mtd={mtd.interest} />
              <Row kind="tax" label="Income Tax"
                ytd={ytd.tax} mtd={mtd.tax} />
              <Row kind="financial" label="Financial Result"
                ytd={ytd.finResult} mtd={mtd.finResult} />

              <Divider thick />

              {/* ── Net Result ── */}
              <Row kind="result" label="NET RESULT"
                ytd={ytd.netResult} mtd={mtd.netResult} />

              <Divider thick />

              {/* ── CAPEX (below the line) ── */}
              <Row kind="capex" label="CAPEX (below the line)"
                ytd={ytd.capex} mtd={mtd.capex} />
            </tbody>
          </table>
        </div>

        {/* Footer legend */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] text-[11px] text-[var(--muted)] font-mono flex gap-6 flex-wrap items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block" /> Revenue items
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block" /> Cost items
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block opacity-50" /> Var: favorable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block opacity-50" /> Var: unfavorable
          </span>
          <span className="ml-auto">EBIT = Revenue − PEX − OPEX · Net Result = EBIT + Financial Result · All ₹ Cr</span>
        </div>
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionBanner({ label, color, textColor }) {
  return (
    <tr>
      <td colSpan={11} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${color} ${textColor}`}>
        {label}
      </td>
    </tr>
  )
}

// ytd / mtd shape: { act, fc1, fc2 }
function Row({ label, ytd, mtd, kind = 'neutral' }) {
  const var1Ytd = r2(ytd.act - ytd.fc1)
  const var2Ytd = r2(ytd.act - ytd.fc2)
  const var1Mtd = r2(mtd.act - mtd.fc1)
  const var2Mtd = r2(mtd.act - mtd.fc2)

  const isSubtotal = kind === 'ebit' || kind === 'result'

  const rowCls = isSubtotal
    ? 'bg-[var(--bg)] border-y-2 border-[var(--line)]'
    : 'border-b border-[var(--line)] hover:bg-[var(--bg)]/60 transition-colors'

  const labelPad = kind === 'dept' ? 'py-2 pl-12 pr-5' : 'py-2.5 px-5'
  const labelText =
    kind === 'cost'     ? 'text-[12.5px] font-semibold text-brand-red' :
    kind === 'revenue'  ? 'text-[12.5px] font-semibold text-brand-green' :
    kind === 'dept'     ? 'text-[11.5px] text-brand-green/80' :
    kind === 'ebit'     ? 'text-[13px] font-bold text-brand-blue uppercase tracking-[.05em]' :
    kind === 'result'   ? 'text-[13.5px] font-bold text-[var(--ink)] uppercase tracking-[.05em]' :
    kind === 'capex'    ? 'text-[12px] text-[var(--muted)] italic' :
    kind === 'tax'      ? 'text-[12.5px] text-brand-amber' :
    kind === 'financial'? 'text-[12.5px] text-brand-blue' :
    'text-[12.5px] text-[var(--ink)]'

  const actCol = (v) => {
    if (kind === 'cost' || kind === 'capex') return 'text-brand-red font-semibold'
    if (kind === 'revenue' || kind === 'dept') return 'text-brand-green font-semibold'
    if (kind === 'ebit' || kind === 'result') return v >= 0 ? 'text-brand-blue font-bold' : 'text-brand-red font-bold'
    if (kind === 'tax') return 'text-brand-amber font-semibold'
    if (kind === 'financial') return 'text-brand-blue'
    return 'text-[var(--ink)]'
  }

  const numSz  = isSubtotal ? 'text-[13px]' : 'text-[12px]'
  const fcText = isSubtotal ? 'text-[13px] text-[var(--ink-soft)] font-medium' : 'text-[12px] text-[var(--ink-soft)]'

  return (
    <tr className={rowCls}>
      <td className={`${labelPad} ${labelText}`}>{label}</td>

      {/* YTD */}
      <td className={`py-2.5 px-3 text-right font-mono ${numSz} ${actCol(ytd.act)}`}>{fv(ytd.act)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(ytd.fc1)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(var1Ytd)}`}>{fv(var1Ytd)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(ytd.fc2)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] border-r-2 border-[var(--line)] ${vcls(var2Ytd)}`}>{fv(var2Ytd)}</td>

      {/* MTD */}
      <td className={`py-2.5 px-3 text-right font-mono ${numSz} ${actCol(mtd.act)}`}>{fv(mtd.act)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(mtd.fc1)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(var1Mtd)}`}>{fv(var1Mtd)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(mtd.fc2)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(var2Mtd)}`}>{fv(var2Mtd)}</td>
    </tr>
  )
}

function Divider({ thick }) {
  return (
    <tr>
      <td colSpan={11} className={thick ? 'h-[3px] bg-[var(--line)]' : 'h-px bg-[var(--line)] opacity-40'} />
    </tr>
  )
}
