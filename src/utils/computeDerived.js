export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const CR = 1e7   // 1 crore = 10^7

const sumRev = (rows, type) => rows.reduce(
  (a, r) => a + (r[`${type}ServiceFees`] || 0) + (r[`${type}OtherIncome`] || 0) + (r[`${type}Interest`] || 0),
  0
)

/**
 * Compute everything the dashboard needs from the raw sheets.
 * All money values returned in CRORES for display.
 */
export function computeDerived(revenue, cost) {
  const years = [...new Set(revenue.map((r) => r.year))].sort()
  const departments = [...new Set(revenue.map((r) => r.department))]

  // ---- Per-year aggregates ----
  const byYear = {}
  years.forEach((y) => {
    const rev = revenue.filter((r) => r.year === y)
    const cst = cost.filter((c) => c.year === y)

    const revAct = sumRev(rev, 'act') / CR
    const revFc1 = sumRev(rev, 'fc1') / CR
    const revFc2 = sumRev(rev, 'fc2') / CR
    const costAct = cst.reduce((a, c) => a + c.actual, 0) / CR
    const costFc1 = cst.reduce((a, c) => a + c.fc1, 0) / CR
    const costFc2 = cst.reduce((a, c) => a + c.fc2, 0) / CR

    // ---- Monthly series ----
    const monthly = MONTHS.map((m) => {
      const rRows = rev.filter((r) => r.month === m)
      const cRows = cst.filter((c) => c.month === m)
      const rAct = sumRev(rRows, 'act') / CR
      const rFc1 = sumRev(rRows, 'fc1') / CR
      const rFc2 = sumRev(rRows, 'fc2') / CR
      const cAct = cRows.reduce((a, c) => a + c.actual, 0) / CR
      const cFc1 = cRows.reduce((a, c) => a + c.fc1, 0) / CR
      const cFc2 = cRows.reduce((a, c) => a + c.fc2, 0) / CR
      return {
        month: m,
        revAct: round(rAct), revFc1: round(rFc1), revFc2: round(rFc2),
        costAct: round(cAct), costFc1: round(cFc1), costFc2: round(cFc2),
        npAct: round(rAct - cAct), npFc1: round(rFc1 - cFc1), npFc2: round(rFc2 - cFc2),
        npRatio: rAct > 0 ? round((rAct - cAct) / rAct * 100) : 0
      }
    }).filter(m => m.revAct > 0 || m.revFc1 > 0)

    // ---- Department aggregates ----
    const byDept = departments.map((d) => {
      const rRows = rev.filter((r) => r.department === d)
      const cRows = cst.filter((c) => c.department === d)
      const rAct = sumRev(rRows, 'act') / CR
      const cAct = cRows.reduce((a, c) => a + c.actual, 0) / CR
      const cFc1 = cRows.reduce((a, c) => a + c.fc1, 0) / CR
      const cFc2 = cRows.reduce((a, c) => a + c.fc2, 0) / CR
      return {
        department: d,
        revAct: round(rAct),
        costAct: round(cAct), costFc1: round(cFc1), costFc2: round(cFc2),
        ebit: round(rAct - cAct),
        margin: rAct > 0 ? round((rAct - cAct) / rAct * 100) : 0,
        // FC1 -> FC2 planning change
        planChange: round(cFc2 - cFc1),
        // FC2 -> Actual execution gap
        execChange: round(cAct - cFc2)
      }
    }).sort((a, b) => b.ebit - a.ebit)

    // ---- Cost type breakdown ----
    const costByType = ['PEX', 'OPEX', 'CAPEX'].map((t) => {
      const rows = cst.filter((c) => c.costType === t)
      return {
        type: t,
        actual: round(rows.reduce((a, c) => a + c.actual, 0) / CR),
        fc1: round(rows.reduce((a, c) => a + c.fc1, 0) / CR),
        fc2: round(rows.reduce((a, c) => a + c.fc2, 0) / CR)
      }
    })

    // ---- Monthly EBIT matrix (dept x month) ----
    const ebitMatrix = departments.map((d) => {
      const cells = MONTHS.map((m) => {
        const rRows = rev.filter((r) => r.department === d && r.month === m)
        const cRows = cst.filter((c) => c.department === d && c.month === m)
        const rAct = sumRev(rRows, 'act') / CR
        const cAct = cRows.reduce((a, c) => a + c.actual, 0) / CR
        return { month: m, ebit: round(rAct - cAct), revenue: round(rAct) }
      }).filter(c => c.revenue > 0)
      const total = round(cells.reduce((a, c) => a + c.ebit, 0))
      return { department: d, cells, total }
    }).sort((a, b) => b.total - a.total)

    byYear[y] = {
      kpis: {
        totalRevenue: round(revAct),
        totalCost: round(costAct),
        netProfit: round(revAct - costAct),
        margin: revAct > 0 ? round((revAct - costAct) / revAct * 100) : 0,
        revFc1: round(revFc1), revFc2: round(revFc2),
        costFc1: round(costFc1), costFc2: round(costFc2)
      },
      monthly,
      byDept,
      costByType,
      ebitMatrix
    }
  })

  // YoY growth on most recent year
  const latest = years[years.length - 1]
  const prev = years[years.length - 2]
  if (prev && byYear[latest] && byYear[prev]) {
    byYear[latest].kpis.yoyGrowth = round(
      (byYear[latest].kpis.totalRevenue - byYear[prev].kpis.totalRevenue) /
      byYear[prev].kpis.totalRevenue * 100
    )
    // Inject prior-year monthly revenue for YoY% on monthly bars
    byYear[latest].monthly = byYear[latest].monthly.map((m) => {
      const prevMonth = byYear[prev].monthly.find((x) => x.month === m.month)
      const yoy = prevMonth && prevMonth.revAct > 0
        ? round((m.revAct - prevMonth.revAct) / prevMonth.revAct * 100)
        : 0
      return { ...m, yoy }
    })
  }

  return { years, departments, byYear }
}

function round(n) { return Math.round(n * 100) / 100 }
