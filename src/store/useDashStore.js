import { create } from 'zustand'
import { sampleData } from '../data/sampleData'
import { transactionFteData } from '../data/transactionFteData'
import { computeDerived } from '../utils/computeDerived'
import { computeServiceRevenue } from '../utils/computeServiceRevenue'
import { generateInsights } from '../utils/generateInsights'
import { getAvailMonths, getLastActualMonth } from '../utils/periodUtils'

const ALL = 'All'

function filterRaw(rev, cost, customer, projectStatus) {
  const matches = (row) => {
    if (customer && customer !== ALL && row.customer !== customer) return false
    if (projectStatus && projectStatus !== ALL && row.projectStatus !== projectStatus) return false
    return true
  }
  return {
    revenue: rev.filter(matches),
    cost:    cost.filter(matches),
  }
}

const rawRevenueAll = sampleData.revenue
const rawCostAll    = sampleData.cost
const initialFiltered = filterRaw(rawRevenueAll, rawCostAll, ALL, ALL)
const serviceRevenue  = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, initialFiltered.revenue)
const initialDerived  = computeDerived(initialFiltered.revenue, initialFiltered.cost)
const defaultYear     = initialDerived.years.at(-1) ?? new Date().getFullYear() - 1
const defaultTo       = getLastActualMonth(initialFiltered.revenue, defaultYear)
const defaultFrom     = 'Jan'

const customers      = [...new Set(rawRevenueAll.map((r) => r.customer).filter(Boolean))]
const projectStatuses = [...new Set(rawRevenueAll.map((r) => r.projectStatus).filter(Boolean))]

export const useDashStore = create((set, get) => ({
  rawRevenueAll, rawCostAll,
  rawRevenue: initialFiltered.revenue,
  rawCost:    initialFiltered.cost,
  derived:    initialDerived,
  serviceRevenue,
  insights: [],

  year: defaultYear,
  department: 'All',
  theme: 'light',

  // New: snapshot date range + customer + project-status filters
  fromMonth: defaultFrom,
  toMonth:   defaultTo,
  customer:        ALL,
  projectStatus:   ALL,

  customers,
  projectStatuses,

  setFromMonth: (m) => {
    set({ fromMonth: m })
    refreshInsights(get, set)
  },
  setToMonth: (m) => {
    set({ toMonth: m })
    refreshInsights(get, set)
  },
  setRange: (from, to) => {
    set({ fromMonth: from, toMonth: to })
    refreshInsights(get, set)
  },
  setCustomer: (c) => {
    applyFilters(get, set, { customer: c })
  },
  setProjectStatus: (s) => {
    applyFilters(get, set, { projectStatus: s })
  },

  setData: (revenue, cost, transactions, fte) => {
    const txns = transactions ?? transactionFteData.transactions
    const fteRows = fte ?? transactionFteData.fte
    const filtered = filterRaw(revenue, cost, get().customer, get().projectStatus)
    const derived = computeDerived(filtered.revenue, filtered.cost)
    const serviceRevenue = computeServiceRevenue(txns, fteRows, filtered.revenue)
    const year = derived.years.at(-1) ?? get().year
    const insights = generateInsights(derived, year, {
      fromMonth: get().fromMonth, toMonth: get().toMonth,
    })
    set({
      rawRevenueAll: revenue, rawCostAll: cost,
      rawRevenue: filtered.revenue, rawCost: filtered.cost,
      derived, serviceRevenue, year, insights,
      customers:        [...new Set(revenue.map((r) => r.customer).filter(Boolean))],
      projectStatuses:  [...new Set(revenue.map((r) => r.projectStatus).filter(Boolean))],
    })
  },

  setYear: (y) => {
    const newTo = getLastActualMonth(get().rawRevenue, y)
    set({ year: y, fromMonth: 'Jan', toMonth: newTo })
    refreshInsights(get, set)
  },
  setDepartment: (d) => set({ department: d }),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    set({ theme: next })
  },

  initInsights: () => refreshInsights(get, set),
}))

function refreshInsights(get, set) {
  const { derived, year, fromMonth, toMonth } = get()
  const insights = generateInsights(derived, year, { fromMonth, toMonth })
  set({ insights })
}

function applyFilters(get, set, patch) {
  const next = { customer: get().customer, projectStatus: get().projectStatus, ...patch }
  const filtered = filterRaw(get().rawRevenueAll, get().rawCostAll, next.customer, next.projectStatus)
  const derived = computeDerived(filtered.revenue, filtered.cost)
  const year = derived.years.includes(get().year) ? get().year : (derived.years.at(-1) ?? get().year)
  const availMonths = getAvailMonths(filtered.revenue, year)
  const toMonth = availMonths.includes(get().toMonth) ? get().toMonth : (availMonths.at(-1) ?? 'Dec')
  const fromMonth = availMonths.includes(get().fromMonth) ? get().fromMonth : (availMonths[0] ?? 'Jan')
  const serviceRevenue = computeServiceRevenue(transactionFteData.transactions, transactionFteData.fte, filtered.revenue)
  const insights = generateInsights(derived, year, { fromMonth, toMonth })
  set({
    customer: next.customer,
    projectStatus: next.projectStatus,
    rawRevenue: filtered.revenue,
    rawCost: filtered.cost,
    derived,
    serviceRevenue,
    year,
    fromMonth,
    toMonth,
    insights,
  })
}
