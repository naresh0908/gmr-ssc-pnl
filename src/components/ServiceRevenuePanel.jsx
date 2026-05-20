import { useState, useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { getSectionInsights } from '../utils/sectionInsights'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

const CHART_H = 130

// Shorten dept name for tab labels
const short = (name) => {
  const m = name.match(/\(([^)]+)\)/)
  if (m) return m[1]
  const words = name.split(' ')
  const s = words.length >= 3 ? words.slice(0, 2).join(' ') : name
  return s.replace(/\s*&\s*$/, '')
}

export default function ServiceRevenuePanel() {
  const [activeDept, setActiveDept]     = useState('All')
  const [selectedMonth, setSelectedMonth] = useState(null)   // null = whole period; bar click sets one month
  const { serviceRevenue, derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const insights = useMemo(() => getSectionInsights('service-revenue', { derived, serviceRevenue, year }), [derived, serviceRevenue, year])

  const SRY = serviceRevenue?.[year]
  if (!SRY) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const periodLabel  = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  // The "scope" months - when a bar is clicked, scope down to that single month.
  const scopeMonths = useMemo(
    () => (selectedMonth && activeMonths.includes(selectedMonth) ? [selectedMonth] : activeMonths),
    [selectedMonth, activeMonths]
  )

  // Aggregate by department for the active scope (period or single selected month)
  const filteredByDept = useMemo(() =>
    SRY.byDept.map((d) => {
      const months = d.monthly.filter((m) => scopeMonths.includes(m.month))
      const total      = Math.round(months.reduce((s, m) => s + m.total, 0) * 100) / 100
      const txnRevenue = Math.round(months.reduce((s, m) => s + m.txnRevenue, 0) * 100) / 100
      const fteRevenue = Math.round(months.reduce((s, m) => s + m.fteRevenue, 0) * 100) / 100
      return { ...d, total, txnRevenue, fteRevenue }
    }).sort((a, b) => b.total - a.total),
    [SRY.byDept, scopeMonths]
  )

  // Bar chart always shows every active-period month (so users can see a bar to click).
  // Independent of selectedMonth - selecting just highlights one bar.
  const chartMonthly = useMemo(() => {
    if (activeDept !== 'All') {
      const dept = SRY.byDept.find((d) => d.dept === activeDept)
      return (dept?.monthly ?? []).filter((m) => activeMonths.includes(m.month))
    }
    return SRY.monthly.filter((m) => activeMonths.includes(m.month))
  }, [SRY, activeDept, activeMonths])
  const maxMonthly = Math.max(...chartMonthly.map((m) => m.total), 0.01)

  // Detail dept (when single dept is active in tabs) - share is prorated to scope months.
  const deptData = useMemo(() => {
    if (activeDept === 'All') return null
    const d = filteredByDept.find((dd) => dd.dept === activeDept)
    if (!d) return null
    const monthsInScope = d.monthly.filter((m) => scopeMonths.includes(m.month))
    const annualTotal = d.monthly.reduce((s, m) => s + m.total, 0)
    const scopeTotal  = monthsInScope.reduce((s, m) => s + m.total, 0)
    const scale = annualTotal > 0 ? scopeTotal / annualTotal : 1
    const txnByService  = (d.txnByService ?? []).map((s) => ({ ...s, revenue: Math.round(s.revenue * scale * 100) / 100 }))
    const fteByFunction = (d.fteByFunction ?? []).map((f) => ({ ...f, revenue: Math.round(f.revenue * scale * 100) / 100 }))
    return { ...d, txnByService, fteByFunction }
  }, [activeDept, filteredByDept, scopeMonths])

  const depts = filteredByDept.map((d) => d.dept)

  const sumFte   = deptData ? deptData.fteRevenue : filteredByDept.reduce((s, d) => s + d.fteRevenue, 0)
  const sumTxn   = deptData ? deptData.txnRevenue : filteredByDept.reduce((s, d) => s + d.txnRevenue, 0)
  const sumTotal = deptData ? deptData.total      : filteredByDept.reduce((s, d) => s + d.total, 0)
  const ftePct   = sumTotal > 0 ? Math.round((sumFte / sumTotal) * 100) : 0

  const scopeLabel = selectedMonth ? `${selectedMonth} · FY ${year}` : `${periodLabel}`

  return (
    <div className="mt-7">
      <SectionHead
        num="03"
        title={(
          <span className="inline-flex flex-col leading-tight">
            <span>Service Revenue</span>
            <span className="font-mono text-[12px] uppercase tracking-[.12em] text-[var(--muted)] mt-1">
              FTE Revenue & Transaction Revenue
            </span>
          </span>
        )}
      >
        Revenue by billing model - FTE-based (recurring headcount) and transaction-based (volume-driven).
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        {/* Department tabs */}
        <div className="flex gap-2 px-4 pt-4 pb-3.5 border-b border-[var(--line)] flex-wrap bg-[var(--card)]">
          {['All', ...depts].map((d) => {
            const active = activeDept === d
            return (
              <button
                key={d}
                onClick={() => { setActiveDept(d); setSelectedMonth(null) }}
                className={`px-3 py-1.5 text-[11.5px] rounded-full font-semibold transition-colors ${
                  active
                    ? 'bg-brand-blue text-white'
                    : 'bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                {d === 'All' ? 'All Departments' : short(d)}
              </button>
            )
          })}
        </div>

        {/* Summary KPI strip - reflects selected month if any, otherwise the period */}
        <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-b border-[var(--line)] bg-[var(--card)]">
          <KPICard label="Total Revenue"        value={sumTotal} sub={scopeLabel} />
          <KPICard label="FTE Revenue"          value={sumFte}   pct={ftePct}        color="green" sub={scopeLabel} />
          <KPICard label="Transaction Revenue"  value={sumTxn}   pct={100 - ftePct}  color="blue"  sub={scopeLabel} />
        </div>

        {/* Monthly stacked bar chart */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="text-[10.5px] uppercase tracking-[.14em] font-semibold text-[var(--ink-soft)]">
              Monthly Revenue (₹ Cr) · click a bar to filter the breakdown below
            </div>
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="text-[10.5px] font-semibold text-brand-blue hover:underline"
              >
                ✕ Clear · showing {selectedMonth}
              </button>
            )}
          </div>
          <MonthlyChart
            monthly={chartMonthly}
            max={maxMonthly}
            selectedMonth={selectedMonth}
            onSelect={(m) => setSelectedMonth((cur) => (cur === m ? null : m))}
          />
        </div>

        {/* Legend */}
        <div className="flex gap-6 px-5 pb-4 text-[12px] text-[var(--ink-soft)] items-center">
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-sm bg-brand-green" />
            <span>FTE Revenue</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-2.5 rounded-sm bg-brand-blue" />
            <span>Transaction Revenue</span>
          </span>
        </div>

        {/* Bottom detail section */}
        <div className="border-t border-[var(--line)]">
          {activeDept === 'All' ? (
            <DeptTable depts={filteredByDept} />
          ) : deptData ? (
            <ServiceDetail data={deptData} />
          ) : null}
        </div>
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

// ─── KPI strip card ────────────────────────────────────────────────────────────
function KPICard({ label, value, pct, color, sub }) {
  const valCls =
    color === 'green' ? 'text-brand-green' : color === 'blue' ? 'text-brand-blue' : 'text-[var(--ink)]'
  return (
    <div className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[.14em] font-semibold text-[var(--ink-soft)] mb-1">{label}</div>
      <div className={`font-display text-[22px] font-bold leading-tight ${valCls}`}>
        ₹{value?.toFixed(1)} Cr
      </div>
      {pct !== undefined && (
        <div className="text-[12px] text-[var(--muted)] mt-0.5">{pct}% of total</div>
      )}
      {sub && <div className="text-[12px] text-[var(--muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Monthly stacked bar chart ─────────────────────────────────────────────────
function MonthlyChart({ monthly, max, selectedMonth, onSelect }) {
  return (
    <div>
      {/* Bars */}
      <div className="flex items-end gap-[3px]" style={{ height: CHART_H }}>
        {monthly.map((m) => {
          const barH = max > 0 ? (m.total / max) * CHART_H : 0
          const txnH = m.total > 0 ? (m.txnRevenue / m.total) * barH : 0
          const fteH = barH - txnH
          const isSel    = selectedMonth === m.month
          const isOther  = selectedMonth && !isSel

          return (
            <button
              type="button"
              key={m.month}
              onClick={() => onSelect?.(m.month)}
              className={`relative flex-1 group flex flex-col justify-end transition-opacity ${onSelect ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} ${isOther ? 'opacity-40 hover:opacity-70' : 'opacity-100'}`}
              style={{ height: CHART_H, padding: 0, border: 0, background: 'transparent' }}
            >
              {/* Selected indicator ring */}
              {isSel && (
                <div className="absolute inset-x-[-2px] top-[-4px] bottom-0 border-2 border-brand-blue rounded-[4px] pointer-events-none" />
              )}

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[var(--ink)] text-white text-[10px] px-2 py-1.5 rounded-[6px] whitespace-nowrap opacity-0 group-hover:opacity-100 z-50 pointer-events-none leading-[1.6]">
                <div className="font-semibold">{m.month} {isSel ? '· selected' : ''}</div>
                <div className="text-green-300">FTE ₹{m.fteRevenue.toFixed(2)} Cr</div>
                <div className="text-blue-300">Txn ₹{m.txnRevenue.toFixed(2)} Cr</div>
                <div className="text-[#9AA4B5] mt-0.5">click to {isSel ? 'clear' : 'filter'}</div>
              </div>

              {/* Stacked bar: Txn on top, FTE on bottom */}
              <div style={{ height: barH, display: 'flex', flexDirection: 'column' }}>
                <div className="bg-brand-blue rounded-t-[2px]" style={{ height: txnH }} />
                <div className="bg-brand-green" style={{ height: fteH }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Month labels */}
      <div className="flex gap-[3px] mt-1.5">
        {monthly.map((m) => {
          const isSel = selectedMonth === m.month
          return (
            <div key={m.month} className={`flex-1 text-center font-mono text-[9px] ${isSel ? 'text-brand-blue font-bold' : 'text-[var(--muted)]'}`}>
              {m.month}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── All-departments breakdown table ──────────────────────────────────────────
function DeptTable({ depts }) {
  const maxTotal = Math.max(...depts.map((d) => d.total), 0.01)

  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.8fr] bg-[var(--card)] border-b border-[var(--line)] text-[10.5px] tracking-[.14em] uppercase font-semibold text-[var(--ink-soft)] px-4 py-2.5">
        <div>Department</div>
        <div className="text-right text-brand-green">FTE Rev</div>
        <div className="text-right text-brand-blue">Txn Rev</div>
        <div className="text-right">Total</div>
        <div className="pl-4">Revenue Mix</div>
      </div>

      {depts.map((d) => {
        const ftePct = d.total > 0 ? (d.fteRevenue / d.total) * 100 : 0
        const barW = (d.total / maxTotal) * 100

        return (
          <div
            key={d.dept}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1.8fr] px-4 py-3 border-b border-[var(--line)] last:border-b-0 bg-[var(--card)] hover:bg-[var(--bg)]/35 transition items-center"
          >
            <div className="text-[13px] font-semibold text-[var(--ink)]">{d.dept}</div>
            <div className="text-right font-mono text-[12px] font-semibold text-brand-green">
              ₹{d.fteRevenue.toFixed(1)}
            </div>
            <div className="text-right font-mono text-[12px] font-semibold text-brand-blue">
              ₹{d.txnRevenue.toFixed(1)}
            </div>
            <div className="text-right font-mono text-[13px] font-bold text-[var(--ink)]">
              ₹{d.total.toFixed(1)}
            </div>
            <div className="pl-4">
              <div className="flex h-[7px] rounded-full overflow-hidden" style={{ width: `${barW}%` }}>
                <div className="bg-brand-green" style={{ width: `${ftePct}%` }} />
                <div className="bg-brand-blue flex-1" />
              </div>
              <div className="text-[9.5px] text-[var(--muted)] mt-0.5">
                {Math.round(ftePct)}% FTE · {100 - Math.round(ftePct)}% Txn
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Per-department service detail ────────────────────────────────────────────
function ServiceDetail({ data }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-[var(--line)]">
      {/* Transaction services */}
      <div className="p-5">
        <div className="text-[10.5px] uppercase tracking-[.14em] font-semibold text-brand-blue mb-4">
          Transaction Services
        </div>
        <div className="space-y-3">
          {data.txnByService.map((s) => (
            <div key={s.name} className="flex items-start justify-between gap-4">
              <span className="text-[13px] font-medium text-[var(--ink)]">{s.name}</span>
              <div className="text-right shrink-0">
                <div className="font-mono text-[13px] font-bold text-brand-blue">
                  ₹{s.revenue.toFixed(1)} Cr
                </div>
                <div className="text-[10.5px] text-[var(--muted)]">
                  {s.totalTxns.toLocaleString()} txns · ₹{s.rate}/txn
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-dashed border-[var(--line)] flex justify-between text-[12.5px]">
          <span className="text-[var(--ink-soft)] font-semibold">Total Transaction</span>
          <span className="font-mono font-bold text-brand-blue">₹{data.txnRevenue.toFixed(1)} Cr</span>
        </div>
      </div>

      {/* FTE functions */}
      <div className="p-5">
        <div className="text-[10.5px] uppercase tracking-[.14em] font-semibold text-brand-green mb-4">
          FTE-Based Revenue
        </div>
        <div className="space-y-3">
          {data.fteByFunction.map((f) => (
            <div key={f.name} className="flex items-start justify-between gap-4">
              <span className="text-[13px] font-medium text-[var(--ink)]">{f.name}</span>
              <div className="text-right shrink-0">
                <div className="font-mono text-[13px] font-bold text-brand-green">
                  ₹{f.revenue.toFixed(1)} Cr
                </div>
                <div className="text-[10.5px] text-[var(--muted)]">
                  {f.avgFte.toFixed(1)} avg FTE · ₹{Math.round(f.rate / 1000)}K/FTE
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-dashed border-[var(--line)] flex justify-between text-[12.5px]">
          <span className="text-[var(--ink-soft)] font-semibold">Total FTE</span>
          <span className="font-mono font-bold text-brand-green">₹{data.fteRevenue.toFixed(1)} Cr</span>
        </div>
      </div>
    </div>
  )
}
