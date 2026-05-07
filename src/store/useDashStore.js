import { create } from 'zustand'
import { sampleData } from '../data/sampleData'
import { generate2026 } from '../data/generate2026'
import { transactionFteData } from '../data/transactionFteData'
import { computeDerived } from '../utils/computeDerived'
import { computeServiceRevenue } from '../utils/computeServiceRevenue'
import { generateInsights } from '../utils/generateInsights'
import { getLastActualMonth, monthToQuarter } from '../utils/periodUtils'

// Patch sample data to embed realistic, narrative-driven variance into FY 2025.
// Each month has a dominant business event; per-department multipliers concentrate
// the impact on the actually-affected service lines (so the EBIT Matrix and
// Department views surface the right culprit instead of blanket variance).
//
// FY 2025 storyline:
//   Mar — Bangalore Aviation Group deferred Q1 PO batch (P&C scope) +
//         one-time SAP R/3 refresh blew up Consulting OPEX
//   Jun — Hyderabad campus facility expansion front-loaded — FMS / Facilities OPEX
//   Aug — Client-wide discretionary spend pause hit transactional services (HR, FMS)
//   Nov — Year-end PEX accruals + 12 hires onboarded for Dec peak (HR, IT)
//
// FY 2024 baseline lift: small uniform pullback so 2024 reads as a healthy year
// (a positive net result anchor) — makes the 2025 deterioration visible.
function patchSampleData(revenue, cost) {
  // Per-department revenue multipliers (`*` = all departments)
  const revPatches = {
    Mar: {
      'Procurement & Contracts':       0.55,  // Bangalore Aviation PO deferred
      'Facility Management Services':  0.78,
      'Human Resources':               0.82,
      'Finance & Accounts (F&A)':      0.92,
      'IT Management':                 0.90,
    },
    Aug: {
      'Human Resources':               0.68,  // Client pause hits payroll/onboarding
      'Facility Management Services':  0.72,
      '*': 0.93,                              // Mild dip elsewhere
    },
  }

  // Per-cost-type / sub-category multipliers (`type:sub` keys, fallback `*`)
  const costPatches = {
    Mar: {
      'OPEX:Consulting':   2.20,  // SAP refresh advisory
      'OPEX:IT':           1.65,
      'PEX:Salaries':      1.05,
      '*': 1.05,
    },
    Jun: {
      'OPEX:Facility':     2.80,  // Hyderabad campus expansion
      'CAPEX:Equipment':   2.40,
      'OPEX:IT':           1.40,
      '*': 1.10,
    },
    Nov: {
      'PEX:Salaries':      1.55,  // Year-end accruals
      'PEX:Recruitment':   2.40,  // 12-hire intake
      'PEX:Training':      1.85,
      '*': 1.10,
    },
  }

  // FY 2024 baseline lift: small uniform actuals boost + tax credit so 2024
  // shows a clear positive net result — frames it as "the healthy year".
  const rev = revenue.map((r) => {
    if (r.year === 2024) {
      return {
        ...r,
        actServiceFees: Math.round(r.actServiceFees * 1.04),
        actOtherIncome: Math.round(r.actOtherIncome * 1.04),
        actTax:         Math.round(r.actTax         * 0.88),  // FY24 tax credits
      }
    }
    if (r.year !== 2025) return r
    const monthMap = revPatches[r.month]
    if (!monthMap) return r
    const m = monthMap[r.department] ?? monthMap['*'] ?? 1
    if (m === 1) return r
    return {
      ...r,
      actServiceFees: Math.round(r.actServiceFees * m),
      actOtherIncome: Math.round(r.actOtherIncome * m),
      actInterest:    Math.round(r.actInterest    * m),
    }
  })

  const cst = cost.map((c) => {
    if (c.year !== 2025) return c
    const monthMap = costPatches[c.month]
    if (!monthMap) return c
    const key = `${c.costType}:${c.subCategory}`
    const m = monthMap[key] ?? monthMap['*'] ?? 1
    if (m === 1) return c
    return { ...c, actual: Math.round(c.actual * m) }
  })

  return { revenue: rev, cost: cst }
}

const { revenue: patched2025Rev, cost: patched2025Cost } = patchSampleData(sampleData.revenue, sampleData.cost)
const data2026 = generate2026({ revenue: sampleData.revenue, cost: sampleData.cost })
const patchedRevenue = [...patched2025Rev, ...data2026.revenue]
const patchedCost    = [...patched2025Cost, ...data2026.cost]
const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, patchedRevenue)
const initialDerived = computeDerived(patchedRevenue, patchedCost)
const defaultYear = initialDerived.years.at(-1) ?? new Date().getFullYear() - 1
const defaultPeriodMonth = getLastActualMonth(patchedRevenue, defaultYear)
const defaultSelectedQ   = monthToQuarter(defaultPeriodMonth)

export const useDashStore = create((set, get) => ({
  rawRevenue: patchedRevenue,
  rawCost: patchedCost,
  derived: initialDerived,
  serviceRevenue,
  insights: [],

  year: defaultYear,
  department: 'All',
  theme: 'light',

  // Global period selector — drives every chart from HeroSummary to CostAnalysis
  periodMode: 'year',            // 'year' | 'quarter' | 'month'
  selectedQ: defaultSelectedQ,   // 'Q1' | 'Q2' | 'Q3' | 'Q4'
  selectedPeriodMonth: defaultPeriodMonth,

  setPeriodMode:         (mode) => set({ periodMode: mode }),
  setSelectedQ:          (q)    => set({ selectedQ: q, periodMode: 'quarter' }),
  setSelectedPeriodMonth:(m)    => set({ selectedPeriodMonth: m, periodMode: 'month' }),

  setData: (revenue, cost) => {
    const derived = computeDerived(revenue, cost)
    const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, revenue)
    const year = derived.years.at(-1) ?? get().year
    const insights = generateInsights(derived, year)
    set({ rawRevenue: revenue, rawCost: cost, derived, serviceRevenue, year, insights })
  },

  setYear: (y) => {
    const insights = generateInsights(get().derived, y)
    const newPeriodMonth = getLastActualMonth(get().rawRevenue, y)
    set({ year: y, insights, selectedPeriodMonth: newPeriodMonth, selectedQ: monthToQuarter(newPeriodMonth) })
  },
  setDepartment: (d) => set({ department: d }),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    set({ theme: next })
  },

  // Init insights on first load
  initInsights: () => {
    const insights = generateInsights(get().derived, get().year)
    set({ insights })
  }
}))
