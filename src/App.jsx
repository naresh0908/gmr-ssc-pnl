import { useEffect } from 'react'
import { useDashStore } from './store/useDashStore'
import { useRealtimeWebhookSync } from './utils/useRealtimeWebhookSync'
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
  
  // Initialize insights on first load
  useEffect(() => { initInsights() }, [initInsights])
  
  // Real-time webhook sync: Dashboard updates instantly when SharePoint file changes
  // Polls for sync completion every 5 seconds
  useRealtimeWebhookSync({ pollInterval: 5000, verbose: false })

  return (
    <div>
      {/* Sticky header - full viewport width so background covers edge-to-edge */}
      <div className="sticky top-0 z-40 bg-[var(--bg)] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-9 pt-4 md:pt-7 pb-2 md:pb-3">
          <TopBar />
          <PeriodBar />
        </div>
      </div>

    <div className="max-w-[1440px] mx-auto px-4 md:px-9 pb-12 md:pb-20">
      {/* Executive summary block: hero + KPI cards + cost structure overview */}
      <HeroSummary />
      <KPISection />
      <div className="mt-4">
        <CostStructure />
      </div>

      {/* 01 · P&L Statement */}
      <PLStatement />

      {/* 02 · Cost & Revenue Analysis */}
      <CostAnalysisPanel />

      {/* 03 · Service Revenue: FTE vs Transaction billing */}
      <ServiceRevenuePanel />

      {/* 04 · EBIT Matrix · Department */}
      <EBITMatrix type="department" num="04" />

      {/* 05 · Driver-based Cost Bridge */}
      <DriverWaterfall />

      {/* 06 · Monthly Performance */}
      <MonthlyPerformance />

      <footer className="mt-8 pt-5 border-t border-[var(--line)] flex justify-between items-center text-[11.5px] text-[var(--muted)]">
        <span className="font-mono">GMR SSC · Financial Decision Intelligence · v0.1</span>
        <span className="font-mono"></span>
      </footer>
    </div>
    </div>
  )
}
