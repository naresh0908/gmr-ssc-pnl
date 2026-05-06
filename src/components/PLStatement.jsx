import { useState, useEffect } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import { motion } from 'framer-motion'
import { MONTHS } from '../utils/computeDerived'

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

  const pex   = { act: -sumC(pexR,   (c) => c.actual), fc2: -sumC(pexR,   (c) => c.fc2) }
  const opex  = { act: -sumC(opexR,  (c) => c.actual), fc2: -sumC(opexR,  (c) => c.fc2) }
  const capex = { act: -sumC(capexR, (c) => c.actual), fc2: -sumC(capexR, (c) => c.fc2) }

  const sfByDept = depts.map((dept) => {
    const dRev = rev.filter((r) => r.department === dept)
    return { dept, act: sumC(dRev, (r) => r.actServiceFees), fc2: sumC(dRev, (r) => r.fc2ServiceFees) }
  })
  const sfTotal = {
    act: r2(sfByDept.reduce((s, d) => s + d.act, 0)),
    fc2: r2(sfByDept.reduce((s, d) => s + d.fc2, 0)),
  }
  const otherInc = { act: sumC(rev, (r) => r.actOtherIncome), fc2: sumC(rev, (r) => r.fc2OtherIncome) }
  const ebit     = {
    act: r2(sfTotal.act + otherInc.act + pex.act + opex.act),
    fc2: r2(sfTotal.fc2 + otherInc.fc2 + pex.fc2 + opex.fc2),
  }
  const interest  = { act: sumC(rev, (r) => r.actInterest),  fc2: sumC(rev, (r) => r.fc2Interest) }
  const tax       = { act: -sumC(rev, (r) => r.actTax),      fc2: -sumC(rev, (r) => r.fc2Tax) }
  const finResult = { act: r2(interest.act + tax.act),       fc2: r2(interest.fc2 + tax.fc2) }
  const netResult = { act: r2(ebit.act + finResult.act),     fc2: r2(ebit.fc2 + finResult.fc2) }

  return { pex, opex, capex, sfByDept, sfTotal, otherInc, ebit, interest, tax, finResult, netResult, depts }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fv = (v) => (v == null ? '—' : v.toFixed(2))

// Variance: positive = favorable for both revenue (actual > plan) and cost (actual less negative = under-budget)
const vcls = (v) =>
  v > 0.005 ? 'text-brand-green font-semibold' : v < -0.005 ? 'text-brand-red font-semibold' : 'text-[var(--muted)]'

// ─── Main component ───────────────────────────────────────────────────────────
export default function PLStatement() {
  const { rawRevenue, rawCost, year } = useDashStore()

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
      <SectionHead num="04" title={`P&L Statement · FY ${year}`}>
        Actuals vs FC2 for both YTD and MTD. Green = revenue · Red = costs. All figures ₹ Cr.
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
              {/* Section labels */}
              <tr className="bg-[var(--bg)] border-b border-[var(--line)]">
                <th className="text-left p-3 px-5 text-[10.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-[.12em] min-w-[220px]" />
                <th colSpan={3} className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-amber border-r-2 border-[var(--line)]">
                  YTD · {ytdLabel} · FY {year}
                </th>
                <th colSpan={3} className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-blue">
                  MTD · {selectedMonth} · FY {year}
                </th>
              </tr>
              {/* Column headers — both sections compare vs FC2 */}
              <tr className="border-b-2 border-[var(--line)] bg-[var(--bg)]">
                <th className="py-2 px-5 text-left text-[10.5px] font-semibold tracking-[.12em] uppercase text-[var(--ink-soft)]">
                  P&L Line
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber   min-w-[86px]">Actual</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[86px]">FC2</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue    min-w-[80px] border-r-2 border-[var(--line)]">Var</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber   min-w-[86px]">Actual</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[86px]">FC2</th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue    min-w-[80px]">Var</th>
              </tr>
            </thead>

            <tbody>
              {/* ── Cost section ── */}
              <SectionBanner label="OPERATING COSTS" color="bg-brand-red/[.07]" textColor="text-brand-red" />
              <Row kind="cost" label="PEX · Personnel Expenses"
                ytd={{ act: ytd.pex.act, fc: ytd.pex.fc2 }}
                mtd={{ act: mtd.pex.act, fc: mtd.pex.fc2 }} />
              <Row kind="cost" label="OPEX · Operating Expenses"
                ytd={{ act: ytd.opex.act, fc: ytd.opex.fc2 }}
                mtd={{ act: mtd.opex.act, fc: mtd.opex.fc2 }} />

              <Divider />

              {/* ── Revenue section ── */}
              <SectionBanner label="REVENUE" color="bg-brand-green/[.07]" textColor="text-brand-green" />
              <Row kind="revenue" label="Service Fee Income"
                ytd={{ act: ytd.sfTotal.act, fc: ytd.sfTotal.fc2 }}
                mtd={{ act: mtd.sfTotal.act, fc: mtd.sfTotal.fc2 }} />
              {ytd.depts.map((dept) => {
                const yd = ytd.sfByDept.find((d) => d.dept === dept) || {}
                const md = mtd.sfByDept.find((d) => d.dept === dept) || {}
                return (
                  <Row key={dept} kind="dept" label={dept}
                    ytd={{ act: yd.act ?? 0, fc: yd.fc2 ?? 0 }}
                    mtd={{ act: md.act ?? 0, fc: md.fc2 ?? 0 }} />
                )
              })}
              <Row kind="revenue" label="Other Income"
                ytd={{ act: ytd.otherInc.act, fc: ytd.otherInc.fc2 }}
                mtd={{ act: mtd.otherInc.act, fc: mtd.otherInc.fc2 }} />

              <Divider thick />

              {/* ── EBIT ── */}
              <Row kind="ebit" label="EBIT"
                ytd={{ act: ytd.ebit.act, fc: ytd.ebit.fc2 }}
                mtd={{ act: mtd.ebit.act, fc: mtd.ebit.fc2 }} />

              <Divider />

              {/* ── Financial result ── */}
              <SectionBanner label="FINANCIAL RESULT" color="bg-brand-blue/[.05]" textColor="text-brand-blue" />
              <Row kind="financial" label="Interest Income"
                ytd={{ act: ytd.interest.act, fc: ytd.interest.fc2 }}
                mtd={{ act: mtd.interest.act, fc: mtd.interest.fc2 }} />
              <Row kind="tax" label="Income Tax"
                ytd={{ act: ytd.tax.act, fc: ytd.tax.fc2 }}
                mtd={{ act: mtd.tax.act, fc: mtd.tax.fc2 }} />
              <Row kind="financial" label="Financial Result"
                ytd={{ act: ytd.finResult.act, fc: ytd.finResult.fc2 }}
                mtd={{ act: mtd.finResult.act, fc: mtd.finResult.fc2 }} />

              <Divider thick />

              {/* ── Net Result ── */}
              <Row kind="result" label="NET RESULT"
                ytd={{ act: ytd.netResult.act, fc: ytd.netResult.fc2 }}
                mtd={{ act: mtd.netResult.act, fc: mtd.netResult.fc2 }} />

              <Divider thick />

              {/* ── CAPEX (below the line) ── */}
              <Row kind="capex" label="CAPEX (below the line)"
                ytd={{ act: ytd.capex.act, fc: ytd.capex.fc2 }}
                mtd={{ act: mtd.capex.act, fc: mtd.capex.fc2 }} />
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
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionBanner({ label, color, textColor }) {
  return (
    <tr>
      <td colSpan={7} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${color} ${textColor}`}>
        {label}
      </td>
    </tr>
  )
}

// kind: 'cost' | 'revenue' | 'dept' | 'ebit' | 'financial' | 'tax' | 'result' | 'capex'
function Row({ label, ytd, mtd, kind = 'neutral' }) {
  const varYtd = r2(ytd.act - ytd.fc)
  const varMtd = r2(mtd.act - mtd.fc)

  const isSubtotal = kind === 'ebit' || kind === 'result'

  const rowCls = isSubtotal
    ? 'bg-[var(--bg)] border-y-2 border-[var(--line)]'
    : 'border-b border-[var(--line)] hover:bg-[var(--bg)]/60 transition-colors'

  // Label cell
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

  // Actual value color (driven by sign + kind)
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
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(ytd.fc)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] border-r-2 border-[var(--line)] ${vcls(varYtd)}`}>
        {fv(varYtd)}
      </td>

      {/* MTD */}
      <td className={`py-2.5 px-3 text-right font-mono ${numSz} ${actCol(mtd.act)}`}>{fv(mtd.act)}</td>
      <td className={`py-2.5 px-3 text-right font-mono ${fcText}`}>{fv(mtd.fc)}</td>
      <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(varMtd)}`}>
        {fv(varMtd)}
      </td>
    </tr>
  )
}

function Divider({ thick }) {
  return (
    <tr>
      <td colSpan={7} className={thick ? 'h-[3px] bg-[var(--line)]' : 'h-px bg-[var(--line)] opacity-40'} />
    </tr>
  )
}
