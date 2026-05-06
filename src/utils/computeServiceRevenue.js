import { MONTHS } from './computeDerived'

const CR = 1e7
const round = (n) => Math.round(n * 100) / 100

function groupRevenue(txnRows, fteRows) {
  const txnRev = txnRows.reduce((s, t) => s + t.txnCount * t.ratePerTxn, 0)
  const fteRev = fteRows.reduce((s, f) => s + f.fteCount * f.ratePerFte, 0)
  return { txnRev: round(txnRev / CR), fteRev: round(fteRev / CR) }
}

export function computeServiceRevenue(transactions, fte) {
  const years = [...new Set([...transactions.map((t) => t.year), ...fte.map((f) => f.year)])]
  const byYear = {}

  years.forEach((y) => {
    const txnY = transactions.filter((t) => t.year === y)
    const fteY = fte.filter((f) => f.year === y)
    const depts = [...new Set([...txnY.map((t) => t.dept), ...fteY.map((f) => f.dept)])]

    // ---- Per-department aggregates ----
    const byDept = depts.map((dept) => {
      const dTxn = txnY.filter((t) => t.dept === dept)
      const dFte = fteY.filter((f) => f.dept === dept)

      // Annual totals
      const { txnRev: txnRevenue, fteRev: fteRevenue } = groupRevenue(dTxn, dFte)
      const total = round(txnRevenue + fteRevenue)

      // Monthly breakdown
      const monthly = MONTHS.map((m) => {
        const { txnRev, fteRev } = groupRevenue(
          dTxn.filter((t) => t.month === m),
          dFte.filter((f) => f.month === m),
        )
        return { month: m, txnRevenue: txnRev, fteRevenue: fteRev, total: round(txnRev + fteRev) }
      }).filter((m) => m.total > 0)

      // Transaction service breakdown
      const txnByService = Object.entries(
        dTxn.reduce((acc, t) => {
          if (!acc[t.serviceName]) acc[t.serviceName] = { rate: t.ratePerTxn, rows: [] }
          acc[t.serviceName].rows.push(t)
          return acc
        }, {}),
      )
        .map(([name, { rate, rows }]) => ({
          name,
          rate,
          totalTxns: rows.reduce((s, r) => s + r.txnCount, 0),
          revenue: round(rows.reduce((s, r) => s + r.txnCount * r.ratePerTxn, 0) / CR),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // FTE function breakdown
      const fteByFunction = Object.entries(
        dFte.reduce((acc, f) => {
          if (!acc[f.functionName]) acc[f.functionName] = { rate: f.ratePerFte, rows: [] }
          acc[f.functionName].rows.push(f)
          return acc
        }, {}),
      )
        .map(([name, { rate, rows }]) => ({
          name,
          rate,
          avgFte: round(rows.reduce((s, r) => s + r.fteCount, 0) / rows.length),
          revenue: round(rows.reduce((s, r) => s + r.fteCount * r.ratePerFte, 0) / CR),
        }))
        .sort((a, b) => b.revenue - a.revenue)

      return { dept, txnRevenue, fteRevenue, total, monthly, txnByService, fteByFunction }
    }).sort((a, b) => b.total - a.total)

    // ---- All-department monthly aggregate ----
    const monthly = MONTHS.map((m) => {
      const { txnRev, fteRev } = groupRevenue(
        txnY.filter((t) => t.month === m),
        fteY.filter((f) => f.month === m),
      )
      return { month: m, txnRevenue: txnRev, fteRevenue: fteRev, total: round(txnRev + fteRev) }
    }).filter((m) => m.total > 0)

    const totalTxn = round(byDept.reduce((s, d) => s + d.txnRevenue, 0))
    const totalFte = round(byDept.reduce((s, d) => s + d.fteRevenue, 0))

    byYear[y] = { byDept, monthly, totalTxn, totalFte, total: round(totalTxn + totalFte) }
  })

  return byYear
}
