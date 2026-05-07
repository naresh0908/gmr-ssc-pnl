export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const CR = 1e7   // 1 crore = 10^7

// Operating revenue: Service Fees + Other Income (used for EBIT - Interest is a financial item, below EBIT)
const sumRevOps = (rows, type) => rows.reduce(
  (a, r) => a + (r[`${type}ServiceFees`] || 0) + (r[`${type}OtherIncome`] || 0),
  0
)
// All revenue including Interest - used for the "Total Revenue" KPI card only
const sumRev = (rows, type) => rows.reduce(
  (a, r) => a + (r[`${type}ServiceFees`] || 0) + (r[`${type}OtherIncome`] || 0) + (r[`${type}Interest`] || 0),
  0
)
const sumInt  = (rows, type) => rows.reduce((a, r) => a + (r[`${type}Interest`] || 0), 0)
const sumTax  = (rows, type) => rows.reduce((a, r) => a + (r[`${type}Tax`]      || 0), 0)

// Operating costs only (PEX + OPEX) - CAPEX is a capital item, excluded from EBIT / Net Result
const opsFilter = (c) => c.costType !== 'CAPEX'

/**
 * Compute everything the dashboard needs from the raw sheets.
 * All money values returned in CRORES for display.
 *
 * P&L formula (matches PLStatement):
 *   EBIT        = ServiceFees + OtherIncome − PEX − OPEX
 *   FinResult   = Interest − Tax
 *   Net Result  = EBIT + FinResult
 *   CAPEX shown below-the-line (not in Net Result)
 */
export function computeDerived(revenue, cost) {
  const years = [...new Set(revenue.map((r) => r.year))].sort()
  const departments = [...new Set(revenue.map((r) => r.department))]
  const customers = [...new Set(revenue.map((r) => r.customer).filter(Boolean))]

  const byYear = {}
  years.forEach((y) => {
    const rev = revenue.filter((r) => r.year === y)
    const cst = cost.filter((c) => c.year === y)

    // ── Revenue ──────────────────────────────────────────────────────────────
    // Total revenue (all streams) - for KPI "Total Revenue" card
    const revAct = sumRev(rev, 'act') / CR
    const revFc1 = sumRev(rev, 'fc1') / CR
    const revFc2 = sumRev(rev, 'fc2') / CR

    // Operating revenue (SF + OtherInc) - for EBIT
    const opsRevAct = sumRevOps(rev, 'act') / CR
    const opsRevFc1 = sumRevOps(rev, 'fc1') / CR
    const opsRevFc2 = sumRevOps(rev, 'fc2') / CR

    // Financial items
    const intAct = sumInt(rev, 'act') / CR
    const intFc1 = sumInt(rev, 'fc1') / CR
    const intFc2 = sumInt(rev, 'fc2') / CR
    const taxAct = sumTax(rev, 'act') / CR
    const taxFc1 = sumTax(rev, 'fc1') / CR
    const taxFc2 = sumTax(rev, 'fc2') / CR

    // ── Costs ─────────────────────────────────────────────────────────────────
    // All costs (PEX + OPEX + CAPEX) - for KPI "Total Cost" card
    const costAct = cst.reduce((a, c) => a + c.actual, 0) / CR
    const costFc1 = cst.reduce((a, c) => a + c.fc1, 0) / CR
    const costFc2 = cst.reduce((a, c) => a + c.fc2, 0) / CR

    // Operating costs (PEX + OPEX) - for EBIT
    const opsCostAct = cst.filter(opsFilter).reduce((a, c) => a + c.actual, 0) / CR
    const opsCostFc1 = cst.filter(opsFilter).reduce((a, c) => a + c.fc1, 0) / CR
    const opsCostFc2 = cst.filter(opsFilter).reduce((a, c) => a + c.fc2, 0) / CR

    // ── P&L aggregates ────────────────────────────────────────────────────────
    // EBIT = Operating Revenue − Operating Costs (matches PLStatement EBIT line)
    const ebitAct = opsRevAct - opsCostAct
    const ebitFc1 = opsRevFc1 - opsCostFc1
    const ebitFc2 = opsRevFc2 - opsCostFc2

    // Net Result = EBIT + Interest − Tax (matches PLStatement Net Result line)
    const netProfitAct = ebitAct + intAct - taxAct
    const netProfitFc1 = ebitFc1 + intFc1 - taxFc1
    const netProfitFc2 = ebitFc2 + intFc2 - taxFc2

    // ── Monthly series ────────────────────────────────────────────────────────
    const monthly = MONTHS.map((m) => {
      const rRows = rev.filter((r) => r.month === m)
      const cRows = cst.filter((c) => c.month === m)

      const rAct = sumRev(rRows, 'act') / CR
      const rFc1 = sumRev(rRows, 'fc1') / CR
      const rFc2 = sumRev(rRows, 'fc2') / CR

      const rOpsAct = sumRevOps(rRows, 'act') / CR
      const rOpsFc1 = sumRevOps(rRows, 'fc1') / CR
      const rOpsFc2 = sumRevOps(rRows, 'fc2') / CR

      const mIntAct = sumInt(rRows, 'act') / CR
      const mIntFc1 = sumInt(rRows, 'fc1') / CR
      const mIntFc2 = sumInt(rRows, 'fc2') / CR
      const mTaxAct = sumTax(rRows, 'act') / CR
      const mTaxFc1 = sumTax(rRows, 'fc1') / CR
      const mTaxFc2 = sumTax(rRows, 'fc2') / CR

      const cAct = cRows.reduce((a, c) => a + c.actual, 0) / CR
      const cFc1 = cRows.reduce((a, c) => a + c.fc1, 0) / CR
      const cFc2 = cRows.reduce((a, c) => a + c.fc2, 0) / CR

      const cOpsAct = cRows.filter(opsFilter).reduce((a, c) => a + c.actual, 0) / CR
      const cOpsFc1 = cRows.filter(opsFilter).reduce((a, c) => a + c.fc1, 0) / CR
      const cOpsFc2 = cRows.filter(opsFilter).reduce((a, c) => a + c.fc2, 0) / CR

      // EBIT per month = Operating Revenue − Operating Cost (no Interest, no Tax, no CAPEX)
      const ebitMAct = round(rOpsAct - cOpsAct)
      const ebitMFc1 = round(rOpsFc1 - cOpsFc1)
      const ebitMFc2 = round(rOpsFc2 - cOpsFc2)

      // Net profit per month = EBIT + Interest − Tax
      const npAct = round(rOpsAct - cOpsAct + mIntAct - mTaxAct)
      const npFc1 = round(rOpsFc1 - cOpsFc1 + mIntFc1 - mTaxFc1)
      const npFc2 = round(rOpsFc2 - cOpsFc2 + mIntFc2 - mTaxFc2)

      return {
        month: m,
        revAct: round(rAct), revFc1: round(rFc1), revFc2: round(rFc2),
        costAct: round(cAct), costFc1: round(cFc1), costFc2: round(cFc2),
        ebitAct: ebitMAct, ebitFc1: ebitMFc1, ebitFc2: ebitMFc2,
        npAct, npFc1, npFc2,
        npRatio: rAct > 0 ? round(npAct / rAct * 100) : 0
      }
    }).filter(m => m.revAct > 0 || m.revFc1 > 0)

    // ── Department aggregates ─────────────────────────────────────────────────
    const byDept = departments.map((d) => {
      const rRows = rev.filter((r) => r.department === d)
      const cRows = cst.filter((c) => c.department === d)

      const rAct     = sumRev(rRows, 'act') / CR      // total revenue (for display)
      const rOpsAct  = sumRevOps(rRows, 'act') / CR   // operating revenue (for EBIT)
      const cAct     = cRows.reduce((a, c) => a + c.actual, 0) / CR
      const cFc1     = cRows.reduce((a, c) => a + c.fc1, 0) / CR
      const cFc2     = cRows.reduce((a, c) => a + c.fc2, 0) / CR
      const cOpsAct  = cRows.filter(opsFilter).reduce((a, c) => a + c.actual, 0) / CR

      // EBIT = Operating Revenue − Operating Costs (matches PLStatement EBIT)
      const ebit = round(rOpsAct - cOpsAct)

      return {
        department: d,
        revAct: round(rAct),
        costAct: round(cAct), costFc1: round(cFc1), costFc2: round(cFc2),
        ebit,
        margin: rOpsAct > 0 ? round(ebit / rOpsAct * 100) : 0,
        planChange: round(cFc2 - cFc1),
        execChange: round(cAct - cFc2)
      }
    }).sort((a, b) => b.ebit - a.ebit)

    // ── Cost type breakdown ───────────────────────────────────────────────────
    const costByType = ['PEX', 'OPEX', 'CAPEX'].map((t) => {
      const rows = cst.filter((c) => c.costType === t)
      return {
        type: t,
        actual: round(rows.reduce((a, c) => a + c.actual, 0) / CR),
        fc1: round(rows.reduce((a, c) => a + c.fc1, 0) / CR),
        fc2: round(rows.reduce((a, c) => a + c.fc2, 0) / CR)
      }
    })

    // ── Monthly EBIT matrix (dept × month) ───────────────────────────────────
    // EBIT = Operating Revenue − Operating Costs (no Interest, no CAPEX, no Tax)
    const ebitMatrix = departments.map((d) => {
      const allCells = MONTHS.map((m) => {
        const rRows = rev.filter((r) => r.department === d && r.month === m)
        const cRows = cst.filter((c) => c.department === d && c.month === m)
        const rOpsAct = sumRevOps(rRows, 'act') / CR
        const cOpsAct = cRows.filter(opsFilter).reduce((a, c) => a + c.actual, 0) / CR
        return { month: m, ebit: round(rOpsAct - cOpsAct), revenue: round(rOpsAct) }
      })
      const total = round(allCells.reduce((a, c) => a + c.ebit, 0))
      const cells = allCells.filter(c => c.revenue > 0 || Math.abs(c.ebit) > 0.001)
      return { department: d, cells, total }
    }).sort((a, b) => b.total - a.total)

    // ── Monthly EBIT matrix (customer × month) ────────────────────────────────
    const ebitCustomerMatrix = customers.map((cu) => {
      const allCells = MONTHS.map((m) => {
        const rRows = rev.filter((r) => r.customer === cu && r.month === m)
        const cRows = cst.filter((c) => c.customer === cu && c.month === m)
        const rOpsAct = sumRevOps(rRows, 'act') / CR
        const cOpsAct = cRows.filter(opsFilter).reduce((a, c) => a + c.actual, 0) / CR
        return { month: m, ebit: round(rOpsAct - cOpsAct), revenue: round(rOpsAct) }
      })
      const total = round(allCells.reduce((a, c) => a + c.ebit, 0))
      const cells = allCells.filter(c => c.revenue > 0 || Math.abs(c.ebit) > 0.001)
      return { department: cu, cells, total }
    }).sort((a, b) => b.total - a.total)

    byYear[y] = {
      kpis: {
        totalRevenue: round(revAct),           // SF + OtherInc + Interest
        totalCost:    round(costAct),           // PEX + OPEX + CAPEX (total spend)
        netProfit:    round(netProfitAct),      // EBIT + Interest − Tax  ← matches PLStatement Net Result
        ebit:         round(ebitAct),           // SF + OtherInc − PEX − OPEX ← matches PLStatement EBIT
        margin: revAct > 0 ? round(netProfitAct / revAct * 100) : 0,
        revFc1: round(revFc1), revFc2: round(revFc2),
        costFc1: round(costFc1), costFc2: round(costFc2),
        netProfitFc1: round(netProfitFc1), netProfitFc2: round(netProfitFc2)
      },
      monthly,
      byDept,
      costByType,
      ebitMatrix,
      ebitCustomerMatrix
    }
  })

  // Compute YoY for every year vs the base year (years[0] = FY2024).
  // This ensures FY2025 shows deviation from the healthy baseline,
  // and FY2026 shows recovery progress vs the same anchor - not vs disrupted FY2025.
  // Months with no actuals in the current year (e.g. future months) get yoy = 0.
  const baseYr = years[0]
  const baseYrData = byYear[baseYr]
  years.forEach((y) => {
    if (y === baseYr || !byYear[y] || !baseYrData) return
    const cur = byYear[y]
    cur.kpis.yoyGrowth = baseYrData.kpis.totalRevenue > 0
      ? round((cur.kpis.totalRevenue - baseYrData.kpis.totalRevenue) / baseYrData.kpis.totalRevenue * 100)
      : 0
    cur.monthly = cur.monthly.map((m) => {
      const baseMonth = baseYrData.monthly.find((x) => x.month === m.month)
      const yoy = m.revAct > 0 && baseMonth && baseMonth.revAct > 0
        ? round((m.revAct - baseMonth.revAct) / baseMonth.revAct * 100)
        : 0
      return { ...m, yoy }
    })
  })

  return { years, departments, byYear }
}

function round(n) { return Math.round(n * 100) / 100 }
