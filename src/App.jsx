import { useEffect } from 'react'
import { useDashStore } from './store/useDashStore'
import TopBar from './components/TopBar'
import HeroSummary from './components/HeroSummary'
import KPISection from './components/KPISection'
import EBITMatrix from './components/EBITMatrix'
import MonthlyPerformance from './components/MonthlyPerformance'
import CostStructure from './components/CostStructure'
import DeptEBITPanel from './components/DeptEBITPanel'
import DeptWaterfall from './components/DeptWaterfall'
import InsightsPanel from './components/InsightsPanel'

export default function App() {
  const initInsights = useDashStore((s) => s.initInsights)

  useEffect(() => { initInsights() }, [initInsights])

  return (
    <div className="max-w-[1440px] mx-auto px-9 pt-7 pb-20">
      <TopBar />
      <HeroSummary />
      <KPISection />

      {/* CHANGE 2: EBIT (Month × Department) placed above Monthly Performance */}
      <EBITMatrix />

      {/* Monthly Performance — with Net Profit Ratio legend (CHANGE 3) */}
      <MonthlyPerformance />

      {/* Cost structure + dept EBIT side-by-side */}
      <div className="mt-7 grid lg:grid-cols-[1.5fr_1fr] grid-cols-1 gap-5">
        <CostStructure />
        <DeptEBITPanel />
      </div>

      {/* CHANGE 1: Department-wise cost waterfall */}
      <DeptWaterfall />

      {/* AI insights */}
      <InsightsPanel />

      <footer className="mt-8 pt-5 border-t border-[var(--line)] flex justify-between items-center text-[11.5px] text-[var(--muted)]">
        <span className="font-mono">GMR SSC · Financial Decision Intelligence · v0.1</span>
        <span className="font-mono">Re-upload Excel anytime to refresh</span>
      </footer>
    </div>
  )
}
