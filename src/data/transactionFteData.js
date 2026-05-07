// Generated sample data: GMR SSC transaction-based and FTE-based revenue
// Amounts in INR (not crores). Revenue = txnCount × ratePerTxn or fteCount × ratePerFte

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Seasonal multipliers (Q1 strong close, summer dip, year-end surge)
const SEA = [1.05, 0.93, 0.89, 0.97, 1.01, 0.90, 0.86, 0.84, 0.96, 1.03, 1.08, 1.12]

// Deterministic pseudo-random: fractional part of large sin product
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
function varyTxn(base, seed) {
  return Math.max(1, Math.round(base * (0.87 + hash(seed) * 0.26))) // ±13% volume variation
}
function varyFte(base, seed) {
  return Math.max(1, Math.round(base * (0.94 + hash(seed) * 0.12))) // ±6% FTE variation
}

const DEPT_CFG = {
  'Finance & Accounts (F&A)': {
    txn: [
      { name: 'Invoice Processing',    count: 3000, rate: 2800 },
      { name: 'Payment Processing',    count: 2000, rate: 1950 },
      { name: 'Expense Claims',        count:  950, rate: 1400 },
      { name: 'Bank Reconciliation',   count:  480, rate: 5200 },
    ],
    fte: [
      { name: 'Finance Operations',       count: 12, rate: 1250000 },
      { name: 'Accounting & Reporting',   count:  8, rate: 1100000 },
    ],
  },
  'Procurement & Contracts': {
    txn: [
      { name: 'PO Processing',         count: 2000, rate:  3800 },
      { name: 'Contract Management',   count:  150, rate: 15000 },
      { name: 'Vendor Onboarding',     count:   75, rate: 20000 },
      { name: 'RFQ Processing',        count:  350, rate:  4800 },
    ],
    fte: [
      { name: 'Procurement Operations',  count: 12, rate: 1300000 },
      { name: 'Contract Specialists',    count:  6, rate: 1500000 },
    ],
  },
  'Facility Management Services': {
    txn: [
      { name: 'Maintenance Requests',  count: 2500, rate: 1950 },
      { name: 'Asset Management',      count: 1000, rate: 1450 },
      { name: 'Space Bookings',        count: 1800, rate:  950 },
    ],
    fte: [
      { name: 'FM Operations',         count: 18, rate:  950000 },
      { name: 'Facility Support',      count:  6, rate:  850000 },
    ],
  },
  'Human Resources': {
    txn: [
      { name: 'Payroll Processing',    count: 2500, rate: 2850 },
      { name: 'Recruitment Processing',count:  120, rate: 9800 },
      { name: 'Employee Onboarding',   count:   90, rate: 7500 },
      { name: 'Separation Processing', count:   50, rate: 5800 },
    ],
    fte: [
      { name: 'HR Business Partners',  count: 10, rate: 1100000 },
      { name: 'HR Operations',         count:  8, rate: 1000000 },
    ],
  },
  'IT Management': {
    txn: [
      { name: 'IT Helpdesk',           count: 3000, rate: 1450 },
      { name: 'Access Provisioning',   count:  600, rate: 2950 },
      { name: 'Software Deployment',   count:  200, rate: 4900 },
    ],
    fte: [
      { name: 'IT Support',            count: 10, rate: 1400000 },
      { name: 'Infrastructure',        count:  5, rate: 1600000 },
    ],
  },
}

const GROWTH = { 2024: 1.0, 2025: 1.07, 2026: 1.15 } // 7% then 8% YoY growth

// 2026: only Jan-Apr have actuals; May-Dec are forecast-only (still generate for service revenue panel)
function generateData() {
  const transactions = []
  const fte = []

  ;[2024, 2025, 2026].forEach((year) => {
    const gf = GROWTH[year]
    MONTHS.forEach((month, mi) => {
      const sea = SEA[mi]
      let idx = 0
      Object.entries(DEPT_CFG).forEach(([dept, cfg]) => {
        cfg.txn.forEach((svc) => {
          const seed = year * 10000 + mi * 100 + idx++
          transactions.push({
            year, month, dept,
            serviceName: svc.name,
            txnCount: varyTxn(Math.round(svc.count * sea * gf), seed),
            ratePerTxn: svc.rate,
          })
        })
        cfg.fte.forEach((fn) => {
          const seed = year * 10000 + mi * 100 + idx++
          fte.push({
            year, month, dept,
            functionName: fn.name,
            fteCount: varyFte(Math.round(fn.count * gf), seed),
            ratePerFte: fn.rate,
          })
        })
      })
    })
  })

  return { transactions, fte }
}

export const transactionFteData = generateData()
