/**
 * Generate FY 2026 revenue and cost data.
 *
 * Strategy:
 *   FC1  = optimistic plan   → 2025 FC2 × 1.09
 *   FC2  = revised forecast  → 2025 FC2 × 1.08
 *   Actuals Jan–Apr          → FC2 × per-month/dept multiplier (causal patterns below)
 *   Actuals May–Dec          → 0  (future months, forecast only)
 *
 * Causal patterns baked into actuals:
 *  Jan: +4% all depts - HR onboarded TechFab Industries (new payroll + onboarding scope)
 *  Feb: P&C −9% - Arora Engineering delayed bulk PO batch due to SAP R/3→S4 migration;
 *       OPEX Consulting +42% all depts - advisory fees for same migration project
 *  Mar: IT +4% - new airport helpdesk SLA started; OPEX IT +52%, Consulting +48% -
 *       technology migration go-live; one-time SAP implementation cost
 *  Apr: F&A +8%, IT +6% - new service contracts signed; HR −2% - MNR Aviation paused FTE scope;
 *       PEX Salaries +12%, Recruitment +35% - 8 new hires onboarded for contract expansion
 */

const ACTUALS_MONTHS = new Set(['Jan', 'Feb', 'Mar', 'Apr'])

// Revenue actual multiplier vs FC2 - { month: { dept?: mult, default: mult } }
const REV_ACT = {
  Jan: { default: 1.04 },
  Feb: { default: 1.01, 'Procurement & Contracts': 0.91 },
  Mar: { default: 1.01, 'IT Management': 1.045 },
  Apr: {
    default: 1.02,
    'Finance & Accounts (F&A)': 1.08,
    'IT Management': 1.06,
    'Human Resources': 0.98,
  },
}

// Cost actual multiplier vs FC2 - { month: { 'TYPE:SUB'?: mult, default: mult } }
const COST_ACT = {
  Jan: { default: 0.975 },
  Feb: {
    'OPEX:Consulting': 1.42,
    'OPEX:IT': 1.25,
    default: 1.005,
  },
  Mar: {
    'OPEX:IT': 1.52,
    'OPEX:Consulting': 1.48,
    'OPEX:Facility': 1.15,
    default: 1.01,
  },
  Apr: {
    'PEX:Salaries': 1.12,
    'PEX:Recruitment': 1.35,
    'PEX:Training': 1.28,
    default: 1.015,
  },
}

export function generate2026({ revenue: rev2025, cost: cost2025 }) {
  const revenue = []
  const cost = []

  // ── Revenue rows ──────────────────────────────────────────────────────────
  for (const r of rev2025) {
    if (r.year !== 2025) continue

    const fc2SF   = Math.round(r.fc2ServiceFees  * 1.08)
    const fc1SF   = Math.round(r.fc2ServiceFees  * 1.09)
    const fc2OI   = Math.round(r.fc2OtherIncome  * 1.08)
    const fc1OI   = Math.round(r.fc2OtherIncome  * 1.09)
    const fc2Int  = Math.round(r.fc2Interest     * 1.06)
    const fc1Int  = Math.round(r.fc2Interest     * 1.07)
    const fc2Tax  = Math.round(r.fc2Tax          * 1.08)
    const fc1Tax  = Math.round(r.fc2Tax          * 1.09)

    let actSF = 0, actOI = 0, actInt = 0, actTax = 0

    if (ACTUALS_MONTHS.has(r.month)) {
      const pat = REV_ACT[r.month]
      const mult = pat[r.department] ?? pat.default
      actSF  = Math.round(fc2SF  * mult)
      actOI  = Math.round(fc2OI  * mult)
      actInt = Math.round(fc2Int * 1.02)
      actTax = Math.round(fc2Tax * mult * 0.96)
    }

    revenue.push({
      year: 2026,
      month: r.month,
      department: r.department,
      fc1ServiceFees: fc1SF,
      fc2ServiceFees: fc2SF,
      actServiceFees: actSF,
      fc1OtherIncome: fc1OI,
      fc2OtherIncome: fc2OI,
      actOtherIncome: actOI,
      fc1Interest: fc1Int,
      fc2Interest: fc2Int,
      actInterest: actInt,
      fc1Tax: fc1Tax,
      fc2Tax: fc2Tax,
      actTax: actTax,
      comments: '',
    })
  }

  // ── Cost rows ─────────────────────────────────────────────────────────────
  for (const c of cost2025) {
    if (c.year !== 2025) continue

    const fc2 = Math.round(c.fc2 * 1.06)
    const fc1 = Math.round(c.fc2 * 1.07)

    let actual = 0

    if (ACTUALS_MONTHS.has(c.month)) {
      const pat  = COST_ACT[c.month]
      const key  = `${c.costType}:${c.subCategory}`
      const mult = pat[key] ?? pat.default
      actual = Math.round(fc2 * mult)
    }

    cost.push({
      year: 2026,
      month: c.month,
      department: c.department,
      costType: c.costType,
      subCategory: c.subCategory,
      fc1,
      fc2,
      actual,
      comments: '',
    })
  }

  return { revenue, cost }
}
