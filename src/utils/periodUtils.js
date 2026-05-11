import { MONTHS } from './computeDerived'

export const QUARTERS = {
  Q1: ['Jan', 'Feb', 'Mar'],
  Q2: ['Apr', 'May', 'Jun'],
  Q3: ['Jul', 'Aug', 'Sep'],
  Q4: ['Oct', 'Nov', 'Dec'],
}

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100

// Returns which months are active given the current period selection
export function getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths) {
  if (periodMode === 'year') return availMonths
  if (periodMode === 'quarter') return (QUARTERS[selectedQ] ?? []).filter((m) => availMonths.includes(m))
  return availMonths.includes(selectedPeriodMonth) ? [selectedPeriodMonth] : []
}

// Returns a human-readable period label
export function getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year) {
  if (periodMode === 'year')    return `FY ${year}`
  if (periodMode === 'quarter') return `${selectedQ} · FY ${year}`
  return `${selectedPeriodMonth} · FY ${year}`
}

// Derive KPI-level aggregates by filtering the pre-computed Y.monthly array.
// Avoids needing rawRevenue/rawCost in display components.
export function derivePeriodKPIs(monthly, activeMonths) {
  const rows = monthly.filter((m) => activeMonths.includes(m.month))
  if (!rows.length) return null

  const totalRevenue   = r2(rows.reduce((s, m) => s + m.revAct,   0))
  const revFc1         = r2(rows.reduce((s, m) => s + m.revFc1,   0))
  const revFc2         = r2(rows.reduce((s, m) => s + m.revFc2,   0))
  const totalCost      = r2(rows.reduce((s, m) => s + m.costAct,  0))
  const costFc1        = r2(rows.reduce((s, m) => s + m.costFc1,  0))
  const costFc2        = r2(rows.reduce((s, m) => s + m.costFc2,  0))
  const ebit           = r2(rows.reduce((s, m) => s + (m.ebitAct ?? 0), 0))
  const ebitFc1        = r2(rows.reduce((s, m) => s + (m.ebitFc1 ?? 0), 0))
  const ebitFc2        = r2(rows.reduce((s, m) => s + (m.ebitFc2 ?? 0), 0))
  const netProfit      = r2(rows.reduce((s, m) => s + m.npAct,    0))
  const netProfitFc1   = r2(rows.reduce((s, m) => s + m.npFc1,   0))
  const netProfitFc2   = r2(rows.reduce((s, m) => s + m.npFc2,   0))
  const margin         = totalRevenue > 0 ? r2((netProfit / totalRevenue) * 100) : 0
  const ebitMargin     = totalRevenue > 0 ? r2((ebit / totalRevenue) * 100) : 0

  return {
    totalRevenue, revFc1, revFc2,
    totalCost, costFc1, costFc2,
    ebit, ebitFc1, ebitFc2, ebitMargin,
    netProfit, netProfitFc1, netProfitFc2,
    margin,
    yoyGrowth: null,  // not meaningful for sub-periods
  }
}

// Derive cost-by-type breakdown (PEX/OPEX/CAPEX) for a period from rawCost.
export function derivePeriodCostByType(rawCost, year, months) {
  const rows = rawCost.filter((c) => c.year === year && months.includes(c.month))
  return ['PEX', 'OPEX', 'CAPEX'].map((t) => {
    const tRows = rows.filter((c) => c.costType === t)
    return {
      type:   t,
      actual: r2(tRows.reduce((s, c) => s + c.actual, 0) / CR),
      fc1:    r2(tRows.reduce((s, c) => s + c.fc1,    0) / CR),
      fc2:    r2(tRows.reduce((s, c) => s + c.fc2,    0) / CR),
    }
  })
}

// Derive department EBIT/margin for a period from raw data.
// Uses SF + OtherIncome as operating revenue; PEX + OPEX + CAPEX as operating cost.
export function derivePeriodByDept(rawRevenue, rawCost, departments, year, months) {
  const revRows = rawRevenue.filter((r) => r.year === year && months.includes(r.month))
  const cstRows = rawCost.filter((c) => c.year === year && months.includes(c.month))

  return departments.map((dept) => {
    const rR = revRows.filter((r) => r.department === dept)
    const cR = cstRows.filter((c) => c.department === dept)

    const opsRev = r2(
      rR.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0) / CR
    )
    const totalRev = r2(
      rR.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0) + (r.actInterest || 0), 0) / CR
    )
    const opsCost = r2(cR.reduce((s, c) => s + c.actual, 0) / CR)
    const totalCost = r2(cR.reduce((s, c) => s + c.actual, 0) / CR)
    const costFc1   = r2(cR.reduce((s, c) => s + c.fc1, 0) / CR)
    const costFc2   = r2(cR.reduce((s, c) => s + c.fc2, 0) / CR)
    const ebit      = r2(opsRev - opsCost)

    return {
      department: dept,
      revAct:  totalRev,
      costAct: totalCost,
      costFc1, costFc2,
      ebit,
      margin: opsRev > 0 ? r2((ebit / opsRev) * 100) : 0,
    }
  }).sort((a, b) => b.ebit - a.ebit)
}

// Compute the available months for a given year from rawRevenue.
// We treat months with positive actual service fees as available so panels stop at the last actual month.
export function getAvailMonths(rawRevenue, year) {
  return MONTHS.filter((m) =>
    rawRevenue.some((r) => r.year === year && r.month === m && (r.actServiceFees || 0) > 0)
  )
}

// Returns the last month that has non-zero actuals in the given year
export function getLastActualMonth(rawRevenue, year) {
  const availMonths = getAvailMonths(rawRevenue, year)
  return (
    [...availMonths].reverse().find((m) =>
      rawRevenue.some((r) => r.year === year && r.month === m && r.actServiceFees > 0)
    ) || availMonths[availMonths.length - 1] || 'Dec'
  )
}

// Returns the quarter key ('Q1'-'Q4') that contains the given month
export function monthToQuarter(month) {
  return Object.keys(QUARTERS).find((q) => QUARTERS[q].includes(month)) ?? 'Q1'
}
