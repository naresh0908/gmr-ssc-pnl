import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'

const repoRoot = process.cwd()
const workbookPath = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')
const sampleDataOut = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFteOut = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')

function assertSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    const available = workbook.SheetNames.join(', ')
    throw new Error(`Missing sheet "${sheetName}" in ${workbookPath}. Available sheets: ${available}`)
  }
  return sheet
}

function readRows(workbook, sheetName) {
  const sheet = assertSheet(workbook, sheetName)
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function writeModule(filePath, exportName, data, sourceLabel) {
  const content = `// Auto-generated from ${sourceLabel}. Do not edit by hand.\nexport const ${exportName} = ${JSON.stringify(data, null, 2)};\n`
  fs.writeFileSync(filePath, content, 'utf8')
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found at ${workbookPath}`)
}

const workbook = XLSX.readFile(workbookPath)
const revenueRows = readRows(workbook, 'Revenue')
const costRows = readRows(workbook, 'Cost')
const transactions = readRows(workbook, 'Transactions')
const fte = readRows(workbook, 'FTE')

writeModule(sampleDataOut, 'sampleData', { revenue: revenueRows, cost: costRows }, 'data/real-data-workbook.xlsx')
writeModule(txnFteOut, 'transactionFteData', { transactions, fte }, 'data/real-data-workbook.xlsx')

console.log(`Synced JS data from ${workbookPath}`)
console.log(`Revenue rows: ${revenueRows.length}`)
console.log(`Cost rows: ${costRows.length}`)
console.log(`Transaction rows: ${transactions.length}`)
console.log(`FTE rows: ${fte.length}`)
