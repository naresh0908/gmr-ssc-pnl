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

  const pexR = cst.filter((c) => c.costType === 'PEX')
  const opexR = cst.filter((c) => c.costType === 'OPEX')
  const capexR = cst.filter((c) => c.costType === 'CAPEX')

  const pex = { act: -sumC(pexR, (c) => c.actual), fc1: -sumC(pexR, (c) => c.fc1), fc2: -sumC(pexR, (c) => c.fc2) }
  const opex = { act: -sumC(opexR, (c) => c.actual), fc1: -sumC(opexR, (c) => c.fc1), fc2: -sumC(opexR, (c) => c.fc2) }
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

  // EBIT tallies: SF + OtherInc + PEX (neg) + OPEX (neg)
  const ebit = {
    act: r2(sfTotal.act + otherInc.act + pex.act + opex.act),
    fc1: r2(sfTotal.fc1 + otherInc.fc1 + pex.fc1 + opex.fc1),
    fc2: r2(sfTotal.fc2 + otherInc.fc2 + pex.fc2 + opex.fc2),
  }

  const interest = {
    act: sumC(rev, (r) => r.actInterest),
    fc1: sumC(rev, (r) => r.fc1Interest),
    fc2: sumC(rev, (r) => r.fc2Interest),
  }
  const tax = { act: -sumC(rev, (r) => r.actTax), fc1: -sumC(rev, (r) => r.fc1Tax), fc2: -sumC(rev, (r) => r.fc2Tax) }

  const finResult = {
    act: r2(interest.act + tax.act),
    fc1: r2(interest.fc1 + tax.fc1),
    fc2: r2(interest.fc2 + tax.fc2),
  }
  // Net Result tallies: EBIT + Financial Result
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
  v > 0.005 ? 'text-brand-green' : v < -0.005 ? 'text-brand-red' : 'text-[var(--muted)]'

// ─── Main component ───────────────────────────────────────────────────────────
export default function PLStatement() {
  const { rawRevenue, rawCost, year } = useDashStore()

  const availMonths = MONTHS.filter((m) => rawRevenue.some((r) => r.year === year && r.month === m))
  const [selectedMonth, setSelectedMonth] = useState(availMonths[availMonths.length - 1] || 'Dec')

  useEffect(() => {
    if (!availMonths.includes(selectedMonth))
      setSelectedMonth(availMonths[availMonths.length - 1] || 'Dec')
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const selIdx = MONTHS.indexOf(selectedMonth)
  const ytdMonths = MONTHS.slice(0, selIdx + 1).filter((m) => availMonths.includes(m))
  const ytdLabel = ytdMonths.length > 1 ? `Jan – ${selectedMonth}` : selectedMonth

  const ytd = buildPL(rawRevenue, rawCost, year, ytdMonths)
  const mtd = buildPL(rawRevenue, rawCost, year, [selectedMonth])
  if (!ytd || !mtd) return null

  return (
    <div className="mt-7">
      <SectionHead num="04" title={`P&L Statement · FY ${year}`}>
        Actuals vs FC1 (YTD) and FC2 (monthly). All figures in ₹ Cr — EBIT and Net Result computed from source rows.
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
            {/* Column group headers */}
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--line)]">
                <th className="text-left p-3 px-5 text-[10.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-[.12em] min-w-[210px]" />
                <th
                  colSpan={3}
                  className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-amber border-r-2 border-[var(--line)]"
                >
                  YTD · {ytdLabel} · FY {year}
                </th>
                <th
                  colSpan={3}
                  className="text-center py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-brand-blue"
                >
                  MTD · {selectedMonth} · FY {year}
                </th>
              </tr>
              <tr className="border-b-2 border-[var(--line)] bg-[var(--bg)]">
                <th className="py-2 px-5 text-left text-[10.5px] font-semibold tracking-[.12em] uppercase text-[var(--ink-soft)]">
                  P&L Line
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber min-w-[80px]">
                  Actual
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[80px]">
                  FC1
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue min-w-[80px] border-r-2 border-[var(--line)]">
                  Var
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber min-w-[80px]">
                  Actual
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[80px]">
                  FC2
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue min-w-[80px]">
                  Var
                </th>
              </tr>
            </thead>

            <tbody>
              {/* ── Cost rows ── */}
              <Row label="PEX" ytd={{ act: ytd.pex.act, fc: ytd.pex.fc1 }} mtd={{ act: mtd.pex.act, fc: mtd.pex.fc2 }} />
              <Row label="OPEX" ytd={{ act: ytd.opex.act, fc: ytd.opex.fc1 }} mtd={{ act: mtd.opex.act, fc: mtd.opex.fc2 }} />

              <Divider />

              {/* ── Revenue rows ── */}
              <Row
                label="SERVICE FEE INCOME"
                ytd={{ act: ytd.sfTotal.act, fc: ytd.sfTotal.fc1 }}
                mtd={{ act: mtd.sfTotal.act, fc: mtd.sfTotal.fc2 }}
                bold
              />
              {ytd.depts.map((dept) => {
                const yd = ytd.sfByDept.find((d) => d.dept === dept) || {}
                const md = mtd.sfByDept.find((d) => d.dept === dept) || {}
                return (
                  <Row
                    key={dept}
                    label={dept}
                    ytd={{ act: yd.act ?? 0, fc: yd.fc1 ?? 0 }}
                    mtd={{ act: md.act ?? 0, fc: md.fc2 ?? 0 }}
                    indent
                  />
                )
              })}
              <Row
                label="Other Income"
                ytd={{ act: ytd.otherInc.act, fc: ytd.otherInc.fc1 }}
                mtd={{ act: mtd.otherInc.act, fc: mtd.otherInc.fc2 }}
              />

              <Divider thick />

              {/* ── EBIT ── */}
              <Row
                label="EBIT"
                ytd={{ act: ytd.ebit.act, fc: ytd.ebit.fc1 }}
                mtd={{ act: mtd.ebit.act, fc: mtd.ebit.fc2 }}
                total
              />

              <Divider />

              {/* ── Financial result ── */}
              <Row
                label="Interest Income"
                ytd={{ act: ytd.interest.act, fc: ytd.interest.fc1 }}
                mtd={{ act: mtd.interest.act, fc: mtd.interest.fc2 }}
              />
              <Row
                label="Income Tax"
                ytd={{ act: ytd.tax.act, fc: ytd.tax.fc1 }}
                mtd={{ act: mtd.tax.act, fc: mtd.tax.fc2 }}
              />
              <Row
                label="Financial Result"
                ytd={{ act: ytd.finResult.act, fc: ytd.finResult.fc1 }}
                mtd={{ act: mtd.finResult.act, fc: mtd.finResult.fc2 }}
                bold
              />

              <Divider thick />

              {/* ── Net Result ── */}
              <Row
                label="NET RESULT"
                ytd={{ act: ytd.netResult.act, fc: ytd.netResult.fc1 }}
                mtd={{ act: mtd.netResult.act, fc: mtd.netResult.fc2 }}
                total
              />

              <Divider thick />

              {/* ── CAPEX (below the line) ── */}
              <Row
                label="CAPEX"
                ytd={{ act: ytd.capex.act, fc: ytd.capex.fc1 }}
                mtd={{ act: mtd.capex.act, fc: mtd.capex.fc2 }}
                muted
              />
            </tbody>
          </table>
        </div>

        {/* Tally note */}
        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] text-[11px] text-[var(--muted)] font-mono flex gap-6 flex-wrap">
          <span>EBIT = Service Fee + Other Income + PEX + OPEX</span>
          <span>Net Result = EBIT + Financial Result</span>
          <span className="ml-auto">All values ₹ Cr</span>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Row components ───────────────────────────────────────────────────────────
function Row({ label, ytd, mtd, bold, indent, total, muted }) {
  const varYtd = r2(ytd.act - ytd.fc)
  const varMtd = r2(mtd.act - mtd.fc)

  const rowCls = total
    ? 'bg-[var(--bg)] border-y border-[var(--line)]'
    : 'border-b border-[var(--line)] hover:bg-[var(--bg)] transition'

  const labelCls = total
    ? 'font-bold text-[13px] text-[var(--ink)] tracking-[.04em] uppercase'
    : bold
    ? 'font-semibold text-[13px] text-[var(--ink)]'
    : indent
    ? 'text-[12px] text-[var(--ink-soft)] pl-10'
    : muted
    ? 'text-[12px] text-[var(--ink-soft)] italic'
    : 'text-[12.5px] text-[var(--ink)]'

  const numCls = total ? 'font-bold text-[13px]' : bold ? 'font-semibold text-[12px]' : 'font-normal text-[12px]'

  return (
    <tr className={rowCls}>
      <td className={`py-2.5 px-5 ${labelCls}`}>{label}</td>
      {/* YTD Actual */}
      <td className={`py-2.5 px-3 text-right font-mono ${numCls} text-[var(--ink)]`}>{fv(ytd.act)}</td>
      {/* YTD FC1 */}
      <td className={`py-2.5 px-3 text-right font-mono ${numCls} text-[var(--ink-soft)]`}>{fv(ytd.fc)}</td>
      {/* YTD Var */}
      <td className={`py-2.5 px-3 text-right font-mono font-semibold text-[12px] border-r-2 border-[var(--line)] ${vcls(varYtd)}`}>
        {fv(varYtd)}
      </td>
      {/* MTD Actual */}
      <td className={`py-2.5 px-3 text-right font-mono ${numCls} text-[var(--ink)]`}>{fv(mtd.act)}</td>
      {/* MTD FC2 */}
      <td className={`py-2.5 px-3 text-right font-mono ${numCls} text-[var(--ink-soft)]`}>{fv(mtd.fc)}</td>
      {/* MTD Var */}
      <td className={`py-2.5 px-3 text-right font-mono font-semibold text-[12px] ${vcls(varMtd)}`}>
        {fv(varMtd)}
      </td>
    </tr>
  )
}

function Divider({ thick }) {
  return (
    <tr>
      <td colSpan={7} className={thick ? 'h-[2px] bg-[var(--line)]' : 'h-px bg-[var(--line)] opacity-50'} />
    </tr>
  )
}
