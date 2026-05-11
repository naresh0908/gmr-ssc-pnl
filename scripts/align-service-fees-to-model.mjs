import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'

const repoRoot = process.cwd()
const workbookPath = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')

function readRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Missing sheet "${sheetName}"`)
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function toKey(row) {
  return `${row.year}|${row.month}|${row.department ?? row.dept}`
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found at ${workbookPath}`)
}

console.log('Reading workbook...')
const workbook = XLSX.readFile(workbookPath)
const revenueRows = readRows(workbook, 'Revenue')
const transactionRows = readRows(workbook, 'Transactions')
const fteRows = readRows(workbook, 'FTE')

const modelTotals = new Map()

for (const row of transactionRows) {
  const key = toKey(row)
  const current = modelTotals.get(key) ?? { txn: 0, fte: 0 }
  current.txn += (Number(row.txnCount) || 0) * (Number(row.ratePerTxn) || 0)
  modelTotals.set(key, current)
}

for (const row of fteRows) {
  const key = toKey(row)
  const current = modelTotals.get(key) ?? { txn: 0, fte: 0 }
  current.fte += (Number(row.fteCount) || 0) * (Number(row.ratePerFte) || 0)
  modelTotals.set(key, current)
}

let updatedRows = 0
let mismatches = 0

for (const row of revenueRows) {
  const key = toKey(row)
  const totals = modelTotals.get(key)
  if (!totals) {
    continue
  }

  const modelTotal = Math.round(totals.txn + totals.fte)
  const currentActual = Math.round(Number(row.actServiceFees) || 0)
  if (currentActual !== modelTotal) {
    mismatches++
  }

  row.actServiceFees = modelTotal
  updatedRows++
}

workbook.Sheets['Revenue'] = XLSX.utils.json_to_sheet(revenueRows)
XLSX.writeFile(workbook, workbookPath)

console.log(`Aligned service fees for ${updatedRows} revenue rows`)
console.log(`Rows that changed: ${mismatches}`)
console.log(`Workbook updated: ${workbookPath}`)