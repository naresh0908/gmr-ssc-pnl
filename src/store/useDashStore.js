import { create } from 'zustand'
import { sampleData } from '../data/sampleData'
import { computeDerived } from '../utils/computeDerived'
import { generateInsights } from '../utils/generateInsights'

export const useDashStore = create((set, get) => ({
  rawRevenue: sampleData.revenue,
  rawCost: sampleData.cost,
  derived: computeDerived(sampleData.revenue, sampleData.cost),
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
