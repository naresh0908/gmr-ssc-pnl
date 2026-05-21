import { computeDerived } from '../src/utils/computeDerived.js'
import { sampleData } from '../src/data/sampleData.js'

const derived = computeDerived(sampleData.revenue, sampleData.cost)
const year = 2026

console.log('Computing monthly aggregates for', year)
const Y = derived.byYear?.[year]
if (!Y) {
  console.error('No derived data for year', year)
  process.exit(1)
}

const activeMonths = Y.monthly.map(m => m.month)
const monthly = Y.monthly.filter((m) => activeMonths.includes(m.month) && m.revAct > 0)
const avgNp = Math.round((monthly.reduce((s, m) => s + m.npAct, 0) / monthly.length) * 100) / 100
const avgNpFc2 = Math.round((monthly.reduce((s, m) => s + m.npFc2, 0) / monthly.length) * 100) / 100
const avgDelta = Math.round((avgNp - avgNpFc2) * 100) / 100
const monthsAboveFc2 = monthly.filter((m) => m.npAct >= m.npFc2).length

console.log('monthly.length =', monthly.length)
console.log('avgNp =', avgNp, 'avgNpFc2 =', avgNpFc2, 'avgDelta =', avgDelta)
console.log('monthsAboveFc2 =', monthsAboveFc2)
console.log('\nPer-month NP values:')
console.table(monthly.map(m => ({ month: m.month, npAct: m.npAct, npFc2: m.npFc2 })))
