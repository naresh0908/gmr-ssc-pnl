import { create } from 'zustand'
import { sampleData } from '../data/sampleData'
import { transactionFteData } from '../data/transactionFteData'
import { computeDerived } from '../utils/computeDerived'
import { computeServiceRevenue } from '../utils/computeServiceRevenue'
import { generateInsights } from '../utils/generateInsights'
import { getLastActualMonth, monthToQuarter } from '../utils/periodUtils'

const rawRevenue = sampleData.revenue
const rawCost = sampleData.cost
const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, rawRevenue)
const initialDerived = computeDerived(rawRevenue, rawCost)
const defaultYear = initialDerived.years.at(-1) ?? new Date().getFullYear() - 1
const defaultPeriodMonth = getLastActualMonth(rawRevenue, defaultYear)
const defaultSelectedQ   = monthToQuarter(defaultPeriodMonth)

export const useDashStore = create((set, get) => ({
  rawRevenue: rawRevenue,
  rawCost: rawCost,
  derived: initialDerived,
  serviceRevenue,
  insights: [],

  year: defaultYear,
  department: 'All',
  theme: 'light',

  // Global period selector - drives every chart from HeroSummary to CostAnalysis
  periodMode: 'year',            // 'year' | 'quarter' | 'month'
  selectedQ: defaultSelectedQ,   // 'Q1' | 'Q2' | 'Q3' | 'Q4'
  selectedPeriodMonth: defaultPeriodMonth,

  setPeriodMode:         (mode) => set({ periodMode: mode }),
  setPeriodMode:         (mode) => {
    set({ periodMode: mode })
    const insights = generateInsights(get().derived, get().year, { periodMode: mode, selectedQ: get().selectedQ, selectedPeriodMonth: get().selectedPeriodMonth })
    set({ insights })
  },
  setSelectedQ:          (q)    => {
    set({ selectedQ: q, periodMode: 'quarter' })
    const insights = generateInsights(get().derived, get().year, { periodMode: 'quarter', selectedQ: q, selectedPeriodMonth: get().selectedPeriodMonth })
    set({ insights })
  },
  setSelectedPeriodMonth:(m)    => {
    set({ selectedPeriodMonth: m, periodMode: 'month' })
    const insights = generateInsights(get().derived, get().year, { periodMode: 'month', selectedQ: get().selectedQ, selectedPeriodMonth: m })
    set({ insights })
  },

  setData: (revenue, cost) => {
    const derived = computeDerived(revenue, cost)
    const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, revenue)
    const year = derived.years.at(-1) ?? get().year
    const insights = generateInsights(derived, year, { periodMode: get().periodMode, selectedQ: get().selectedQ, selectedPeriodMonth: get().selectedPeriodMonth })
    set({ rawRevenue: revenue, rawCost: cost, derived, serviceRevenue, year, insights })
  },

  setYear: (y) => {
    const insights = generateInsights(get().derived, y, { periodMode: get().periodMode, selectedQ: get().selectedQ, selectedPeriodMonth: get().selectedPeriodMonth })
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
    const insights = generateInsights(get().derived, get().year, { periodMode: get().periodMode, selectedQ: get().selectedQ, selectedPeriodMonth: get().selectedPeriodMonth })
    set({ insights })
  }
}))
