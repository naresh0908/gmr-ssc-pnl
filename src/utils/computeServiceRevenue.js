import { MONTHS } from './computeDerived'

const CR = 1e7
const round = (n) => Math.round(n * 100) / 100

const getRowRevenue = (row, fallbackField1, fallbackField2) => {
  if (row && Number.isFinite(Number(row.revenue))) {
    return Number(row.revenue)
  }

  const value1 = Number(row?.[fallbackField1]) || 0
  const value2 = Number(row?.[fallbackField2]) || 0
  return value1 * value2
}

const sumRevenue = (rows, fallbackField1, fallbackField2) =>
  rows.reduce((total, row) => total + getRowRevenue(row, fallbackField1, fallbackField2), 0)

// Derive service revenue totals from row-level revenue stored in the billing sheets.
// Revenue is aggregated directly from txn/FTE rows and reconciled to the Revenue sheet totals.
export function computeServiceRevenue(transactions, fte, rawRevenue) {
  const years = [...new Set(rawRevenue.map((r) => r.year))].sort()
  const byYear = {}

  years.forEach((y) => {
    const txnY = transactions.filter((t) => t.year === y)
    const fteY = fte.filter((f) => f.year === y)
    const revY = rawRevenue.filter((r) => r.year === y)
    const depts = [...new Set(revY.map((r) => r.department))]

    const byDept = depts.map((dept) => {
      const dTxn = txnY.filter((t) => t.dept === dept)
      const dFte = fteY.filter((f) => f.dept === dept)
      const dRev = revY.filter((r) => r.department === dept)

      // Source of truth: Revenue sheet Service Fees
      const annualActSF = round(dRev.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)
      const total = annualActSF

      // FTE vs Transaction breakdown from the transaction/FTE sheets
      // Prorate to match the Revenue sheet total
      const txnRevenueRaw = round(sumRevenue(dTxn, 'txnCount', 'ratePerTxn') / CR)
      const fteRevenueRaw = round(sumRevenue(dFte, 'fteCount', 'ratePerFte') / CR)
      const breakdownTotal = round(txnRevenueRaw + fteRevenueRaw)
      
      // Prorate breakdown to match Revenue sheet total
      const scale = breakdownTotal > 0 ? total / breakdownTotal : 1
      const txnRevenue = round(txnRevenueRaw * scale)
      const fteRevenue = round(fteRevenueRaw * scale)

      // Monthly breakdown: totals from Revenue sheet Service Fees, with FTE/Txn split proriated
      const monthly = MONTHS.map((m) => {
        const mRev = dRev.filter((r) => r.month === m)
        const mTotal = round(mRev.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)
        
        if (mTotal === 0) return null

        // Prorate FTE vs Transaction breakdown to match Revenue sheet monthly total
        const mTxnRows = dTxn.filter((t) => t.month === m)
        const mFteRows = dFte.filter((f) => f.month === m)
        const mTxnRevenueRaw = round(sumRevenue(mTxnRows, 'txnCount', 'ratePerTxn') / CR)
        const mFteRevenueRaw = round(sumRevenue(mFteRows, 'fteCount', 'ratePerFte') / CR)
        const mBreakdownTotal = round(mTxnRevenueRaw + mFteRevenueRaw)
        
        const mScale = mBreakdownTotal > 0 ? mTotal / mBreakdownTotal : 1
        const mTxnRevenue = round(mTxnRevenueRaw * mScale)
        const mFteRevenue = round(mFteRevenueRaw * mScale)

        return { month: m, txnRevenue: mTxnRevenue, fteRevenue: mFteRevenue, total: mTotal }
      }).filter(Boolean)

      // Service-level breakdown comes directly from txn row revenue.
      const rawTxnByService = Object.entries(
        dTxn.reduce((acc, t) => {
          if (!acc[t.serviceName]) acc[t.serviceName] = { rate: t.ratePerTxn, rows: [] }
          acc[t.serviceName].rows.push(t)
          return acc
        }, {})
      ).map(([name, { rate, rows }]) => ({
        name,
        rate,
        totalTxns: rows.reduce((s, r) => s + r.txnCount, 0),
        rawRev: rows.reduce((s, r) => s + getRowRevenue(r, 'txnCount', 'ratePerTxn'), 0),
      }))
      const rawTxnSum = rawTxnByService.reduce((s, x) => s + x.rawRev, 0)
      const txnByService = rawTxnByService
        .map((x) => ({
          name: x.name,
          rate: x.rate,
          totalTxns: x.totalTxns,
          revenue: round(x.rawRev / CR),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Function-level breakdown comes directly from FTE row revenue.
      const rawFteByFunction = Object.entries(
        dFte.reduce((acc, f) => {
          if (!acc[f.functionName]) acc[f.functionName] = { rate: f.ratePerFte, rows: [] }
          acc[f.functionName].rows.push(f)
          return acc
        }, {})
      ).map(([name, { rate, rows }]) => ({
        name,
        rate,
        avgFte: round(rows.reduce((s, r) => s + r.fteCount, 0) / rows.length),
        rawRev: rows.reduce((s, r) => s + getRowRevenue(r, 'fteCount', 'ratePerFte'), 0),
      }))
      const fteByFunction = rawFteByFunction
        .map((x) => ({
          name: x.name,
          rate: x.rate,
          avgFte: x.avgFte,
          revenue: round(x.rawRev / CR),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      return { dept, txnRevenue, fteRevenue, total, annualActSF, monthly, txnByService, fteByFunction }
    }).sort((a, b) => b.total - a.total)

    // All-department monthly aggregate: source from Revenue sheet Service Fees
    const monthly = MONTHS.map((m) => {
      const mRev = revY.filter((r) => r.month === m)
      const mTotal = round(mRev.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)
      
      if (mTotal === 0) return null

      // Prorate FTE vs Transaction breakdown to match Revenue sheet total
      const mTxnRevRaw = round(txnY.filter((t) => t.month === m).reduce((s, t) => s + getRowRevenue(t, 'txnCount', 'ratePerTxn'), 0) / CR)
      const mFteRevRaw = round(fteY.filter((f) => f.month === m).reduce((s, f) => s + getRowRevenue(f, 'fteCount', 'ratePerFte'), 0) / CR)
      const mBreakdownTotal = round(mTxnRevRaw + mFteRevRaw)
      
      const mScale = mBreakdownTotal > 0 ? mTotal / mBreakdownTotal : 1
      const txnRev = round(mTxnRevRaw * mScale)
      const fteRev = round(mFteRevRaw * mScale)
      
      return { month: m, txnRevenue: txnRev, fteRevenue: fteRev, total: mTotal }
    }).filter(Boolean)

    const totalTxn = round(byDept.reduce((s, d) => s + d.txnRevenue, 0))
    const totalFte = round(byDept.reduce((s, d) => s + d.fteRevenue, 0))
    const total = round(byDept.reduce((s, d) => s + d.total, 0))

    byYear[y] = { byDept, monthly, totalTxn, totalFte, total }
  })

  return byYear
}
