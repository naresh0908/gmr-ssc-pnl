import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'

const repoRoot = process.cwd()
const workbookPath = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')
const TAX_RATE = 0.23 // 23% of EBIT
const CR = 1e7 // Crore divider

function readRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Missing sheet "${sheetName}"`)
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

console.log('Reading workbook...')
const workbook = XLSX.readFile(workbookPath)
const revenueRows = readRows(workbook, 'Revenue')
const costRows = readRows(workbook, 'Cost')

// Group costs by year, month, department
const costsByYearMonthDept = {}
costRows.forEach(row => {
  const key = `${row.year}|${row.month}|${row.department}`
  if (!costsByYearMonthDept[key]) {
    costsByYearMonthDept[key] = { actual: 0, fc1: 0, fc2: 0 }
  }
  costsByYearMonthDept[key].actual += parseFloat(row.actual) || 0
  costsByYearMonthDept[key].fc1 += parseFloat(row.fc1) || 0
  costsByYearMonthDept[key].fc2 += parseFloat(row.fc2) || 0
})

// Recalculate taxes for each revenue row
console.log('Recalculating taxes as 23% of EBIT...')
let count = 0
revenueRows.forEach(row => {
  const year = row.year
  const month = row.month
  const dept = row.department
  const key = `${year}|${month}|${dept}`
  
  const costs = costsByYearMonthDept[key] || { actual: 0, fc1: 0, fc2: 0 }
  
  // Calculate EBIT = ServiceFees + OtherIncome - Costs
  const revActual = (parseFloat(row.actServiceFees) || 0) + (parseFloat(row.actOtherIncome) || 0)
  const revFc1 = (parseFloat(row.fc1ServiceFees) || 0) + (parseFloat(row.fc1OtherIncome) || 0)
  const revFc2 = (parseFloat(row.fc2ServiceFees) || 0) + (parseFloat(row.fc2OtherIncome) || 0)
  
  const ebitActual = revActual - costs.actual
  const ebitFc1 = revFc1 - costs.fc1
  const ebitFc2 = revFc2 - costs.fc2
  
  // Calculate tax as 23% of EBIT (only if EBIT is positive)
  row.actTax = ebitActual > 0 ? Math.round(ebitActual * TAX_RATE) : 0
  row.fc1Tax = ebitFc1 > 0 ? Math.round(ebitFc1 * TAX_RATE) : 0
  row.fc2Tax = ebitFc2 > 0 ? Math.round(ebitFc2 * TAX_RATE) : 0
  
  count++
})

console.log(`Updated tax values for ${count} revenue rows`)

// Write back to workbook
const revenueSheet = XLSX.utils.json_to_sheet(revenueRows)
workbook.Sheets['Revenue'] = revenueSheet

XLSX.writeFile(workbook, workbookPath)
console.log(`Workbook updated: ${workbookPath}`)
