import { useEffect } from 'react'
import { useDashStore } from './store/useDashStore'
import TopBar from './components/TopBar'
import HeroSummary from './components/HeroSummary'
import KPISection from './components/KPISection'
import EBITMatrix from './components/EBITMatrix'
import ServiceRevenuePanel from './components/ServiceRevenuePanel'
import PLStatement from './components/PLStatement'
import MonthlyPerformance from './components/MonthlyPerformance'
import CostStructure from './components/CostStructure'
import DeptEBITPanel from './components/DeptEBITPanel'
import DriverWaterfall from './components/DriverWaterfall'
import InsightsPanel from './components/InsightsPanel'

export default function App() {
  const initInsights = useDashStore((s) => s.initInsights)

  useEffect(() => { initInsights() }, [initInsights])

  return (
    <div className="max-w-[1440px] mx-auto px-9 pt-7 pb-20">
      <TopBar />
      <HeroSummary />
      <KPISection />

      {/* EBIT matrices: Department then Customer */}
      <EBITMatrix type="department" num="01" />
      <EBITMatrix type="customer" num="01" />

      {/* Service Revenue: FTE vs Transaction breakdown */}
      <ServiceRevenuePanel />

      {/* P&L Statement: full actuals vs FC1/FC2 with dept breakdown */}
      <PLStatement />

      {/* Monthly Performance */}
      <MonthlyPerformance />

      {/* Cost structure + dept EBIT side-by-side */}
      <div className="mt-7 grid lg:grid-cols-[1.5fr_1fr] grid-cols-1 gap-5">
        <CostStructure />
        <DeptEBITPanel />
      </div>

      {/* CHANGE 1: Driver-based cost waterfall (FC1/FC2 vs Actual) */}
      <DriverWaterfall />

      {/* AI insights */}
      <InsightsPanel />

      <footer className="mt-8 pt-5 border-t border-[var(--line)] flex justify-between items-center text-[11.5px] text-[var(--muted)]">
        <span className="font-mono">GMR SSC · Financial Decision Intelligence · v0.1</span>
        <span className="font-mono">Re-upload Excel anytime to refresh</span>
      </footer>
    </div>
  )
}
