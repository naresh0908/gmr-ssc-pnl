import { useMemo, useState } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { getSectionInsights } from '../utils/sectionInsights'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100
const fv = (v) => (v == null ? '-' : v.toFixed(2))
const vcls = (v) =>
  v > 0.005 ? 'text-brand-green font-semibold' : v < -0.005 ? 'text-brand-red font-semibold' : 'text-[var(--muted)]'

// Build the full P&L data structure for the active period.
// Cost values are stored as negatives (so they sum directly into EBIT / Net Result).
function buildPL(revenue, cost, year, months) {
  if (!months.length) return null

  const rev = revenue.filter((r) => r.year === year && months.includes(r.month))
  const cst = cost.filter((c)   => c.year === year && months.includes(c.month))

  const sumByMonthRev = (key) => {
    const bm = {}
    months.forEach((m) => {
      bm[m] = r2(rev.filter((r) => r.month === m).reduce((s, r) => s + (r[key] || 0), 0) / CR)
    })
    return bm
  }
  const sumByMonthCost = (rows, key, sign = -1) => {
    const bm = {}
    months.forEach((m) => {
      bm[m] = r2(sign * rows.filter((r) => r.month === m).reduce((s, r) => s + (r[key] || 0), 0) / CR)
    })
    return bm
  }
  const totalRev  = (key)        => r2(rev.reduce((s, r) => s + (r[key] || 0), 0) / CR)
  const totalCost = (rows, key)  => -r2(rows.reduce((s, r) => s + (r[key] || 0), 0) / CR)

  // Cost type aggregate with sub-category drill-down
  const buildCostAgg = (type) => {
    const rows = cst.filter((c) => c.costType === type)
    const subs = [...new Set(rows.map((r) => r.subCategory))].filter(Boolean)
    const subcats = subs.map((sub) => {
      const sr = rows.filter((r) => r.subCategory === sub)
      return {
        sub,
        act:     totalCost(sr, 'actual'),
        fc1:     totalCost(sr, 'fc1'),
        fc2:     totalCost(sr, 'fc2'),
        byMonth: sumByMonthCost(sr, 'actual'),
      }
    }).sort((a, b) => a.act - b.act)  // most expensive first (most negative)
    return {
      act:     totalCost(rows, 'actual'),
      fc1:     totalCost(rows, 'fc1'),
      fc2:     totalCost(rows, 'fc2'),
      byMonth: sumByMonthCost(rows, 'actual'),
      subcats,
    }
  }

  const pex   = buildCostAgg('PEX')
  const opex  = buildCostAgg('OPEX')
  const capex = buildCostAgg('CAPEX')

  // Service Fees broken down by department
  const depts = [...new Set(rev.map((r) => r.department))]
  const sfByDept = depts.map((dept) => {
    const dr = rev.filter((r) => r.department === dept)
    const bm = {}
    months.forEach((m) => {
      bm[m] = r2(dr.filter((r) => r.month === m).reduce((s, r) => s + r.actServiceFees, 0) / CR)
    })
    return {
      dept,
      act:     r2(dr.reduce((s, r) => s + r.actServiceFees, 0) / CR),
      fc1:     r2(dr.reduce((s, r) => s + r.fc1ServiceFees, 0) / CR),
      fc2:     r2(dr.reduce((s, r) => s + r.fc2ServiceFees, 0) / CR),
      byMonth: bm,
    }
  }).sort((a, b) => b.act - a.act)

  const sfTotal = {
    act:     r2(sfByDept.reduce((s, d) => s + d.act, 0)),
    fc1:     r2(sfByDept.reduce((s, d) => s + d.fc1, 0)),
    fc2:     r2(sfByDept.reduce((s, d) => s + d.fc2, 0)),
    byMonth: sumByMonthRev('actServiceFees'),
  }

  const otherInc = {
    act:     totalRev('actOtherIncome'),
    fc1:     totalRev('fc1OtherIncome'),
    fc2:     totalRev('fc2OtherIncome'),
    byMonth: sumByMonthRev('actOtherIncome'),
  }

  const interest = {
    act:     totalRev('actInterest'),
    fc1:     totalRev('fc1Interest'),
    fc2:     totalRev('fc2Interest'),
    byMonth: sumByMonthRev('actInterest'),
  }

  // Tax stored as negative (subtracted in Net Result calc)
  const tax = {
    act:     -totalRev('actTax'),
    fc1:     -totalRev('fc1Tax'),
    fc2:     -totalRev('fc2Tax'),
    byMonth: (() => {
      const bm = {}
      months.forEach((m) => {
        bm[m] = -r2(rev.filter((r) => r.month === m).reduce((s, r) => s + r.actTax, 0) / CR)
      })
      return bm
    })(),
  }

  // Sum any number of line items into a new line (preserves byMonth shape)
  const sumLines = (...lines) => {
    const out = { act: 0, fc1: 0, fc2: 0, byMonth: {} }
    months.forEach((m) => { out.byMonth[m] = 0 })
    lines.forEach((l) => {
      out.act += l.act; out.fc1 += l.fc1; out.fc2 += l.fc2
      months.forEach((m) => { out.byMonth[m] += l.byMonth[m] || 0 })
    })
    out.act = r2(out.act); out.fc1 = r2(out.fc1); out.fc2 = r2(out.fc2)
    months.forEach((m) => { out.byMonth[m] = r2(out.byMonth[m]) })
    return out
  }

  // Subtotals
  const costsTotal   = sumLines(pex, opex, capex)             // PEX + OPEX + CAPEX (incl. CAPEX for completeness)
  const revenueTotal = sumLines(sfTotal, otherInc)            // SF + OI (operating revenue)

  // EBIT excludes CAPEX (standard); the displayed net result carries the tax adjustment.
  const ebit      = sumLines(sfTotal, otherInc, pex, opex)
  const netResult = sumLines(ebit, tax)

  return {
    pex, opex, capex, costsTotal,
    sfByDept, sfTotal, otherInc, revenueTotal,
    tax, ebit, netResult, months,
  }
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PLStatement() {
  const {
    rawRevenue, rawCost, derived, year,
    periodMode, selectedQ, selectedPeriodMonth,
  } = useDashStore()

  const [viewMode, setViewMode] = useState('variance')   // 'variance' | 'monthly'
  const [expanded, setExpanded] = useState(() => new Set())

  const insights = useMemo(
    () => getSectionInsights('pl', { derived, year, rawRevenue, rawCost }),
    [derived, year, rawRevenue, rawCost]
  )

  const availMonths = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )

  const pl = useMemo(
    () => buildPL(rawRevenue, rawCost, year, activeMonths),
    [rawRevenue, rawCost, year, activeMonths]
  )

  if (!pl) return null
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Build display rows in the requested order: REVENUE → COSTS → EBIT → TAX → NET RESULT
  const rowDefs = []
  rowDefs.push({ kind: 'section', label: 'REVENUE', color: 'green' })
  rowDefs.push({ kind: 'revenue', id: 'sf', label: 'Service Fee Income', data: pl.sfTotal, expandable: true })
  if (expanded.has('sf')) pl.sfByDept.forEach((d) => rowDefs.push({ kind: 'subcat-rev', id: `sf.${d.dept}`, label: d.dept, data: d }))
  rowDefs.push({ kind: 'revenue', id: 'oi', label: 'Other Income', data: pl.otherInc })
  rowDefs.push({ kind: 'rev-total', id: 'totalrev', label: 'Total Revenue (Service Fees + Other Income)', data: pl.revenueTotal })

  rowDefs.push({ kind: 'section', label: 'COSTS', color: 'red' })
  rowDefs.push({ kind: 'cost', costType: 'PEX',   id: 'pex',   label: 'PEX · Personnel Expenses',  data: pl.pex,   expandable: true })
  if (expanded.has('pex'))   pl.pex.subcats.forEach((s)   => rowDefs.push({ kind: 'subcat-cost', costType: 'PEX',   id: `pex.${s.sub}`,   label: s.sub, data: s }))
  rowDefs.push({ kind: 'cost', costType: 'OPEX',  id: 'opex',  label: 'OPEX · Operating Expenses', data: pl.opex,  expandable: true })
  if (expanded.has('opex'))  pl.opex.subcats.forEach((s)  => rowDefs.push({ kind: 'subcat-cost', costType: 'OPEX',  id: `opex.${s.sub}`,  label: s.sub, data: s }))
  rowDefs.push({ kind: 'cost', costType: 'CAPEX', id: 'capex', label: 'CAPEX · Capital Expenses',  data: pl.capex, expandable: true })
  if (expanded.has('capex')) pl.capex.subcats.forEach((s) => rowDefs.push({ kind: 'subcat-cost', costType: 'CAPEX', id: `capex.${s.sub}`, label: s.sub, data: s }))
  rowDefs.push({ kind: 'cost-total', id: 'totalcost', label: 'Total Costs (PEX + OPEX + CAPEX)', data: pl.costsTotal })

  rowDefs.push({ kind: 'ebit', id: 'ebit', label: 'EBIT', data: pl.ebit })

  rowDefs.push({ kind: 'tax',       id: 'tax',  label: 'Income Tax',       data: pl.tax })

  rowDefs.push({ kind: 'result', id: 'net', label: 'NET RESULT', data: pl.netResult })

  const numericCols = viewMode === 'variance' ? 5 : (activeMonths.length + 1)
  const totalCols   = numericCols + 1

  return (
    <div className="mt-7">
      <SectionHead num="01" title={`P&L Statement · FY ${year}`}>
        {periodLabel} · {viewMode === 'variance' ? 'Actual vs FC1/FC2 with variance' : 'Monthly actuals across the period'}. All figures ₹ Cr.
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* View-mode toggle */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--line)] bg-[var(--bg)] flex-wrap">
          <span className="text-[10.5px] uppercase tracking-[.14em] font-semibold text-[var(--ink-soft)]">View</span>
          <div className="flex gap-1 bg-[var(--card)] border border-[var(--line)] rounded-full p-0.5">
            {[
              { id: 'variance', label: 'Actual vs Forecast' },
              { id: 'monthly',  label: 'Months as Columns' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setViewMode(opt.id)}
                className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold transition ${
                  viewMode === opt.id
                    ? 'bg-ink text-bg-light'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          <span className="ml-auto text-[10.5px] text-[var(--muted)] font-mono">
            Tip · click <span className="font-semibold">PEX</span>, <span className="font-semibold">OPEX</span>, <span className="font-semibold">CAPEX</span> or <span className="font-semibold">Service Fees</span> to drill into details
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg)] border-b-2 border-[var(--line)]">
                <th className="py-2.5 px-5 text-left text-[10.5px] font-semibold tracking-[.12em] uppercase text-[var(--ink-soft)] min-w-[260px] sticky left-0 bg-[var(--bg)] z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">P&L Line</th>
                {viewMode === 'variance' ? (
                  <>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber    min-w-[80px]">Actual</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC1</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-green    min-w-[72px]">Var·F1</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[76px]">FC2</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-blue     min-w-[72px]">Var·F2</th>
                  </>
                ) : (
                  <>
                    {activeMonths.map((m) => (
                      <th key={m} className="py-2.5 px-2.5 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--ink-soft)] min-w-[58px]">
                        {m}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-[.1em] text-brand-amber min-w-[80px] border-l-2 border-[var(--line)]">
                      Total
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rowDefs.map((row, i) => {
                if (row.kind === 'section') {
                  const colorMap = {
                    red:   'bg-brand-red/[.07]   text-brand-red',
                    green: 'bg-brand-green/[.07] text-brand-green',
                    blue:  'bg-brand-blue/[.05]  text-brand-blue',
                  }
                  return (
                    <tr key={`sec-${i}`}>
                      <td colSpan={totalCols}
                          className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${colorMap[row.color]}`}>
                        {row.label}
                      </td>
                    </tr>
                  )
                }
                return (
                  <Row
                    key={row.id}
                    row={row}
                    months={activeMonths}
                    viewMode={viewMode}
                    expanded={row.expandable && expanded.has(row.id)}
                    onToggle={row.expandable ? () => toggleExpand(row.id) : null}
                  />
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)] text-[11px] text-[var(--muted)] font-mono flex gap-6 flex-wrap items-center">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block" /> Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block" /> Cost</span>
          {viewMode === 'variance' && (
            <>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-green inline-block opacity-50" /> Var: favorable</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-red inline-block opacity-50" /> Var: unfavorable</span>
            </>
          )}
          <span className="ml-auto">EBIT = Revenue - Cost | Net Result = EBIT + Tax</span>
        </div>
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

// Background tint per cost type - applied to the entire row so the table reads
// as colour-coded category bands.
const COST_ROW_BG = {
  PEX:   'bg-[#FCEEEC]',  // soft red wash
  OPEX:  'bg-[#FBF1DC]',  // soft amber wash
  CAPEX: 'bg-[#E8EFFB]',  // soft blue wash
}
const COST_SUB_BG = {
  PEX:   'bg-[#FCEEEC]/55',
  OPEX:  'bg-[#FBF1DC]/55',
  CAPEX: 'bg-[#E8EFFB]/55',
}

// ─── Row component ────────────────────────────────────────────────────────────
function Row({ row, months, viewMode, expanded, onToggle }) {
  const { kind, label, data, costType, isSubSubtotal } = row

  const var1 = r2(data.act - data.fc1)
  const var2 = r2(data.act - data.fc2)

  const isSubtotal      = kind === 'ebit' || kind === 'result'
  const isMidSubtotal   = kind === 'cost-total' || kind === 'rev-total'
  const isSubcat        = kind === 'subcat-cost' || kind === 'subcat-rev'

  let rowCls
  if (isSubtotal) {
    rowCls = 'bg-[var(--bg)] border-y-2 border-[var(--line)]'
  } else if (isMidSubtotal) {
    rowCls = kind === 'cost-total'
      ? 'bg-brand-red/[.10] border-y border-[var(--line)] font-semibold'
      : 'bg-brand-green/[.10] border-y border-[var(--line)] font-semibold'
  } else if (isSubSubtotal) {
    rowCls = 'bg-[var(--bg)]/60 border-y border-[var(--line)]'
  } else if (kind === 'cost' && costType) {
    rowCls = `${COST_ROW_BG[costType]} border-b border-[var(--line)]`
  } else if (kind === 'subcat-cost' && costType) {
    rowCls = `${COST_SUB_BG[costType]} border-b border-[var(--line)]`
  } else if (isSubcat) {
    rowCls = 'border-b border-[var(--line)] bg-[var(--bg)]/40'
  } else {
    rowCls = 'border-b border-[var(--line)] hover:bg-[var(--bg)]/60 transition-colors'
  }

  const labelPad = isSubcat ? 'py-2 pl-12 pr-5' : 'py-2.5 px-5'
  const labelText =
    kind === 'cost'        ? 'text-[12.5px] font-semibold text-brand-red' :
    kind === 'subcat-cost' ? 'text-[11.5px] font-medium text-brand-red' :
    kind === 'cost-total'  ? 'text-[12.5px] font-bold text-brand-red uppercase tracking-[.04em]' :
    kind === 'revenue'     ? 'text-[12.5px] font-semibold text-brand-green' :
    kind === 'subcat-rev'  ? 'text-[11.5px] font-medium text-brand-green' :
    kind === 'rev-total'   ? 'text-[12.5px] font-bold text-brand-green uppercase tracking-[.04em]' :
    kind === 'ebit'        ? 'text-[13px] font-bold text-brand-blue uppercase tracking-[.05em]' :
    kind === 'result'      ? 'text-[13.5px] font-bold text-[var(--ink)] uppercase tracking-[.05em]' :
    kind === 'tax'         ? 'text-[12.5px] text-brand-amber' :
    kind === 'financial'   ? `text-[12.5px] ${isSubSubtotal ? 'font-semibold' : ''} text-brand-blue` :
    'text-[12.5px] text-[var(--ink)]'

  const numColor = (v) => {
    if (kind === 'cost' || kind === 'subcat-cost' || kind === 'cost-total')   return 'text-brand-red font-semibold'
    if (kind === 'revenue' || kind === 'subcat-rev' || kind === 'rev-total')  return 'text-brand-green font-semibold'
    if (kind === 'ebit' || kind === 'result')        return v >= 0 ? 'text-brand-blue font-bold' : 'text-brand-red font-bold'
    if (kind === 'tax')        return 'text-brand-amber font-semibold'
    if (kind === 'financial')  return v >= 0 ? 'text-brand-blue' : 'text-brand-red'
    return 'text-[var(--ink)]'
  }

  const numSize = (isSubtotal || isMidSubtotal) ? 'text-[13px]' : isSubcat ? 'text-[11.5px]' : 'text-[12px]'
  const fcText  = (isSubtotal || isMidSubtotal) ? 'text-[13px] text-[var(--ink-soft)] font-medium' : 'text-[12px] text-[var(--ink-soft)]'

  return (
    <tr className={`${rowCls} ${onToggle ? 'cursor-pointer' : ''}`} onClick={onToggle || undefined}>
      <td className={`${labelPad} ${labelText} ${onToggle ? 'select-none' : ''} sticky left-0 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)] ${kind === 'section' ? 'bg-inherit' : 'bg-[var(--bg)]'}`}>
        <span className="inline-flex items-center gap-1.5">
          {onToggle && (
            <span className="text-[var(--ink-soft)] flex-shrink-0">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {label}
        </span>
      </td>

      {viewMode === 'variance' ? (
        <>
          <td className={`py-2.5 px-3 text-right font-mono ${numSize} ${numColor(data.act)} ${isSubcat ? 'font-medium' : ''}`}>{fv(data.act)}</td>
          <td className={`py-2.5 px-3 text-right font-mono ${fcText} ${isSubcat ? 'font-medium' : ''}`}>{fv(data.fc1)}</td>
          <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(var1)}`}>{fv(var1)}</td>
          <td className={`py-2.5 px-3 text-right font-mono ${fcText} ${isSubcat ? 'font-medium' : ''}`}>{fv(data.fc2)}</td>
          <td className={`py-2.5 px-3 text-right font-mono text-[12px] ${vcls(var2)}`}>{fv(var2)}</td>
        </>
      ) : (
        <>
          {months.map((m) => {
            const v = data.byMonth?.[m] ?? 0
            return (
              <td key={m} className={`py-2.5 px-2.5 text-right font-mono ${numSize} ${numColor(v)} ${isSubcat ? 'font-medium' : ''}`}>
                {Math.abs(v) < 0.005 ? '-' : v.toFixed(2)}
              </td>
            )
          })}
          <td className={`py-2.5 px-3 text-right font-mono ${numSize} ${numColor(data.act)} border-l-2 border-[var(--line)]`}>
            {fv(data.act)}
          </td>
        </>
      )}
    </tr>
  )
}
