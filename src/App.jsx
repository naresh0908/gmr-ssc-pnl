import { useEffect, useMemo } from 'react'
import { useDashStore } from './store/useDashStore'
import TopBar from './components/TopBar'
import PeriodBar from './components/PeriodBar'
import HeroSummary from './components/HeroSummary'
import KPISection from './components/KPISection'
import EBITMatrix from './components/EBITMatrix'
import ServiceRevenuePanel from './components/ServiceRevenuePanel'
import PLStatement from './components/PLStatement'
import MonthlyPerformance from './components/MonthlyPerformance'
import CostStructure from './components/CostStructure'
import DeptEBITPanel from './components/DeptEBITPanel'
import DriverWaterfall from './components/DriverWaterfall'
import CostAnalysisPanel from './components/CostAnalysisPanel'
import SectionHead from './components/SectionHead'
import SectionInsightBar from './components/SectionInsightBar'
import { getSectionInsights } from './utils/sectionInsights'

export default function App() {
  const { year, derived, initInsights } = useDashStore()
  const costProfInsights = useMemo(() => getSectionInsights('cost-prof', { derived, year }), [derived, year])

  useEffect(() => { initInsights() }, [initInsights])

  return (
    <div className="max-w-[1440px] mx-auto px-9 pt-7 pb-20">
      <TopBar />
      <PeriodBar />
      <HeroSummary />
      <KPISection />

      {/* 01 · P&L Statement: full actuals vs FC1 + FC2 */}
      <PLStatement />

      {/* 02 · Monthly Performance: actuals vs FC1/FC2 by month */}
      <MonthlyPerformance />

      {/* 03 · Service Revenue: FTE vs Transaction billing model */}
      <ServiceRevenuePanel />

      {/* 04 · EBIT Matrix: Month × Department heatmap */}
      <EBITMatrix type="department" num="04" />

      {/* 05 · Cost Structure + Department EBIT side-by-side */}
      <div className="mt-7">
        <SectionHead num="05" title={`Cost & Profitability · FY ${year}`}>
          Cost structure by category and department-level EBIT ranking.
        </SectionHead>
        <div className="grid lg:grid-cols-[1.5fr_1fr] grid-cols-1 gap-5">
          <CostStructure />
          <DeptEBITPanel />
        </div>
        <SectionInsightBar insights={costProfInsights} />
      </div>

      {/* 06 · Driver Waterfall: FC1/FC2 vs Actual variance by driver */}
      <DriverWaterfall />

      {/* 07 · EBIT Matrix: Month × Customer (renders only when Customer column present) */}
      <EBITMatrix type="customer" num="07" />

      {/* 08 · Cost Structure Analysis: MoM / YoY toggle */}
      <CostAnalysisPanel />

      <footer className="mt-8 pt-5 border-t border-[var(--line)] flex justify-between items-center text-[11.5px] text-[var(--muted)]">
        <span className="font-mono">GMR SSC · Financial Decision Intelligence · v0.1</span>
        <span className="font-mono">Re-upload Excel anytime to refresh</span>
      </footer>
    </div>
  )
}
