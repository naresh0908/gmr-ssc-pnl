import { sampleData } from '../src/data/sampleData.js'

const rawCost = sampleData.cost
const year = 2026
const monthsOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// months that have any actuals for the target year
const monthsWithActual = [...new Set(rawCost.filter(c=>c.year===year && (c.actual||0)>0).map(c=>c.month))]
monthsWithActual.sort((a,b)=>monthsOrder.indexOf(a)-monthsOrder.indexOf(b))

// helper to sum values for given filters
const sum = (rows, field) => rows.reduce((s,c)=>s + (c[field]||0), 0)

// OPEX rows for the months we have actuals (YTD)
const opexYTD = rawCost.filter(c=>c.year===year && c.costType==='OPEX' && monthsWithActual.includes(c.month))
const monthsElapsed = monthsWithActual.length

// Primary measures (raw sums)
const actYTD = sum(opexYTD, 'actual')
const fc2YTD = sum(opexYTD, 'fc2')

// Baseline 1: FC2 for same months (what the plan expected for these months)
const pct_vs_fc2 = fc2YTD>0 ? (actYTD - fc2YTD) / fc2YTD * 100 : NaN

// Baseline 2: Prior year actuals for the same months (YoY)
const priorYear = year - 1
const opexPriorYTD = rawCost.filter(c=>c.year===priorYear && c.costType==='OPEX' && monthsWithActual.includes(c.month))
const priorActYTD = sum(opexPriorYTD, 'actual')
const pct_vs_priorYTD = priorActYTD>0 ? (actYTD - priorActYTD) / priorActYTD * 100 : NaN

// Full-year references (if available)
const opexPriorFull = rawCost.filter(c=>c.year===priorYear && c.costType==='OPEX')
const priorFullActual = sum(opexPriorFull, 'actual')
const opexFc2Full = rawCost.filter(c=>c.year===year && c.costType==='OPEX')
const fc2Full = sum(opexFc2Full, 'fc2')

// Annualisation methods
let projectedSimple = NaN // simple linear extrapolation
let projectedSeasonal = NaN // seasonally-adjusted using prior-year month shares
if (monthsElapsed>0) projectedSimple = actYTD / monthsElapsed * 12
if (priorFullActual>0) {
	const priorShareOfYear = sum(opexPriorYTD, 'actual') / priorFullActual
	if (priorShareOfYear>0) projectedSeasonal = actYTD / priorShareOfYear
}

// Compare projections to prior full year (if available)
const projSimplePctVsPriorFull = priorFullActual>0 ? (projectedSimple - priorFullActual) / priorFullActual * 100 : NaN
const projSeasonalPctVsPriorFull = priorFullActual>0 ? (projectedSeasonal - priorFullActual) / priorFullActual * 100 : NaN

// H2 run-rate (Jul-Dec). If no H2 actuals present, show N/A
const h2Months = monthsOrder.slice(6,12) // Jul..Dec
const h2ActualRows = rawCost.filter(c=>c.year===year && c.costType==='OPEX' && h2Months.includes(c.month) && (c.actual||0)>0)
const h2MonthsPresent = [...new Set(h2ActualRows.map(r=>r.month))].sort((a,b)=>monthsOrder.indexOf(a)-monthsOrder.indexOf(b))
const h2ActualSum = sum(h2ActualRows, 'actual')
let h2RunRate = null
if (h2MonthsPresent.length===0) {
	h2RunRate = null // N/A
} else {
	// monthly average * 6 months to get H2 full run-rate
	const avgMonthlyH2 = h2ActualSum / h2MonthsPresent.length
	h2RunRate = avgMonthlyH2 * 6
}

// Driver breakdown (by subCategory and department) for YTD actuals
const bySub = {}
const byDept = {}
for (const r of opexYTD) {
	const sub = r.subCategory || 'Other'
	const dept = r.department || 'Other'
	bySub[sub] = (bySub[sub]||0) + (r.actual||0)
	byDept[dept] = (byDept[dept]||0) + (r.actual||0)
}
const topSub = Object.entries(bySub).sort((a,b)=>b[1]-a[1]).slice(0,10)
const topDept = Object.entries(byDept).sort((a,b)=>b[1]-a[1]).slice(0,10)

// Scale to Crores for display (matches existing scripts)
const scale = 1e7
const fmt = v => (v/scale).toFixed(2)

// Human-friendly output
console.log('--- OPEX YTD Check — Detailed Explanation ---')
console.log(`Year: ${year}`)
console.log(`Months with actuals (YTD): ${monthsWithActual.join(', ') || 'None'}`)
console.log('')
console.log(`OPEX actual (YTD) (Cr): ${fmt(actYTD)}`)
console.log(`Baseline A — FC2 for same months (Cr): ${fmt(fc2YTD)}  → Δ: ${((actYTD-fc2YTD)/scale).toFixed(2)} Cr (${isNaN(pct_vs_fc2)?'N/A':pct_vs_fc2.toFixed(2)+'%'})`)
console.log(`Baseline B — Prior year actuals for same months (YoY YTD) (Cr): ${fmt(priorActYTD)}  → Δ: ${((actYTD-priorActYTD)/scale).toFixed(2)} Cr (${isNaN(pct_vs_priorYTD)?'N/A':pct_vs_priorYTD.toFixed(2)+'%'})`)
console.log('')
console.log('How annualisation was calculated:')
if (!isNaN(projectedSimple)) console.log(`- Simple extrapolation: (YTD actual / months elapsed) * 12 = ${fmt(projectedSimple)} Cr`)
else console.log('- Simple extrapolation: N/A (no months elapsed)')
if (!isNaN(projectedSeasonal)) console.log(`- Seasonal adjustment (prior-year month shares): projects to ${fmt(projectedSeasonal)} Cr (uses prior full-year distribution)`)
else console.log('- Seasonal adjustment: N/A (prior full-year actual unavailable)')
if (priorFullActual>0) {
	console.log(`- Comparison to prior full-year actual (${fmt(priorFullActual)} Cr): simple Δ ${projSimplePctVsPriorFull.toFixed(2)}%, seasonal Δ ${projSeasonalPctVsPriorFull.toFixed(2)}%`)
} else if (fc2Full>0) {
	console.log(`- No prior full-year actual; full-year FC2 for this year is ${fmt(fc2Full)} Cr (use for plan comparison)`)
}
console.log('')
console.log('H2 run-rate (Jul-Dec):')
if (h2RunRate===null) {
	console.log('- H2 run-rate: N/A — no H2 actuals present yet')
} else {
	console.log(`- H2 months with actuals: ${h2MonthsPresent.join(', ')}`)
	console.log(`- H2 projected run-rate (6-month H2 based on available H2 months) (Cr): ${fmt(h2RunRate)}`)
}
console.log('')
console.log('Top OPEX drivers (YTD actuals):')
for (const [sub, val] of topSub) {
	const pctOfYTD = actYTD>0 ? val / actYTD * 100 : 0
	console.log(`- ${sub}: ${fmt(val)} Cr (${pctOfYTD.toFixed(1)}% of OPEX YTD)`)
}
console.log('')
console.log('Top departments by OPEX (YTD actuals):')
for (const [dept, val] of topDept) {
	const pctOfYTD = actYTD>0 ? val / actYTD * 100 : 0
	console.log(`- ${dept}: ${fmt(val)} Cr (${pctOfYTD.toFixed(1)}% of OPEX YTD)`)
}
console.log('')
console.log('Notes & checks to remove friction for readers:')
console.log('- "Baseline" is shown for both plan (FC2) and prior-year (YoY); we surface both so readers know which comparison is used.')
console.log('- "Annualised" uses two methods: simple linear extrapolation and a seasonal adjustment using prior-year monthly shares.')
console.log('- "H2 run-rate N/A" appears when there are no H2 actuals; we explicitly state why.')
console.log('- Drivers show top sub-categories and departments by amount and % of OPEX YTD so users can quickly see causes.')
console.log('')
console.log('If you want, I can:')
console.log('- produce a small CSV of the driver table')
console.log('- compute alternative annualisation (e.g., weighted by 3‑year seasonality)')
console.log('- wire this into the UI component that displays the insight to include the short plain‑language explanation shown above')
