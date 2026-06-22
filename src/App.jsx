import { useEffect } from 'react'
import { useDashStore } from './store/useDashStore'
import { useRealtimeWebhookSync } from './utils/useRealtimeWebhookSync'
import TopBar from './components/TopBar'
import FilterBar from './components/FilterBar'
import HeroSummary from './components/HeroSummary'
import KPISection from './components/KPISection'
import MonthlyCharts from './components/MonthlyCharts'
import ProjectStatusChart from './components/ProjectStatusChart'
import MarginRankCharts from './components/MarginRankCharts'
import MonthlyComparison from './components/MonthlyComparison'
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
      <div className="max-w-[1800px] mx-auto px-4 md:px-6 pt-4 md:pt-7 pb-2 md:pb-3">
        <TopBar />
        <FilterBar />
      </div>

    <div className="max-w-[1800px] mx-auto px-4 md:px-6 pb-12 md:pb-20">
      <HeroSummary />
      <KPISection />
      <MonthlyCharts />
      <MonthlyComparison />
      <ProjectStatusChart />
      <MarginRankCharts />

      {/* Sections below intentionally hidden while the dashboard is being redesigned.
          Components remain in the codebase so we can wire them back in once the
          new layout for each section is finalised. */}
      {false && (
        <>
          <div className="mt-4">
            <CostStructure />
          </div>
          <PLStatement />
          <CostAnalysisPanel />
          <ServiceRevenuePanel />
          <EBITMatrix type="department" num="04" />
          <DriverWaterfall />
          <MonthlyPerformance />
        </>
      )}
    </div>
    </div>
  )
}
