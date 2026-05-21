import { sampleData } from '../src/data/sampleData.js'

const revenue = sampleData.revenue
const cost = sampleData.cost
const year = 2026
const availRevMonths = [...new Set(revenue.filter(r=>r.year===year && (r.actServiceFees||r.actOtherIncome||0)>0).map(r=>r.month))]
availRevMonths.sort((a,b)=>['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(a)-['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(b))
const availCostMonths = [...new Set(cost.filter(c=>c.year===year && (c.actual||0)>0).map(c=>c.month))].sort((a,b)=>['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(a)-['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(b))

console.log('Available revenue months:', availRevMonths.join(', '))
console.log('Available cost months:', availCostMonths.join(', '))
console.log('')

const departments = [...new Set(revenue.map(r=>r.department))]
function deptStats(dept) {
	const rRows = revenue.filter(r=>r.year===year && r.department===dept)
	const cRows = cost.filter(c=>c.year===year && c.department===dept)
	const opsRev = rRows.reduce((s,r)=>s + (r.actServiceFees||0) + (r.actOtherIncome||0),0)/1e7
	const totalRev = rRows.reduce((s,r)=>s + (r.actServiceFees||0) + (r.actOtherIncome||0) + (r.actInterest||0),0)/1e7
	const opsCost = cRows.reduce((s,c)=>s + (c.actual||0),0)/1e7
	const ebit = Math.round((opsRev - opsCost) * 100) / 100
	const margin = opsRev > 0 ? Math.round((ebit / opsRev) * 10000)/100 : 0
	return { department: dept, revAct: totalRev, opsRev, costAct: opsCost, ebit, margin }
}

const facility = deptStats(departments.find(d=>d.includes('Facility')))
const procurement = deptStats(departments.find(d=>d.includes('Procurement')))
console.log('Facility:', facility)
console.log('Procurement:', procurement)
const gap = facility && procurement ? Math.round((facility.margin - procurement.margin)*100)/100 : null
const uplift = procurement ? Math.round((procurement.revAct * (gap/100)) * 100) / 100 : null
console.log('Computed gap (ppt):', gap)
console.log('Computed uplift (Cr):', uplift)
console.log('Uplift formula: worstDept.revAct * (gap/100)')
console.log('Note: revAct and margins are based on available months (YTD if only partial months present).')
