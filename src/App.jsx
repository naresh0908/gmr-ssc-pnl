import { useEffect } from 'react'
import { useDashStore } from './store/useDashStore'
import TopBar from './components/TopBar'
import PeriodBar from './components/PeriodBar'
import HeroSummary from './components/HeroSummary'
import KPISection from './components/KPISection'
import CostStructure from './components/CostStructure'
import EBITMatrix from './components/EBITMatrix'
import ServiceRevenuePanel from './components/ServiceRevenuePanel'
import PLStatement from './components/PLStatement'
import MonthlyPerformance from './components/MonthlyPerformance'
import DriverWaterfall from './components/DriverWaterfall'
import CostAnalysisPanel from './components/CostAnalysisPanel'

export default function App() {
  const { initInsights } = useDashStore()
  useEffect(() => { initInsights() }, [initInsights])

  return (
    <div>
      {/* Sticky header — full viewport width so background covers edge-to-edge */}
      <div className="sticky top-0 z-40 bg-[var(--bg)] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1440px] mx-auto px-9 pt-7 pb-3">
          <TopBar />
          <PeriodBar />
        </div>
      </div>

    <div className="max-w-[1440px] mx-auto px-9 pb-20">
      {/* Executive summary block: hero + KPI cards + cost structure overview */}
      <HeroSummary />
      <KPISection />
      <div className="mt-4">
        <CostStructure />
      </div>

      {/* 01 · P&L Statement */}
      <PLStatement />

      {/* 02 · Monthly Performance */}
      <MonthlyPerformance />

      {/* 03 · Service Revenue: FTE vs Transaction billing */}
      <ServiceRevenuePanel />

      {/* 04 · EBIT Matrix · Department */}
      <EBITMatrix type="department" num="04" />

      {/* 05 · Driver-based Cost Bridge */}
      <DriverWaterfall />

      {/* 06 · EBIT Matrix · Customer */}
      <EBITMatrix type="customer" num="06" />

      {/* 07 · Cost & Revenue Analysis */}
      <CostAnalysisPanel />

      <footer className="mt-8 pt-5 border-t border-[var(--line)] flex justify-between items-center text-[11.5px] text-[var(--muted)]">
        <span className="font-mono">GMR SSC · Financial Decision Intelligence · v0.1</span>
        <span className="font-mono">Re-upload Excel anytime to refresh</span>
      </footer>
    </div>
    </div>
  )
}
