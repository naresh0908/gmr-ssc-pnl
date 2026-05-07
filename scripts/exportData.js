// Export every data slice the dashboard uses to an Excel workbook.
// Run with:  node scripts/exportData.js
// Output:    GMR_SSC_Data_Export.xlsx in repo root.
//
// Sheets:
//   1.  Overview                - KPIs per FY (Hero/KPI cards)
//   2.  PL Statement            - full P&L line items per FY (matches PLStatement.jsx)
//   3.  Monthly P&L             - month-level revAct/Fc1/Fc2, costAct/Fc1/Fc2, npAct/Fc1/Fc2
//   4.  Department Annual       - annual EBIT, margin, cost vs FC1/FC2 by dept
//   5.  EBIT Matrix Dept-Month  - Dept × Month EBIT heatmap data
//   6.  Cost By Type            - PEX/OPEX/CAPEX annual actual/FC1/FC2
//   7.  Cost Sub-Category       - sub-category breakdown across years
//   8.  Service Revenue Annual  - Dept × Year FTE/Txn/Total split
//   9.  Service Monthly         - monthly FTE vs Txn split per dept
//  10.  Transactions Raw        - service-level txn rows
//  11.  FTE Raw                 - function-level FTE rows
//  12.  Revenue Raw             - full revenue ledger
//  13.  Cost Raw                - full cost ledger
//  14.  Data Audit              - coverage stats & sanity-check flags

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

import { sampleData }          from '../src/data/sampleData.js'
import { generate2026 }        from '../src/data/generate2026.js'
import { transactionFteData }  from '../src/data/transactionFteData.js'
import { computeDerived, MONTHS } from '../src/utils/computeDerived.js'
import { computeServiceRevenue } from '../src/utils/computeServiceRevenue.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'GMR_SSC_Data_Export.xlsx')
const CR  = 1e7
const r2  = (n) => Math.round(n * 100) / 100

// Replicates the patch logic in src/store/useDashStore.js - keep in sync.
function patchSampleData(revenue, cost) {
  const revPatches = {
    Mar: {
      'Procurement & Contracts':       0.55,
      'Facility Management Services':  0.78,
      'Human Resources':               0.82,
      'Finance & Accounts (F&A)':      0.92,
      'IT Management':                 0.90,
    },
    Aug: {
      'Human Resources':               0.68,
      'Facility Management Services':  0.72,
      '*': 0.93,
    },
  }
  const costPatches = {
    Mar: { 'OPEX:Consulting': 2.20, 'OPEX:IT': 1.65, 'PEX:Salaries': 1.05, '*': 1.05 },
    Jun: { 'OPEX:Facility':   2.80, 'CAPEX:Equipment': 2.40, 'OPEX:IT': 1.40, '*': 1.10 },
    Nov: { 'PEX:Salaries':    1.55, 'PEX:Recruitment': 2.40, 'PEX:Training': 1.85, '*': 1.10 },
  }
  const rev = revenue.map((r) => {
    if (r.year === 2024) {
      return {
        ...r,
        actServiceFees: Math.round(r.actServiceFees * 1.04),
        actOtherIncome: Math.round(r.actOtherIncome * 1.04),
        actTax:         Math.round(r.actTax         * 0.88),
      }
    }
    if (r.year !== 2025) return r
    const m = revPatches[r.month]
    if (!m) return r
    const k = m[r.department] ?? m['*'] ?? 1
    if (k === 1) return r
    return {
      ...r,
      actServiceFees: Math.round(r.actServiceFees * k),
      actOtherIncome: Math.round(r.actOtherIncome * k),
      actInterest:    Math.round(r.actInterest    * k),
    }
  })
  const cst = cost.map((c) => {
    if (c.year !== 2025) return c
    const m = costPatches[c.month]
    if (!m) return c
    const key = `${c.costType}:${c.subCategory}`
    const k = m[key] ?? m['*'] ?? 1
    if (k === 1) return c
    return { ...c, actual: Math.round(c.actual * k) }
  })
  return { revenue: rev, cost: cst }
}

const { revenue: patched2025Rev, cost: patched2025Cost } =
  patchSampleData(sampleData.revenue, sampleData.cost)
const data2026 = generate2026({ revenue: sampleData.revenue, cost: sampleData.cost })

const revenue = [...patched2025Rev, ...data2026.revenue]
const cost    = [...patched2025Cost, ...data2026.cost]

const derived        = computeDerived(revenue, cost)
const serviceRevenue = computeServiceRevenue(
  transactionFteData.transactions,
  transactionFteData.fte,
  revenue,
)

// ────────────────────────────────────────────────────────────────────────────
// Sheet builders
// ────────────────────────────────────────────────────────────────────────────

function sheetOverview() {
  const rows = derived.years.map((y) => {
    const k = derived.byYear[y].kpis
    return {
      'FY':                y,
      'Total Revenue (Cr)':       r2(k.totalRevenue),
      'Revenue FC1 (Cr)':         r2(k.revFc1),
      'Revenue FC2 (Cr)':         r2(k.revFc2),
      'Total Cost (Cr)':          r2(k.totalCost),
      'Cost FC1 (Cr)':            r2(k.costFc1),
      'Cost FC2 (Cr)':            r2(k.costFc2),
      'EBIT (Cr)':                r2(k.ebit),
      'Net Profit Actual (Cr)':   r2(k.netProfit),
      'Net Profit FC1 (Cr)':      r2(k.netProfitFc1),
      'Net Profit FC2 (Cr)':      r2(k.netProfitFc2),
      'Net Margin %':             r2(k.margin),
      'YoY Growth %':             k.yoyGrowth ?? '',
    }
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetPLStatement() {
  // Per-year P&L lines: Service Fees, Other Income, Interest, PEX, OPEX, EBIT, Tax, NetResult, CAPEX
  const rows = []
  derived.years.forEach((y) => {
    const rev = revenue.filter((r) => r.year === y)
    const cst = cost.filter((c) => c.year === y)
    const sumRev = (k) => r2(rev.reduce((s, r) => s + (r[k] || 0), 0) / CR)
    const sumCst = (filter, k) => r2(cst.filter(filter).reduce((s, c) => s + (c[k] || 0), 0) / CR)

    const rec = (label, actKey, fc1Key, fc2Key, isCost = false, filterFn = null) => {
      const act = filterFn ? sumCst(filterFn, actKey) : sumRev(actKey)
      const fc1 = filterFn ? sumCst(filterFn, fc1Key) : sumRev(fc1Key)
      const fc2 = filterFn ? sumCst(filterFn, fc2Key) : sumRev(fc2Key)
      rows.push({
        FY: y,
        Line: label,
        'Actual (Cr)': isCost ? -act : act,
        'FC1 (Cr)':    isCost ? -fc1 : fc1,
        'FC2 (Cr)':    isCost ? -fc2 : fc2,
        'Var·F1 (Cr)': r2((isCost ? -act + fc1 : act - fc1)),
        'Var·F2 (Cr)': r2((isCost ? -act + fc2 : act - fc2)),
      })
    }

    rec('Service Fees',  'actServiceFees', 'fc1ServiceFees', 'fc2ServiceFees')
    rec('Other Income',  'actOtherIncome', 'fc1OtherIncome', 'fc2OtherIncome')
    rec('Interest Income', 'actInterest',  'fc1Interest',    'fc2Interest')
    rec('PEX (Personnel)', 'actual', 'fc1', 'fc2', true, (c) => c.costType === 'PEX')
    rec('OPEX (Operating)', 'actual', 'fc1', 'fc2', true, (c) => c.costType === 'OPEX')

    // EBIT = SF + OtherInc - PEX - OPEX
    const sf  = sumRev('actServiceFees'),    sfF1 = sumRev('fc1ServiceFees'), sfF2 = sumRev('fc2ServiceFees')
    const oi  = sumRev('actOtherIncome'),    oiF1 = sumRev('fc1OtherIncome'), oiF2 = sumRev('fc2OtherIncome')
    const pex = sumCst((c) => c.costType === 'PEX', 'actual')
    const pexF1 = sumCst((c) => c.costType === 'PEX', 'fc1')
    const pexF2 = sumCst((c) => c.costType === 'PEX', 'fc2')
    const opex = sumCst((c) => c.costType === 'OPEX', 'actual')
    const opexF1 = sumCst((c) => c.costType === 'OPEX', 'fc1')
    const opexF2 = sumCst((c) => c.costType === 'OPEX', 'fc2')
    const ebit  = r2(sf  + oi  - pex  - opex)
    const ebitF1 = r2(sfF1 + oiF1 - pexF1 - opexF1)
    const ebitF2 = r2(sfF2 + oiF2 - pexF2 - opexF2)
    rows.push({ FY: y, Line: 'EBIT', 'Actual (Cr)': ebit, 'FC1 (Cr)': ebitF1, 'FC2 (Cr)': ebitF2,
                'Var·F1 (Cr)': r2(ebit - ebitF1), 'Var·F2 (Cr)': r2(ebit - ebitF2) })

    rec('Tax', 'actTax', 'fc1Tax', 'fc2Tax', true)

    // Net Result = EBIT + Interest - Tax
    const intAct = sumRev('actInterest'), intF1 = sumRev('fc1Interest'), intF2 = sumRev('fc2Interest')
    const taxAct = sumRev('actTax'),      taxF1 = sumRev('fc1Tax'),     taxF2 = sumRev('fc2Tax')
    const net   = r2(ebit  + intAct - taxAct)
    const netF1 = r2(ebitF1 + intF1 - taxF1)
    const netF2 = r2(ebitF2 + intF2 - taxF2)
    rows.push({ FY: y, Line: 'Net Result', 'Actual (Cr)': net, 'FC1 (Cr)': netF1, 'FC2 (Cr)': netF2,
                'Var·F1 (Cr)': r2(net - netF1), 'Var·F2 (Cr)': r2(net - netF2) })

    rec('CAPEX (Capital)', 'actual', 'fc1', 'fc2', true, (c) => c.costType === 'CAPEX')
    rows.push({})  // blank row separator
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetMonthlyPL() {
  const rows = []
  derived.years.forEach((y) => {
    derived.byYear[y].monthly.forEach((m) => {
      rows.push({
        FY: y,
        Month: m.month,
        'Revenue Actual (Cr)': r2(m.revAct),
        'Revenue FC1 (Cr)':    r2(m.revFc1),
        'Revenue FC2 (Cr)':    r2(m.revFc2),
        'Cost Actual (Cr)':    r2(m.costAct),
        'Cost FC1 (Cr)':       r2(m.costFc1),
        'Cost FC2 (Cr)':       r2(m.costFc2),
        'Net Profit Actual (Cr)': r2(m.npAct),
        'Net Profit FC1 (Cr)':    r2(m.npFc1),
        'Net Profit FC2 (Cr)':    r2(m.npFc2),
        'Net Margin %':            r2(m.npRatio),
        'YoY Growth %':            m.yoy ?? '',
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetDepartmentAnnual() {
  const rows = []
  derived.years.forEach((y) => {
    derived.byYear[y].byDept.forEach((d) => {
      rows.push({
        FY: y,
        Department: d.department,
        'Revenue Actual (Cr)': r2(d.revAct),
        'Cost Actual (Cr)':    r2(d.costAct),
        'Cost FC1 (Cr)':       r2(d.costFc1),
        'Cost FC2 (Cr)':       r2(d.costFc2),
        'EBIT (Cr)':           r2(d.ebit),
        'EBIT Margin %':       r2(d.margin),
        'FC1→FC2 Plan Change (Cr)': r2(d.planChange),
        'FC2→Actual Exec Change (Cr)': r2(d.execChange),
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetEBITMatrix() {
  const rows = []
  derived.years.forEach((y) => {
    const M = derived.byYear[y].ebitMatrix
    M.forEach((d) => {
      const rec = { FY: y, Department: d.department }
      MONTHS.forEach((m) => {
        const cell = d.cells.find((c) => c.month === m)
        rec[m] = cell ? r2(cell.ebit) : ''
      })
      rec['FY Total (Cr)'] = r2(d.total)
      rows.push(rec)
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetCostByType() {
  const rows = []
  derived.years.forEach((y) => {
    derived.byYear[y].costByType.forEach((c) => {
      rows.push({
        FY: y,
        'Cost Type': c.type,
        'Actual (Cr)': r2(c.actual),
        'FC1 (Cr)':    r2(c.fc1),
        'FC2 (Cr)':    r2(c.fc2),
        'Var·F1 (Cr)': r2(c.actual - c.fc1),
        'Var·F2 (Cr)': r2(c.actual - c.fc2),
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetCostSubCategory() {
  const rows = []
  derived.years.forEach((y) => {
    const rs = cost.filter((c) => c.year === y)
    const subs = [...new Set(rs.map((r) => r.subCategory))].filter(Boolean)
    subs.forEach((sub) => {
      const sr = rs.filter((r) => r.subCategory === sub)
      const ct = sr[0].costType
      const act = r2(sr.reduce((s, r) => s + r.actual, 0) / CR)
      const f1  = r2(sr.reduce((s, r) => s + r.fc1, 0) / CR)
      const f2  = r2(sr.reduce((s, r) => s + r.fc2, 0) / CR)
      rows.push({
        FY: y,
        'Cost Type': ct,
        'Sub-Category': sub,
        'Actual (Cr)': act,
        'FC1 (Cr)':    f1,
        'FC2 (Cr)':    f2,
        'Var·F1 (Cr)': r2(act - f1),
        'Var·F2 (Cr)': r2(act - f2),
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetServiceRevenueAnnual() {
  const rows = []
  Object.keys(serviceRevenue).forEach((y) => {
    serviceRevenue[y].byDept.forEach((d) => {
      rows.push({
        FY: y,
        Department: d.dept,
        'FTE Revenue (Cr)':    r2(d.fteRevenue),
        'Txn Revenue (Cr)':    r2(d.txnRevenue),
        'Total Service Fees (Cr)': r2(d.total),
        'FTE % of Total':      d.total > 0 ? r2((d.fteRevenue / d.total) * 100) : 0,
        'Txn % of Total':      d.total > 0 ? r2((d.txnRevenue / d.total) * 100) : 0,
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetServiceMonthly() {
  const rows = []
  Object.keys(serviceRevenue).forEach((y) => {
    serviceRevenue[y].byDept.forEach((d) => {
      d.monthly.forEach((m) => {
        rows.push({
          FY: y,
          Department: d.dept,
          Month: m.month,
          'FTE Revenue (Cr)':   r2(m.fteRevenue),
          'Txn Revenue (Cr)':   r2(m.txnRevenue),
          'Total (Cr)':          r2(m.total),
        })
      })
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

function sheetTransactionsRaw() {
  const rows = transactionFteData.transactions.map((t) => ({
    FY: t.year,
    Month: t.month,
    Department: t.dept,
    Service: t.serviceName,
    'Txn Count': t.txnCount,
    'Rate per Txn (INR)': t.ratePerTxn,
    'Revenue (INR)': t.txnCount * t.ratePerTxn,
    'Revenue (Cr)':  r2((t.txnCount * t.ratePerTxn) / CR),
  }))
  return XLSX.utils.json_to_sheet(rows)
}

function sheetFTERaw() {
  const rows = transactionFteData.fte.map((f) => ({
    FY: f.year,
    Month: f.month,
    Department: f.dept,
    Function: f.functionName,
    'FTE Count': f.fteCount,
    'Rate per FTE (INR)': f.ratePerFte,
    'Revenue (INR)': f.fteCount * f.ratePerFte,
    'Revenue (Cr)':  r2((f.fteCount * f.ratePerFte) / CR),
  }))
  return XLSX.utils.json_to_sheet(rows)
}

function sheetRevenueRaw() {
  const rows = revenue.map((r) => ({
    FY: r.year,
    Month: r.month,
    Department: r.department,
    'Service Fees · Actual (INR)': r.actServiceFees,
    'Service Fees · FC1 (INR)':    r.fc1ServiceFees,
    'Service Fees · FC2 (INR)':    r.fc2ServiceFees,
    'Other Income · Actual (INR)': r.actOtherIncome,
    'Other Income · FC1 (INR)':    r.fc1OtherIncome,
    'Other Income · FC2 (INR)':    r.fc2OtherIncome,
    'Interest · Actual (INR)':     r.actInterest,
    'Interest · FC1 (INR)':        r.fc1Interest,
    'Interest · FC2 (INR)':        r.fc2Interest,
    'Tax · Actual (INR)':          r.actTax,
    'Tax · FC1 (INR)':              r.fc1Tax,
    'Tax · FC2 (INR)':              r.fc2Tax,
    Comments: r.comments ?? '',
  }))
  return XLSX.utils.json_to_sheet(rows)
}

function sheetCostRaw() {
  const rows = cost.map((c) => ({
    FY: c.year,
    Month: c.month,
    Department: c.department,
    'Cost Type': c.costType,
    'Sub-Category': c.subCategory,
    'Actual (INR)': c.actual,
    'FC1 (INR)':    c.fc1,
    'FC2 (INR)':    c.fc2,
    'Actual (Cr)':  r2(c.actual / CR),
    'FC1 (Cr)':     r2(c.fc1 / CR),
    'FC2 (Cr)':     r2(c.fc2 / CR),
    Comments: c.comments ?? '',
  }))
  return XLSX.utils.json_to_sheet(rows)
}

function sheetDataAudit() {
  const rows = []
  derived.years.forEach((y) => {
    const rev = revenue.filter((r) => r.year === y)
    const cst = cost.filter((c) => c.year === y)
    const monthsWithRev = [...new Set(rev.map((r) => r.month))]
    const monthsWithActuals = [...new Set(rev.filter((r) => r.actServiceFees > 0).map((r) => r.month))]
    const depts = [...new Set(rev.map((r) => r.department))]
    rows.push({
      'FY': y,
      'Revenue Rows': rev.length,
      'Cost Rows':    cst.length,
      'Departments':  depts.length,
      'Months in Plan': monthsWithRev.length,
      'Months with Actuals': monthsWithActuals.length,
      'Last Actual Month':   monthsWithActuals[monthsWithActuals.length - 1] ?? '-',
      'Negative Revenue Rows': rev.filter((r) => r.actServiceFees < 0).length,
      'Negative Cost Rows':    cst.filter((c) => c.actual < 0).length,
      'Total Rev Actual (Cr)': r2(rev.reduce((s, r) =>
        s + (r.actServiceFees || 0) + (r.actOtherIncome || 0) + (r.actInterest || 0), 0) / CR),
      'Total Cost Actual (Cr)': r2(cst.reduce((s, c) => s + (c.actual || 0), 0) / CR),
    })
  })
  return XLSX.utils.json_to_sheet(rows)
}

// ────────────────────────────────────────────────────────────────────────────
// Build workbook
// ────────────────────────────────────────────────────────────────────────────

const wb = XLSX.utils.book_new()

const sheets = [
  ['Overview',              sheetOverview()],
  ['PL Statement',          sheetPLStatement()],
  ['Monthly P&L',           sheetMonthlyPL()],
  ['Department Annual',     sheetDepartmentAnnual()],
  ['EBIT Matrix DeptxMonth',sheetEBITMatrix()],
  ['Cost By Type',          sheetCostByType()],
  ['Cost Sub-Category',     sheetCostSubCategory()],
  ['Service Revenue Annual',sheetServiceRevenueAnnual()],
  ['Service Monthly',       sheetServiceMonthly()],
  ['Transactions Raw',      sheetTransactionsRaw()],
  ['FTE Raw',               sheetFTERaw()],
  ['Revenue Raw',           sheetRevenueRaw()],
  ['Cost Raw',              sheetCostRaw()],
  ['Data Audit',            sheetDataAudit()],
]

sheets.forEach(([name, ws]) => XLSX.utils.book_append_sheet(wb, ws, name))

// Console audit summary
console.log('GMR SSC Data Export - sanity audit')
console.log('───────────────────────────────────')
derived.years.forEach((y) => {
  const k = derived.byYear[y].kpis
  const rev = revenue.filter((r) => r.year === y)
  const actMonths = [...new Set(rev.filter((r) => r.actServiceFees > 0).map((r) => r.month))]
  console.log(
    `FY ${y}:  Rev=₹${k.totalRevenue.toFixed(1)} Cr  Cost=₹${k.totalCost.toFixed(1)} Cr  ` +
    `Net=₹${k.netProfit.toFixed(1)} Cr  Margin=${k.margin.toFixed(1)}%  ` +
    `Actuals through ${actMonths[actMonths.length - 1] ?? '-'} (${actMonths.length} mo)`
  )
})

const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(OUT, buf)
console.log(`\n✓ Wrote ${OUT}`)
console.log(`  ${sheets.length} sheets · ${revenue.length} revenue rows · ${cost.length} cost rows`)
