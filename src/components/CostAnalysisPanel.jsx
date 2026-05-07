import { useState, useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { getSectionInsights } from '../utils/sectionInsights'
import { motion } from 'framer-motion'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { MONTHS } from '../utils/computeDerived'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100

// Cost palette
const TYPE_COLOR = { PEX: '#C0392B', OPEX: '#B7791F', CAPEX: '#1F6FEB' }
const TYPE_LABEL = { PEX: 'PEX · Personnel', OPEX: 'OPEX · Operating', CAPEX: 'CAPEX · Capital' }
const TYPE_TEXT  = { PEX: 'text-brand-red', OPEX: 'text-brand-amber', CAPEX: 'text-brand-blue' }
const TYPE_BG    = { PEX: 'bg-brand-red-soft', OPEX: 'bg-brand-amber-soft', CAPEX: 'bg-brand-blue-soft' }

// Revenue palette
const REV_COLOR = { sf: '#1F8A4C', oi: '#5BB87C', it: '#A9D9BB' }
const REV_LABEL = { sf: 'Service Fees', oi: 'Other Income', it: 'Interest Income' }

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#161B23] border border-[var(--line)] rounded-[10px] p-3 shadow-lg text-[12px] min-w-[180px]">
      <div className="font-semibold text-[var(--ink)] mb-2 pb-1.5 border-b border-[var(--line)]">{label}</div>
      {payload.map((p, i) => {
        // p.color is reliably set by Recharts for all series types (bars and lines).
        // p.fill can be the string 'none' for Line series (truthy but not a valid color).
        const swatchColor = p.color || p.stroke || (p.fill && p.fill !== 'none' ? p.fill : undefined) || 'var(--muted)'
        return (
          <div key={i} className="flex items-center justify-between gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
              <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ background: swatchColor }} />
              {p.name}
            </span>
            <span className="font-mono font-semibold text-[var(--ink)]">
              ₹{(p.value ?? 0).toFixed(2)} Cr
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Cost-by-month stacked chart ─────────────────────────────────────────────
function CostMoMChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(0)}`}
          tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--muted)' }}
          axisLine={false} tickLine={false}
          label={{ value: '₹ Cr', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: 'var(--muted)' } }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="PEX"   stackId="cost" fill={TYPE_COLOR.PEX}   name={TYPE_LABEL.PEX} />
        <Bar dataKey="OPEX"  stackId="cost" fill={TYPE_COLOR.OPEX}  name={TYPE_LABEL.OPEX} />
        <Bar dataKey="CAPEX" stackId="cost" fill={TYPE_COLOR.CAPEX} name={TYPE_LABEL.CAPEX} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="fc1" stroke="#D4A22F" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#D4A22F', strokeWidth: 0 }} name="FC1 Target" />
        <Line type="monotone" dataKey="fc2" stroke="#0E1116" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#0E1116', strokeWidth: 0 }} name="FC2 Target" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Revenue-by-month stacked chart ──────────────────────────────────────────
function RevenueMoMChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(0)}`}
          tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--muted)' }}
          axisLine={false} tickLine={false}
          label={{ value: '₹ Cr', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: 'var(--muted)' } }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="sf" stackId="rev" fill={REV_COLOR.sf} name={REV_LABEL.sf} />
        <Bar dataKey="oi" stackId="rev" fill={REV_COLOR.oi} name={REV_LABEL.oi} />
        <Bar dataKey="it" stackId="rev" fill={REV_COLOR.it} name={REV_LABEL.it} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="fc1" stroke="#D4A22F" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#D4A22F', strokeWidth: 0 }} name="FC1 Target" />
        <Line type="monotone" dataKey="fc2" stroke="#0E1116" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#0E1116', strokeWidth: 0 }} name="FC2 Target" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Combined revenue (line) vs cost (stacked bars) ──────────────────────────
function CombinedChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(0)}`}
          tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--muted)' }}
          axisLine={false} tickLine={false}
          label={{ value: '₹ Cr', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: 'var(--muted)' } }}
        />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine y={0} stroke="var(--line)" />
        <Bar dataKey="PEX"   stackId="cost" fill={TYPE_COLOR.PEX}   name={TYPE_LABEL.PEX} />
        <Bar dataKey="OPEX"  stackId="cost" fill={TYPE_COLOR.OPEX}  name={TYPE_LABEL.OPEX} />
        <Bar dataKey="CAPEX" stackId="cost" fill={TYPE_COLOR.CAPEX} name={TYPE_LABEL.CAPEX} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="revTotal"  stroke="#1F8A4C" strokeWidth={2.5} dot={{ r: 4, fill: '#1F8A4C', strokeWidth: 0 }} name="Revenue · Actual" />
        <Line type="monotone" dataKey="netProfit" stroke="#1F6FEB" strokeWidth={2}   strokeDasharray="4 3" dot={{ r: 3, fill: '#1F6FEB', strokeWidth: 0 }} name="Net Profit" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── YoY chart (annual cost evolution) ────────────────────────────────────────
function YoYChart({ data, years }) {
  const yearColors = ['#A9C3F5', '#1F6FEB', '#0E1116']
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v.toFixed(0)}`}
          tick={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--muted)' }}
          axisLine={false} tickLine={false}
          label={{ value: '₹ Cr', angle: -90, position: 'insideLeft', offset: 12, style: { fontSize: 10, fill: 'var(--muted)' } }}
        />
        <Tooltip content={<ChartTooltip />} />
        <ReferenceLine y={0} stroke="var(--line)" />
        {years.map((y, i) => (
          <Bar
            key={y}
            dataKey={`fy${y}`}
            name={`FY ${y} Actual`}
            fill={yearColors[Math.min(i, yearColors.length - 1)]}
            radius={i === years.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── YoY summary table (kept) ─────────────────────────────────────────────────
function YoYTypeTable({ data, years }) {
  const latest = years[years.length - 1]
  const prev   = years[years.length - 2]

  const totals = { type: 'Total' }
  years.forEach((y) => {
    totals[`fy${y}`] = r2(data.reduce((s, d) => s + (d[`fy${y}_actual`] ?? 0), 0))
  })
  if (prev) {
    const change = r2(totals[`fy${latest}`] - totals[`fy${prev}`])
    totals.yoyChange = totals[`fy${prev}`] > 0 ? r2((change / totals[`fy${prev}`]) * 100) : null
    totals.change = change
  }
  const rows = [
    ...data.map((d) => ({ ...d, change: r2((d[`fy${latest}_actual`] ?? 0) - (d[`fy${prev}_actual`] ?? 0)) })),
    totals,
  ]

  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--line)] bg-[var(--bg)] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-[var(--ink-soft)]">
          Year-on-Year Cost Comparison
        </span>
        <span className="text-[11px] font-mono text-[var(--muted)]">FY {prev} vs FY {latest} Actuals · ₹ Cr</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[10.5px] uppercase tracking-[.12em] font-semibold text-[var(--ink-soft)]">
              <th className="text-left px-5 py-2 min-w-[180px]">Cost Type</th>
              {years.map((y) => (
                <th key={y} className="text-right px-4 py-2 min-w-[100px]">FY {y}</th>
              ))}
              <th className="text-right px-4 py-2 min-w-[80px]">Change</th>
              <th className="text-right px-5 py-2 min-w-[80px]">YoY %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isTotal = row.type === 'Total'
              const yoyChg  = row.yoyChange
              const favorable = (row.change ?? 0) <= 0

              return (
                <tr
                  key={row.type}
                  className={`border-b border-[var(--line)] last:border-b-0 ${isTotal ? 'bg-[var(--bg)] font-bold' : 'hover:bg-[var(--bg)] transition-colors'}`}
                >
                  <td className={`px-5 py-2.5 ${isTotal ? 'text-[13px] uppercase tracking-[.04em] text-[var(--ink)]' : ''}`}>
                    {isTotal ? (
                      <span className="font-bold">{row.type}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TYPE_COLOR[row.type] }} />
                        <span className={`font-semibold ${TYPE_TEXT[row.type]}`}>{TYPE_LABEL[row.type]}</span>
                      </span>
                    )}
                  </td>
                  {years.map((y, yi) => (
                    <td key={y} className={`px-4 py-2.5 text-right font-mono font-semibold ${yi === years.length - 1 ? TYPE_TEXT[row.type] || 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
                      ₹{(row[`fy${y}_actual`] ?? row[`fy${y}`] ?? 0).toFixed(2)}
                    </td>
                  ))}
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${favorable ? 'text-brand-green' : 'text-brand-red'}`}>
                    {row.change != null ? `${row.change >= 0 ? '+' : ''}${row.change.toFixed(2)}` : '—'}
                  </td>
                  <td className={`px-5 py-2.5 text-right font-mono font-semibold ${yoyChg == null ? 'text-[var(--muted)]' : favorable ? 'text-brand-green' : 'text-brand-red'}`}>
                    {yoyChg == null ? '—' : `${yoyChg >= 0 ? '+' : ''}${yoyChg.toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CostAnalysisPanel() {
  const [view, setView] = useState('cost')   // 'cost' | 'revenue' | 'combined' | 'yoy'
  const { rawCost, derived, year, periodMode, selectedQ, selectedPeriodMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const insights = useMemo(() => getSectionInsights('cost-analysis', { derived, year, rawCost }), [derived, year, rawCost])

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths),
    [periodMode, selectedQ, selectedPeriodMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(periodMode, selectedQ, selectedPeriodMonth, year)

  // MoM cost data
  const costMoMData = useMemo(() => {
    return MONTHS.filter((m) => activeMonths.includes(m)).map((m) => {
      const rows = rawCost.filter((c) => c.year === year && c.month === m)
      const pex   = r2(rows.filter((c) => c.costType === 'PEX'  ).reduce((s, c) => s + c.actual, 0) / CR)
      const opex  = r2(rows.filter((c) => c.costType === 'OPEX' ).reduce((s, c) => s + c.actual, 0) / CR)
      const capex = r2(rows.filter((c) => c.costType === 'CAPEX').reduce((s, c) => s + c.actual, 0) / CR)
      const fc1   = r2(rows.reduce((s, c) => s + c.fc1, 0) / CR)
      const fc2   = r2(rows.reduce((s, c) => s + c.fc2, 0) / CR)
      const total = r2(pex + opex + capex)
      return { month: m, PEX: pex, OPEX: opex, CAPEX: capex, fc1, fc2, total }
    }).filter((d) => d.total > 0 || d.fc2 > 0 || d.fc1 > 0)
  }, [rawCost, year, activeMonths])

  // MoM revenue data — Service Fees + Other Income + Interest, with FC1/FC2 totals
  const revenueMoMData = useMemo(() => {
    return MONTHS.filter((m) => activeMonths.includes(m)).map((m) => {
      const rows = rawRevenue.filter((r) => r.year === year && r.month === m)
      const sf   = r2(rows.reduce((s, r) => s + (r.actServiceFees || 0), 0) / CR)
      const oi   = r2(rows.reduce((s, r) => s + (r.actOtherIncome || 0), 0) / CR)
      const it   = r2(rows.reduce((s, r) => s + (r.actInterest    || 0), 0) / CR)
      const fc1  = r2(rows.reduce((s, r) => s + (r.fc1ServiceFees || 0) + (r.fc1OtherIncome || 0) + (r.fc1Interest || 0), 0) / CR)
      const fc2  = r2(rows.reduce((s, r) => s + (r.fc2ServiceFees || 0) + (r.fc2OtherIncome || 0) + (r.fc2Interest || 0), 0) / CR)
      const total = r2(sf + oi + it)
      return { month: m, sf, oi, it, fc1, fc2, total }
    }).filter((d) => d.total > 0 || d.fc1 > 0 || d.fc2 > 0)
  }, [rawRevenue, year, activeMonths])

  // Combined data — cost stacked bars + revenue line + net profit line
  const combinedData = useMemo(() => {
    return MONTHS.filter((m) => activeMonths.includes(m)).map((m) => {
      const cRows = rawCost.filter((c) => c.year === year && c.month === m)
      const rRows = rawRevenue.filter((r) => r.year === year && r.month === m)
      const pex   = r2(cRows.filter((c) => c.costType === 'PEX'  ).reduce((s, c) => s + c.actual, 0) / CR)
      const opex  = r2(cRows.filter((c) => c.costType === 'OPEX' ).reduce((s, c) => s + c.actual, 0) / CR)
      const capex = r2(cRows.filter((c) => c.costType === 'CAPEX').reduce((s, c) => s + c.actual, 0) / CR)
      const opsRev = r2(rRows.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0) / CR)
      const revTotal = r2(opsRev + r2(rRows.reduce((s, r) => s + (r.actInterest || 0), 0) / CR))
      const opsCost  = r2(pex + opex)  // EBIT excludes CAPEX
      const tax      = r2(rRows.reduce((s, r) => s + (r.actTax || 0), 0) / CR)
      const interest = r2(rRows.reduce((s, r) => s + (r.actInterest || 0), 0) / CR)
      const netProfit = r2(opsRev - opsCost + interest - tax)
      return { month: m, PEX: pex, OPEX: opex, CAPEX: capex, revTotal, netProfit }
    }).filter((d) => d.revTotal > 0 || d.PEX + d.OPEX + d.CAPEX > 0)
  }, [rawRevenue, rawCost, year, activeMonths])

  // YoY annual data
  const yoyMonthlyData = useMemo(() => {
    return MONTHS.map((m) => {
      const entry = { month: m }
      derived.years.forEach((y) => {
        const rows = rawCost.filter((c) => c.year === y && c.month === m)
        entry[`fy${y}`] = r2(rows.reduce((s, c) => s + c.actual, 0) / CR)
      })
      return entry
    }).filter((d) => derived.years.some((y) => (d[`fy${y}`] ?? 0) > 0))
  }, [rawCost, derived.years])

  const yoyTypeData = useMemo(() => {
    return ['PEX', 'OPEX', 'CAPEX'].map((type) => {
      const entry = { type }
      derived.years.forEach((y) => {
        const Y  = derived.byYear[y]
        const ct = Y?.costByType.find((c) => c.type === type)
        if (ct) { entry[`fy${y}_actual`] = ct.actual; entry[`fy${y}_fc2`] = ct.fc2 }
      })
      if (derived.years.length >= 2) {
        const latest = derived.years[derived.years.length - 1]
        const prev   = derived.years[derived.years.length - 2]
        const lv = entry[`fy${latest}_actual`] ?? 0
        const pv = entry[`fy${prev}_actual`]   ?? 0
        entry.yoyChange = pv > 0 ? r2(((lv - pv) / pv) * 100) : null
      }
      return entry
    })
  }, [derived])

  const tabs = [
    { id: 'cost',     label: 'Cost Breakdown' },
    { id: 'revenue',  label: 'Revenue Breakdown' },
    { id: 'combined', label: 'Revenue vs Cost' },
    { id: 'yoy',      label: 'Year-on-Year' },
  ]

  const headerInfo = {
    cost: {
      title:  `Monthly Cost Breakdown · ${periodLabel}`,
      sub:    'Stacked bars = actual spend by type · Dashed lines = FC1 (amber) & FC2 (black) totals',
    },
    revenue: {
      title:  `Monthly Revenue Breakdown · ${periodLabel}`,
      sub:    'Stacked bars = Service Fees + Other Income + Interest · Dashed lines = FC1 & FC2 total revenue',
    },
    combined: {
      title:  `Revenue vs Cost · ${periodLabel}`,
      sub:    'Cost stacked as bars (PEX·OPEX·CAPEX) · Revenue as solid line · Net profit as dashed blue line',
    },
    yoy: {
      title:  `Cost Evolution · ${derived.years.map((y) => `FY ${y}`).join(' vs ')}`,
      sub:    'Monthly total actual cost per financial year · grouped bars',
    },
  }

  return (
    <div className="mt-7">
      <SectionHead num="03" title={`Cost & Revenue Analysis · ${periodLabel}`}>
        {view === 'cost'     && 'Monthly cost split by type — PEX, OPEX, CAPEX vs forecast targets.'}
        {view === 'revenue'  && 'Monthly revenue split by stream — Service Fees, Other Income, Interest vs forecast targets.'}
        {view === 'combined' && 'Side-by-side view of revenue and cost per month — visualises monthly profit at a glance.'}
        {view === 'yoy'      && 'Year-on-year cost evolution — monthly and annual comparison across financial years.'}
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        {/* Tab toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium border transition ${
                view === tab.id
                  ? 'bg-ink text-bg-light border-ink'
                  : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main chart card */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] p-6">
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h4 className="m-0 font-display font-medium text-[18px] tracking-[-.2px]">
                {headerInfo[view].title}
              </h4>
              <p className="m-0 text-[12px] text-[var(--muted)] mt-1">
                {headerInfo[view].sub}
              </p>
            </div>

            {/* Legend chips */}
            <div className="flex flex-wrap gap-2">
              {view === 'cost' && (
                <>
                  {['PEX', 'OPEX', 'CAPEX'].map((t) => (
                    <span key={t} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BG[t]} ${TYPE_TEXT[t]}`}>
                      <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
                      {t}
                    </span>
                  ))}
                  <Pill label="FC1 Target" dash="#D4A22F" tone="amber" />
                  <Pill label="FC2 Target" dash="#0E1116" tone="ink" />
                </>
              )}
              {view === 'revenue' && (
                <>
                  {[['sf', 'Service Fees'], ['oi', 'Other Income'], ['it', 'Interest']].map(([k, lbl]) => (
                    <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-green-soft text-brand-green">
                      <span className="w-2 h-2 rounded-sm" style={{ background: REV_COLOR[k] }} />
                      {lbl}
                    </span>
                  ))}
                  <Pill label="FC1 Target" dash="#D4A22F" tone="amber" />
                  <Pill label="FC2 Target" dash="#0E1116" tone="ink" />
                </>
              )}
              {view === 'combined' && (
                <>
                  {['PEX', 'OPEX', 'CAPEX'].map((t) => (
                    <span key={t} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BG[t]} ${TYPE_TEXT[t]}`}>
                      <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
                      {t}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-green-soft text-brand-green">
                    <span className="w-3 h-0.5 inline-block" style={{ background: '#1F8A4C' }} />
                    Revenue
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-blue-soft text-brand-blue">
                    <span className="w-3 h-0.5 inline-block" style={{ borderTop: '2px dashed #1F6FEB' }} />
                    Net Profit
                  </span>
                </>
              )}
              {view === 'yoy' && (
                derived.years.map((y, i) => (
                  <span key={y} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-blue-soft text-brand-blue">
                    <span className="w-2 h-2 rounded-sm" style={{ background: i === 0 ? '#A9C3F5' : i === 1 ? '#1F6FEB' : '#0E1116' }} />
                    FY {y}
                  </span>
                ))
              )}
            </div>
          </div>

          {view === 'cost'     && <CostMoMChart    data={costMoMData} />}
          {view === 'revenue'  && <RevenueMoMChart data={revenueMoMData} />}
          {view === 'combined' && <CombinedChart   data={combinedData} />}
          {view === 'yoy'      && <YoYChart        data={yoyMonthlyData} years={derived.years} />}
        </div>

        {/* YoY summary table only on YoY view */}
        {view === 'yoy' && <YoYTypeTable data={yoyTypeData} years={derived.years} />}
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}

function Pill({ label, dash, tone }) {
  const cls = tone === 'amber'
    ? 'bg-[var(--bg)] text-brand-amber border border-[var(--line)]'
    : 'bg-[var(--bg)] text-[var(--ink-soft)] border border-[var(--line)]'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      <span className="w-4 h-0.5 inline-block" style={{ borderTop: `2px dashed ${dash}` }} />
      {label}
    </span>
  )
}
