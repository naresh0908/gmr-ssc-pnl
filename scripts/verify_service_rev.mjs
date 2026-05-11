import { transactionFteData } from '../src/data/transactionFteData.js'
import { sampleData } from '../src/data/sampleData.js'

const CR = 1e7
const years = [...new Set(sampleData.revenue.map((r) => r.year))].sort()

years.forEach((y) => {
  const revY = sampleData.revenue.filter((r) => r.year === y)
  const depts = [...new Set(revY.map((r) => r.department))]
  let totalDiff = 0

  depts.forEach((dept) => {
    const annualActSF = Math.round(
      (revY.filter((r) => r.department === dept).reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR) * 100
    ) / 100

    const dTxn = transactionFteData.transactions.filter((t) => t.year === y && t.dept === dept)
    const dFte = transactionFteData.fte.filter((f) => f.year === y && f.dept === dept)

    const rawTxnTotal = dTxn.reduce((s, t) => s + t.txnCount * t.ratePerTxn, 0)
    const rawFteTotal = dFte.reduce((s, f) => s + f.fteCount * f.ratePerFte, 0)
    const rawBillingTotal = rawTxnTotal + rawFteTotal
    const txnRatio = rawBillingTotal > 0 ? rawTxnTotal / rawBillingTotal : 0.5

    const txnRevenue = Math.round(annualActSF * txnRatio * 100) / 100
    const fteRevenue = Math.round((annualActSF - txnRevenue) * 100) / 100
    const diff = Math.round((annualActSF - (txnRevenue + fteRevenue)) * 100) / 100

    totalDiff += diff
  })

  const totalSample = Math.round((revY.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR) * 100) / 100
  console.log(`${y}: sampleTotal = ${totalSample.toFixed(2)} Cr | sumDeptDiff = ${totalDiff.toFixed(2)} Cr`)
})

// overall totals
const overallSample = years.reduce((a, y) => {
  return a + Math.round((sampleData.revenue.filter((r) => r.year === y).reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR) * 100) / 100
}, 0)
console.log(`Overall sample total (Cr) = ${overallSample.toFixed(2)}`)
