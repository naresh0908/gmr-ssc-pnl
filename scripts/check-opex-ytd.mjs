import { sampleData } from '../src/data/sampleData.js'
const rawCost = sampleData.cost
const year = 2026
const monthsWithActual = [...new Set(rawCost.filter(c=>c.year===year && (c.actual||0)>0).map(c=>c.month))]
monthsWithActual.sort((a,b)=>['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(a)-['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(b))
const opexRows = rawCost.filter(c=>c.year===year && c.costType==='OPEX' && monthsWithActual.includes(c.month))
const act = opexRows.reduce((s,c)=>s+(c.actual||0),0)/1e7
const fc2 = opexRows.reduce((s,c)=>s+(c.fc2||0),0)/1e7
const pct = fc2>0 ? ((act-fc2)/fc2)*100 : 0
console.log('Year:', year)
console.log('Months with cost actuals:', monthsWithActual.join(', '))
console.log('OPEX actual (Cr):', act.toFixed(2))
console.log('OPEX FC2 (same months) (Cr):', fc2.toFixed(2))
console.log('Δ (Cr):', (act-fc2).toFixed(2), 'Cr')
console.log('Δ % (vs FC2 for these months):', pct.toFixed(2)+'%')
console.log('Note: these are sums over months with actuals (YTD). Full-year FC2 may be larger if FC2 includes future months.')
