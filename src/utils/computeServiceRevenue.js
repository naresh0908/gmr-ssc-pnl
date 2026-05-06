import { MONTHS } from './computeDerived'

const CR = 1e7
const round = (n) => Math.round(n * 100) / 100

// Derive service revenue totals from rawRevenue (authoritative P&L source).
// FTE/Transaction split proportions are sourced from transactionFteData billing model.
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

      // Annual actual service fees from rawRevenue (matches PLStatement service fee line)
      const annualActSF = round(dRev.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)

      // FTE/Txn split proportions from billing model data
      const rawTxnTotal = dTxn.reduce((s, t) => s + t.txnCount * t.ratePerTxn, 0)
      const rawFteTotal = dFte.reduce((s, f) => s + f.fteCount * f.ratePerFte, 0)
      const rawBillingTotal = rawTxnTotal + rawFteTotal
      const txnRatio = rawBillingTotal > 0 ? rawTxnTotal / rawBillingTotal : 0.5

      const txnRevenue = round(annualActSF * txnRatio)
      const fteRevenue = round(annualActSF - txnRevenue)

      // Monthly breakdown: totals from rawRevenue, split from billing model
      const monthly = MONTHS.map((m) => {
        const mActSF = round(
          dRev.filter((r) => r.month === m).reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR
        )
        if (mActSF === 0) return null

        const mTxnRaw = dTxn.filter((t) => t.month === m).reduce((s, t) => s + t.txnCount * t.ratePerTxn, 0)
        const mFteRaw = dFte.filter((f) => f.month === m).reduce((s, f) => s + f.fteCount * f.ratePerFte, 0)
        const mBillingTotal = mTxnRaw + mFteRaw
        const mTxnRatio = mBillingTotal > 0 ? mTxnRaw / mBillingTotal : txnRatio

        const txnRev = round(mActSF * mTxnRatio)
        return { month: m, txnRevenue: txnRev, fteRevenue: round(mActSF - txnRev), total: mActSF }
      }).filter(Boolean)

      // Scale txnByService details to match scaled txnRevenue total
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
        rawRev: rows.reduce((s, r) => s + r.txnCount * r.ratePerTxn, 0),
      }))
      const rawTxnSum = rawTxnByService.reduce((s, x) => s + x.rawRev, 0)
      const txnByService = rawTxnByService
        .map((x) => ({
          name: x.name,
          rate: x.rate,
          totalTxns: x.totalTxns,
          revenue: round(rawTxnSum > 0 ? (txnRevenue * x.rawRev) / rawTxnSum : 0),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Scale fteByFunction details to match scaled fteRevenue total
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
        rawRev: rows.reduce((s, r) => s + r.fteCount * r.ratePerFte, 0),
      }))
      const rawFteSum = rawFteByFunction.reduce((s, x) => s + x.rawRev, 0)
      const fteByFunction = rawFteByFunction
        .map((x) => ({
          name: x.name,
          rate: x.rate,
          avgFte: x.avgFte,
          revenue: round(rawFteSum > 0 ? (fteRevenue * x.rawRev) / rawFteSum : 0),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      return { dept, txnRevenue, fteRevenue, total: annualActSF, monthly, txnByService, fteByFunction }
    }).sort((a, b) => b.total - a.total)

    // All-department monthly aggregate
    const monthly = MONTHS.map((m) => {
      const mActSF = round(revY.filter((r) => r.month === m).reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)
      if (mActSF === 0) return null
      const txnRev = round(byDept.reduce((s, d) => s + (d.monthly.find((mm) => mm.month === m)?.txnRevenue ?? 0), 0))
      return { month: m, txnRevenue: txnRev, fteRevenue: round(mActSF - txnRev), total: mActSF }
    }).filter(Boolean)

    const totalTxn = round(byDept.reduce((s, d) => s + d.txnRevenue, 0))
    const totalFte = round(byDept.reduce((s, d) => s + d.fteRevenue, 0))
    const total = round(revY.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)

    byYear[y] = { byDept, monthly, totalTxn, totalFte, total }
  })

  return byYear
}
