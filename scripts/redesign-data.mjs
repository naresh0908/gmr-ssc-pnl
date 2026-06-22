// One-time data update for the dashboard redesign.
// - Adds Customer + projectStatus columns to Revenue, Cost, Transactions, FTE.
// - Backfills May/Jun 2026 actuals by extrapolating Apr 2026 (small growth).
// - Writes the updated workbook to data/real-data-workbook.xlsx so Excel
//   remains the source of truth. Run sync-data-from-workbook.mjs afterwards
//   to regenerate the JS modules under src/data.
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const repoRoot   = path.resolve(__dirname, '..')

const sampleDataPath = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFtePath     = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')
const workbookOut    = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')

const CUSTOMERS = [
  { name: 'DIAL (Delhi Airport)',        share: 0.32 },
  { name: 'GHIAL (Hyderabad Airport)',   share: 0.24 },
  { name: 'GMR Goa Airport',             share: 0.14 },
  { name: 'GMR Energy',                  share: 0.18 },
  { name: 'GMR Highways',                share: 0.12 },
]

// Status of each customer's engagement per year.
const STATUS_MAP = {
  'DIAL (Delhi Airport)':        { 2024: 'Started',   2025: 'Released',  2026: 'Completed' },
  'GHIAL (Hyderabad Airport)':   { 2024: 'Released',  2025: 'Completed', 2026: 'Closed'    },
  'GMR Goa Airport':             { 2024: 'Started',   2025: 'Released',  2026: 'Released'  },
  'GMR Energy':                  { 2024: 'Released',  2025: 'Completed', 2026: 'Released'  },
  'GMR Highways':                { 2024: 'Started',   2025: 'Started',   2026: 'Released'  },
}

const statusOf = (customer, year) => STATUS_MAP[customer]?.[year] ?? 'Released'

const round = (n) => Math.round(n)

// Load JS modules via a tiny eval (the modules export a `const` literal).
function loadModule(filePath, exportName) {
  const src = fs.readFileSync(filePath, 'utf8')
  const match = src.match(new RegExp(`export const ${exportName}\\s*=\\s*([\\s\\S]+?);\\s*$`))
  if (!match) throw new Error(`Failed to extract ${exportName} from ${filePath}`)
  return JSON.parse(match[1])
}

const sampleData       = loadModule(sampleDataPath, 'sampleData')
const transactionFte   = loadModule(txnFtePath,     'transactionFteData')

// ── 0. Aggregate-by-key so re-running this script is idempotent ─────────
// (existing rows may already be split per-customer; collapse them first)
function aggregateBy(rows, keyFields, numericFields, dropFields = []) {
  const map = new Map()
  for (const row of rows) {
    const k = keyFields.map((f) => row[f] ?? '').join('||')
    if (!map.has(k)) {
      const base = { ...row }
      for (const f of dropFields) delete base[f]
      // numeric fields start at 0; we re-add
      for (const f of numericFields) base[f] = 0
      map.set(k, base)
    }
    const target = map.get(k)
    for (const f of numericFields) {
      if (typeof row[f] === 'number') target[f] += row[f]
    }
  }
  return [...map.values()]
}

// recoveryRate is a ratio — recompute after aggregation
const revKeyFields  = ['year', 'month', 'department']
const costKeyFields = ['year', 'month', 'department', 'costType', 'subCategory']
const txnKeyFields  = ['year', 'month', 'dept', 'serviceName']
const fteKeyFields  = ['year', 'month', 'dept', 'functionName']

const revNumericKeys = [
  'fc1ServiceFees', 'fc2ServiceFees', 'actServiceFees',
  'fc1OtherIncome', 'fc2OtherIncome', 'actOtherIncome',
  'fc1ManagementFee', 'fc2ManagementFee', 'actManagementFee',
  'totalFC1Recharge', 'totalFC2Recharge', 'totalActRecharge',
  'actualCost', 'deficit',
]
const dropPerCustomerFields = ['customer', 'projectStatus']

sampleData.revenue       = aggregateBy(sampleData.revenue,       revKeyFields,  revNumericKeys, dropPerCustomerFields)
sampleData.cost          = aggregateBy(sampleData.cost,          costKeyFields, ['fc1', 'fc2', 'actual'], dropPerCustomerFields)
transactionFte.transactions = aggregateBy(transactionFte.transactions, txnKeyFields, ['txnCount', 'revenue'], dropPerCustomerFields)
transactionFte.fte          = aggregateBy(transactionFte.fte,          fteKeyFields, ['fteCount', 'revenue'], dropPerCustomerFields)
for (const r of sampleData.revenue) {
  if (r.totalActRecharge && r.actualCost) r.recoveryRate = r.totalActRecharge / r.actualCost
}

// ── 1. Split each Revenue/Cost row across CUSTOMERS by share ────────────
const numericRevFields = [
  'fc1ServiceFees', 'fc2ServiceFees', 'actServiceFees',
  'fc1OtherIncome', 'fc2OtherIncome', 'actOtherIncome',
  'fc1ManagementFee', 'fc2ManagementFee', 'actManagementFee',
  'totalFC1Recharge', 'totalFC2Recharge', 'totalActRecharge',
  'actualCost', 'deficit',
]

function splitRow(row, fields) {
  return CUSTOMERS.map((c, idx) => {
    const next = { ...row }
    for (const f of fields) {
      if (typeof row[f] === 'number') {
        // Last customer absorbs rounding remainder so totals still match.
        if (idx === CUSTOMERS.length - 1) {
          const used = CUSTOMERS.slice(0, -1).reduce((s, cc) => s + round(row[f] * cc.share), 0)
          next[f] = round(row[f]) - used
        } else {
          next[f] = round(row[f] * c.share)
        }
      }
    }
    next.customer = c.name
    next.projectStatus = statusOf(c.name, row.year)
    // recoveryRate is a ratio, copied through unchanged
    return next
  })
}

const revenueSplit = sampleData.revenue.flatMap((r) => splitRow(r, numericRevFields))
const costSplit    = sampleData.cost.flatMap((r) => splitRow(r, ['fc1', 'fc2', 'actual']))
const txnSplit     = transactionFte.transactions.flatMap((r) => splitRow(r, ['txnCount', 'revenue']))
const fteSplit     = transactionFte.fte.flatMap((r) => splitRow(r, ['fteCount', 'revenue']))

// ── 2. Backfill 2026 May & Jun actuals by extrapolating Apr 2026 ─────────
function backfillMonths(rows, baseMonth, newMonths, growthPerStep, numericFields) {
  const baseRows = rows.filter((r) => r.year === 2026 && r.month === baseMonth)
  if (baseRows.length === 0) return rows
  const additions = []
  newMonths.forEach((m, stepIdx) => {
    const step = stepIdx + 1
    const factor = Math.pow(1 + growthPerStep, step)
    for (const base of baseRows) {
      const exists = rows.some((r) =>
        r.year === 2026 && r.month === m &&
        r.department === base.department &&
        r.customer === base.customer &&
        (r.costType === undefined || r.costType === base.costType) &&
        (r.subCategory === undefined || r.subCategory === base.subCategory) &&
        (r.serviceName === undefined || r.serviceName === base.serviceName) &&
        (r.functionName === undefined || r.functionName === base.functionName)
      )
      if (exists) continue
      const next = { ...base, month: m }
      for (const f of numericFields) {
        if (typeof base[f] === 'number') next[f] = round(base[f] * factor)
      }
      additions.push(next)
    }
  })
  return rows.concat(additions)
}

const revenueFull = backfillMonths(revenueSplit, 'Apr', ['May', 'Jun'], 0.012, numericRevFields)
const costFull    = backfillMonths(costSplit,    'Apr', ['May', 'Jun'], 0.012, ['fc1', 'fc2', 'actual'])
const txnFull     = backfillMonths(txnSplit,     'Apr', ['May', 'Jun'], 0.012, ['txnCount', 'revenue'])
const fteFull     = backfillMonths(fteSplit,     'Apr', ['May', 'Jun'], 0.012, ['fteCount', 'revenue'])

// ── 3. Write the workbook ───────────────────────────────────────────────
const wb = XLSX.utils.book_new()
const readMe = [
  { item: 'Source',          value: 'Generated by scripts/redesign-data.mjs' },
  { item: 'GeneratedAt',     value: new Date().toISOString() },
  { item: 'CustomerColumn',  value: 'Yes — values split across customers by share' },
  { item: 'ProjectStatusCol', value: 'Yes — per customer × year' },
  { item: 'Coverage',        value: '2024 Jan – 2026 Jun (actuals)' },
  { item: 'Customers',       value: CUSTOMERS.map((c) => c.name).join('; ') },
]

XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revenueFull), 'Revenue')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costFull),    'Cost')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnFull),     'Transactions')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fteFull),     'FTE')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readMe),      'ReadMe')

XLSX.writeFile(wb, workbookOut)

console.log('Wrote', workbookOut)
console.log('Revenue rows:',     revenueFull.length)
console.log('Cost rows:',        costFull.length)
console.log('Transactions:',     txnFull.length)
console.log('FTE rows:',         fteFull.length)
