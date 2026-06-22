// Apply per-(customer, dept, month, year) variation factors to the workbook
// so the charts have visible swings, rank shuffles, cost spikes, and the
// occasional negative-margin period. Reads & rewrites data/real-data-workbook.xlsx.
import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const repoRoot   = path.resolve(__dirname, '..')
const workbookPath = path.join(repoRoot, 'data', 'real-data-workbook.xlsx')

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0)
}
const r01 = (k) => (hash(k) % 100000) / 100000   // deterministic 0..1

// Customer-specific drift: each customer has a "good" half-year and a "rough" half-year
const CUSTOMER_PHASE = {
  'DIAL (Delhi Airport)':      0,            // peaks Q1
  'GHIAL (Hyderabad Airport)': Math.PI * 0.5, // peaks Q2
  'GMR Goa Airport':           Math.PI,       // peaks Q3
  'GMR Energy':                Math.PI * 1.5, // peaks Q4
  'GMR Highways':              Math.PI * 0.25,
}

// Pre-scheduled spikes / dips to make rank charts visibly shuffle
const COST_SPIKES = [
  { year: 2024, month: 'Sep', customer: 'GMR Energy',                 dept: 'IT & Digital Services',       factor: 2.8 },
  { year: 2025, month: 'Mar', customer: 'DIAL (Delhi Airport)',       dept: 'Facility & Admin Management', factor: 2.4 },
  { year: 2025, month: 'Jul', customer: 'GHIAL (Hyderabad Airport)',  dept: 'Procurement & Contracts',     factor: 2.2 },
  { year: 2025, month: 'Nov', customer: 'GMR Highways',               dept: 'IT & Digital Services',       factor: 2.6 },
  { year: 2026, month: 'Feb', customer: 'GMR Goa Airport',            dept: 'Finance & Accounts (F&A)',    factor: 2.0 },
  { year: 2026, month: 'May', customer: 'GMR Energy',                 dept: 'Human Resources',             factor: 2.3 },
]
const REVENUE_DIPS = [
  { year: 2025, month: 'May', customer: 'GMR Energy',                 factor: 0.35 },
  { year: 2025, month: 'Aug', customer: 'GMR Highways',               factor: 0.45 },
  { year: 2026, month: 'Mar', customer: 'DIAL (Delhi Airport)',       factor: 0.55 },
  { year: 2026, month: 'Jun', customer: 'GHIAL (Hyderabad Airport)',  factor: 0.5  },
]
const REVENUE_BOOSTS = [
  { year: 2024, month: 'Jun', customer: 'DIAL (Delhi Airport)',       factor: 1.8 },
  { year: 2025, month: 'Feb', customer: 'GHIAL (Hyderabad Airport)',  factor: 1.9 },
  { year: 2025, month: 'Sep', customer: 'GMR Goa Airport',            factor: 1.7 },
  { year: 2026, month: 'Apr', customer: 'GMR Energy',                 factor: 1.8 },
  { year: 2026, month: 'Jun', customer: 'GMR Highways',               factor: 1.6 },
]

function customerSeasonal(customer, month, year) {
  const mIdx = MONTHS.indexOf(month)
  const phase = CUSTOMER_PHASE[customer] ?? 0
  // amplitude ±55% around 1.0, with a secondary harmonic so years aren't identical
  const yearShift = ((year - 2024) * Math.PI) / 3
  const primary   = 0.55 * Math.sin((mIdx / 12) * 2 * Math.PI + phase + yearShift)
  const secondary = 0.18 * Math.sin((mIdx / 12) * 4 * Math.PI + phase * 1.7)
  return 1 + primary + secondary
}

function variationFactor({ row, kind }) {
  const key = `${kind}|${row.customer}|${row.department || ''}|${row.year}|${row.month}`
  const noise = 0.55 + r01(key) * 0.95           // 0.55..1.50  (much wider)
  const seasonal = customerSeasonal(row.customer, row.month, row.year)

  // Revenue runs ~1.4× by default so margin is positive on average; cost stays neutral.
  let base = kind === 'rev' ? 1.4 : 1.0

  // Apply pre-scheduled spikes/dips/boosts
  let scenario = 1
  if (kind === 'cost') {
    const spike = COST_SPIKES.find(
      (s) => s.year === row.year && s.month === row.month && s.customer === row.customer &&
      (!s.dept || row.department === s.dept)
    )
    if (spike) scenario = spike.factor
  }
  if (kind === 'rev') {
    const dip = REVENUE_DIPS.find(
      (s) => s.year === row.year && s.month === row.month && s.customer === row.customer
    )
    const boost = REVENUE_BOOSTS.find(
      (s) => s.year === row.year && s.month === row.month && s.customer === row.customer
    )
    if (dip)   scenario *= dip.factor
    if (boost) scenario *= boost.factor
  }
  return Math.max(0.2, base * seasonal * noise * scenario)
}

function applyToRow(row, fields, kind) {
  const f = variationFactor({ row, kind })
  const out = { ...row }
  for (const k of fields) {
    if (typeof row[k] === 'number') out[k] = Math.round(row[k] * f)
  }
  return out
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found at ${workbookPath}`)
}
const wb = XLSX.readFile(workbookPath)

const revRows  = XLSX.utils.sheet_to_json(wb.Sheets.Revenue,      { defval: '' })
const costRows = XLSX.utils.sheet_to_json(wb.Sheets.Cost,         { defval: '' })
const txnRows  = XLSX.utils.sheet_to_json(wb.Sheets.Transactions, { defval: '' })
const fteRows  = XLSX.utils.sheet_to_json(wb.Sheets.FTE,          { defval: '' })

const revNumeric  = ['fc1ServiceFees', 'fc2ServiceFees', 'actServiceFees',
                     'fc1OtherIncome', 'fc2OtherIncome', 'actOtherIncome',
                     'fc1ManagementFee', 'fc2ManagementFee', 'actManagementFee',
                     'totalFC1Recharge', 'totalFC2Recharge', 'totalActRecharge',
                     'actualCost', 'deficit']
const costNumeric = ['fc1', 'fc2', 'actual']
const txnNumeric  = ['txnCount', 'revenue']
const fteNumeric  = ['fteCount', 'revenue']

const newRev  = revRows.map((r) => applyToRow(r, revNumeric, 'rev'))
const newCost = costRows.map((r) => applyToRow(r, costNumeric, 'cost'))
const newTxn  = txnRows.map((r) => applyToRow({ ...r, department: r.dept }, txnNumeric, 'rev'))
const newFte  = fteRows.map((r) => applyToRow({ ...r, department: r.dept }, fteNumeric, 'rev'))

// Strip the helper `department` key we injected for txn/fte (they use `dept`)
for (const r of newTxn) if ('department' in r) delete r.department
for (const r of newFte) if ('department' in r) delete r.department

const out = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(newRev),  'Revenue')
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(newCost), 'Cost')
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(newTxn),  'Transactions')
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(newFte),  'FTE')

const readMe = [
  { item: 'Source',      value: 'Generated by scripts/redesign-data.mjs + scripts/vary-data.mjs' },
  { item: 'GeneratedAt', value: new Date().toISOString() },
  { item: 'Variation',   value: 'Per-(customer, dept, month, year) seasonal × noise × scheduled spikes/dips' },
]
XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(readMe), 'ReadMe')

XLSX.writeFile(out, workbookPath)
console.log('Updated', workbookPath, 'with varied data.')
console.log('Revenue rows:', newRev.length, ' Cost rows:', newCost.length)
