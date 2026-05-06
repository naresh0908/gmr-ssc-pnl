import { create } from 'zustand'
import { sampleData } from '../data/sampleData'
import { transactionFteData } from '../data/transactionFteData'
import { computeDerived } from '../utils/computeDerived'
import { computeServiceRevenue } from '../utils/computeServiceRevenue'
import { generateInsights } from '../utils/generateInsights'

const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte)

// Patch sample data to introduce realistic variance: negative YoY, loss months, mixed NP ratio
function patchSampleData(revenue, cost) {
  // Mar, Aug 2025: revenue dip below prior-year levels → negative YoY; Mar also dips into loss territory
  const revMultipliers = { Mar: 0.72, Aug: 0.81 }
  // Jun, Nov 2025: cost spike → negative net profit / ratio (even with decent revenue)
  const costMultipliers = { Mar: 1.45, Jun: 1.90, Nov: 1.65 }

  const rev = revenue.map((r) => {
    const m = revMultipliers[r.month]
    if (r.year === 2025 && m) {
      return { ...r, actServiceFees: r.actServiceFees * m, actOtherIncome: r.actOtherIncome * m, actInterest: r.actInterest * m }
    }
    return r
  })

  const cst = cost.map((c) => {
    const m = costMultipliers[c.month]
    if (c.year === 2025 && m) return { ...c, actual: c.actual * m }
    return c
  })

  return { revenue: rev, cost: cst }
}

const { revenue: patchedRevenue, cost: patchedCost } = patchSampleData(sampleData.revenue, sampleData.cost)

export const useDashStore = create((set, get) => ({
  rawRevenue: patchedRevenue,
  rawCost: patchedCost,
  derived: computeDerived(patchedRevenue, patchedCost),
  serviceRevenue,
  insights: [],

  year: 2025,
  department: 'All',
  theme: 'light',

  setData: (revenue, cost) => {
    const derived = computeDerived(revenue, cost)
    const insights = generateInsights(derived, get().year)
    set({ rawRevenue: revenue, rawCost: cost, derived, insights })
  },

  setYear: (y) => {
    const insights = generateInsights(get().derived, y)
    set({ year: y, insights })
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
