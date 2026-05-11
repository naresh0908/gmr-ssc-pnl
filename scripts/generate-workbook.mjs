import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { sampleData } from '../src/data/sampleData.js'
import { transactionFteData } from '../src/data/transactionFteData.js'

const repoRoot = process.cwd()
const outputPath = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')

function sheetFromArray(data) {
  return XLSX.utils.json_to_sheet(data)
}

function sortRows(rows, keys) {
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const left = a[key]
      const right = b[key]
      if (left < right) return -1
      if (left > right) return 1
    }
    return 0
  })
}

const workbook = XLSX.utils.book_new()

const revenueRows = sortRows(sampleData.revenue, ['year', 'month', 'department'])
const costRows = sortRows(sampleData.cost, ['year', 'month', 'department', 'costType', 'subCategory'])
const txnRows = sortRows(transactionFteData.transactions, ['year', 'month', 'dept', 'serviceName'])
const fteRows = sortRows(transactionFteData.fte, ['year', 'month', 'dept', 'functionName'])

XLSX.utils.book_append_sheet(workbook, sheetFromArray(revenueRows), 'Revenue')
XLSX.utils.book_append_sheet(workbook, sheetFromArray(costRows), 'Cost')
XLSX.utils.book_append_sheet(workbook, sheetFromArray(txnRows), 'Transactions')
XLSX.utils.book_append_sheet(workbook, sheetFromArray(fteRows), 'FTE')

const summary = [
  { item: 'Source', value: 'Current repo data snapshot' },
  { item: 'Revenue rows', value: revenueRows.length },
  { item: 'Cost rows', value: costRows.length },
  { item: 'Transaction rows', value: txnRows.length },
  { item: 'FTE rows', value: fteRows.length },
  { item: 'Note', value: 'Workbook mirrors the current static data files only. No upload/import flow is included.' },
]
XLSX.utils.book_append_sheet(workbook, sheetFromArray(summary), 'ReadMe')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
XLSX.writeFile(workbook, outputPath)

console.log(`Workbook written to ${outputPath}`)
console.log(`Revenue rows: ${revenueRows.length}`)
console.log(`Cost rows: ${costRows.length}`)
console.log(`Transaction rows: ${txnRows.length}`)
console.log(`FTE rows: ${fteRows.length}`)
