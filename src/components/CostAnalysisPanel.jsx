import { useState, useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { getSectionInsights } from '../utils/sectionInsights'
import { motion } from 'framer-motion'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { MONTHS } from '../utils/computeDerived'

const CR = 1e7
const r2 = (n) => Math.round(n * 100) / 100

const TYPE_COLOR  = { PEX: '#C0392B', OPEX: '#B7791F', CAPEX: '#1F6FEB' }
const TYPE_LABEL  = { PEX: 'PEX · Personnel', OPEX: 'OPEX · Operating', CAPEX: 'CAPEX · Capital' }
const TYPE_TEXT   = { PEX: 'text-brand-red', OPEX: 'text-brand-amber', CAPEX: 'text-brand-blue' }
const TYPE_BG     = { PEX: 'bg-brand-red-soft', OPEX: 'bg-brand-amber-soft', CAPEX: 'bg-brand-blue-soft' }

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#161B23] border border-[var(--line)] rounded-[10px] p-3 shadow-lg text-[12px] min-w-[160px]">
      <div className="font-semibold text-[var(--ink)] mb-2 pb-1.5 border-b border-[var(--line)]">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-[var(--ink-soft)]">
            <span className="w-2 h-2 rounded-sm inline-block flex-shrink-0" style={{ background: p.fill || p.stroke || p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-semibold" style={{ color: p.fill || p.stroke || p.color }}>
            ₹{(p.value ?? 0).toFixed(2)} Cr
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── MoM stacked bar chart ─────────────────────────────────────────────────────
function MoMChart({ data }) {
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
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }}
          formatter={(v) => <span style={{ color: 'var(--ink-soft)' }}>{v}</span>}
        />
        <Bar dataKey="PEX"   stackId="cost" fill={TYPE_COLOR.PEX}   name={TYPE_LABEL.PEX}   radius={[0, 0, 0, 0]} />
        <Bar dataKey="OPEX"  stackId="cost" fill={TYPE_COLOR.OPEX}  name={TYPE_LABEL.OPEX}  radius={[0, 0, 0, 0]} />
        <Bar dataKey="CAPEX" stackId="cost" fill={TYPE_COLOR.CAPEX} name={TYPE_LABEL.CAPEX} radius={[3, 3, 0, 0]} />
        <Line
          type="monotone" dataKey="fc1"
          stroke="#D4A22F" strokeWidth={2} strokeDasharray="5 3"
          dot={{ r: 3, fill: '#D4A22F', strokeWidth: 0 }}
          name="FC1 Target"
        />
        <Line
          type="monotone" dataKey="fc2"
          stroke="#0E1116" strokeWidth={2} strokeDasharray="5 3"
          dot={{ r: 3, fill: '#0E1116', strokeWidth: 0 }}
          name="FC2 Target"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── YoY grouped/line chart ────────────────────────────────────────────────────
function YoYChart({ data, years }) {
  const yearColors = ['#A9C3F5', '#1F6FEB', '#0E1116']  // light→dark for older→newer years
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
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', paddingTop: 8 }}
          formatter={(v) => <span style={{ color: 'var(--ink-soft)' }}>{v}</span>}
        />
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

// ─── Sub-category breakdown table (MoM detail) ───────────────────────────────
function SubCategoryTable({ data, year }) {
  const byType = { PEX: [], OPEX: [], CAPEX: [] }
  data.forEach((d) => { if (byType[d.costType]) byType[d.costType].push(d) })

  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--line)] bg-[var(--bg)] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[.16em] text-[var(--ink-soft)]">
          Sub-Category Breakdown · FY {year}
        </span>
        <span className="text-[11px] font-mono text-[var(--muted)]">Actual vs FC1 & FC2 · ₹ Cr</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[10.5px] uppercase tracking-[.12em] font-semibold text-[var(--ink-soft)]">
              <th className="text-left px-5 py-2 min-w-[200px]">Sub-Category</th>
              <th className="text-left px-3 py-2 min-w-[80px]">Type</th>
              <th className="text-right px-3 py-2 min-w-[76px]">Actual</th>
              <th className="text-right px-3 py-2 min-w-[72px] text-brand-amber">FC1</th>
              <th className="text-right px-3 py-2 min-w-[68px] text-brand-green">Var·F1</th>
              <th className="text-right px-3 py-2 min-w-[72px]">FC2</th>
              <th className="text-right px-3 py-2 min-w-[68px] text-brand-blue">Var·F2</th>
              <th className="px-5 py-2 min-w-[110px]">vs FC2</th>
            </tr>
          </thead>
          <tbody>
            {['PEX', 'OPEX', 'CAPEX'].map((type) => (
              byType[type].length > 0 && (
                <>
                  <tr key={`hdr-${type}`} className={`border-b border-[var(--line)]`}>
                    <td colSpan={8} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] ${TYPE_BG[type]} ${TYPE_TEXT[type]}`}>
                      {TYPE_LABEL[type]}
                    </td>
                  </tr>
                  {byType[type].map((row) => {
                    const pct = row.fc2 !== 0 ? ((row.actual / row.fc2 - 1) * 100) : 0
                    const favF1 = row.varF1 <= 0
                    const favF2 = row.varF2 <= 0
                    return (
                      <tr key={row.sub} className="border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg)] transition-colors">
                        <td className="px-5 py-2 font-medium text-[var(--ink)]">{row.sub}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_BG[row.costType]} ${TYPE_TEXT[row.costType]}`}>
                            {row.costType}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${TYPE_TEXT[type]}`}>
                          {row.actual.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--ink-soft)]">
                          {row.fc1.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${favF1 ? 'text-brand-green' : 'text-brand-red'}`}>
                          {row.varF1 >= 0 ? '+' : ''}{row.varF1.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--ink-soft)]">
                          {row.fc2.toFixed(2)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${favF2 ? 'text-brand-green' : 'text-brand-red'}`}>
                          {row.varF2 >= 0 ? '+' : ''}{row.varF2.toFixed(2)}
                        </td>
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${favF2 ? 'bg-brand-green' : 'bg-brand-red'}`}
                                style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
                              />
                            </div>
                            <span className={`text-[10.5px] font-mono font-semibold w-[42px] text-right ${favF2 ? 'text-brand-green' : 'text-brand-red'}`}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── YoY annual type comparison table ────────────────────────────────────────
function YoYTypeTable({ data, years }) {
  const latest = years[years.length - 1]
  const prev   = years[years.length - 2]

  // Compute totals row
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
            {rows.map((row, i) => {
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
  const [view, setView] = useState('mom')
  const { rawCost, derived, year } = useDashStore()
  const insights = useMemo(() => getSectionInsights('cost-analysis', { derived, year }), [derived, year])

  // MoM: monthly PEX/OPEX/CAPEX actuals + FC1 + FC2 lines for selected year
  const momData = useMemo(() => {
    return MONTHS.map((m) => {
      const rows = rawCost.filter((c) => c.year === year && c.month === m)
      const pex   = r2(rows.filter((c) => c.costType === 'PEX'  ).reduce((s, c) => s + c.actual, 0) / CR)
      const opex  = r2(rows.filter((c) => c.costType === 'OPEX' ).reduce((s, c) => s + c.actual, 0) / CR)
      const capex = r2(rows.filter((c) => c.costType === 'CAPEX').reduce((s, c) => s + c.actual, 0) / CR)
      const fc1   = r2(rows.reduce((s, c) => s + c.fc1, 0) / CR)
      const fc2   = r2(rows.reduce((s, c) => s + c.fc2, 0) / CR)
      const total = r2(pex + opex + capex)
      return { month: m, PEX: pex, OPEX: opex, CAPEX: capex, fc1, fc2, total }
    }).filter((d) => d.total > 0 || d.fc2 > 0 || d.fc1 > 0)
  }, [rawCost, year])

  // Sub-category totals for the MoM detail table
  const subCatData = useMemo(() => {
    const rows = rawCost.filter((c) => c.year === year)
    const subs  = [...new Set(rows.map((r) => r.subCategory))].filter(Boolean)
    return subs.map((sub) => {
      const subRows  = rows.filter((r) => r.subCategory === sub)
      const costType = subRows[0]?.costType ?? 'OPEX'
      const actual   = r2(subRows.reduce((s, r) => s + r.actual, 0) / CR)
      const fc1      = r2(subRows.reduce((s, r) => s + r.fc1, 0) / CR)
      const fc2      = r2(subRows.reduce((s, r) => s + r.fc2, 0) / CR)
      return { sub, costType, actual, fc1, fc2, varF1: r2(actual - fc1), varF2: r2(actual - fc2) }
    }).sort((a, b) => b.actual - a.actual)
  }, [rawCost, year])

  // YoY: monthly total cost per year (for chart)
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

  // YoY: annual cost by type for each year (for summary table)
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

  return (
    <div className="mt-7">
      <SectionHead num="08" title={`Cost Structure Analysis · FY ${year}`}>
        {view === 'mom'
          ? 'Monthly actual cost by category (PEX · OPEX · CAPEX) vs FC1 & FC2 targets. Sub-category breakdown below.'
          : 'Year-on-year cost evolution — monthly and annual comparison across financial years.'}
      </SectionHead>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        {/* Toggle */}
        <div className="flex items-center gap-2">
          {[
            { id: 'mom', label: 'Month-on-Month' },
            { id: 'yoy', label: 'Year-on-Year' },
          ].map((tab) => (
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
          {/* Chart header */}
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h4 className="m-0 font-display font-medium text-[18px] tracking-[-.2px]">
                {view === 'mom'
                  ? `Monthly Cost Breakdown · FY ${year}`
                  : `Cost Evolution · ${derived.years.map((y) => `FY ${y}`).join(' vs ')}`}
              </h4>
              <p className="m-0 text-[12px] text-[var(--muted)] mt-1">
                {view === 'mom'
                  ? 'Stacked bars = actual spend by type · Dashed lines = FC1 (amber) & FC2 (black) targets'
                  : 'Monthly total actual cost per financial year · grouped bars'}
              </p>
            </div>

            {/* Legend chips */}
            <div className="flex flex-wrap gap-2">
              {view === 'mom' ? (
                <>
                  {['PEX', 'OPEX', 'CAPEX'].map((t) => (
                    <span key={t} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${TYPE_BG[t]} ${TYPE_TEXT[t]}`}>
                      <span className="w-2 h-2 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
                      {t}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg)] text-brand-amber border border-[var(--line)]">
                    <span className="w-4 h-0.5 inline-block" style={{ borderTop: '2px dashed #D4A22F' }} />
                    FC1 Target
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg)] text-[var(--ink-soft)] border border-[var(--line)]">
                    <span className="w-4 h-0.5 bg-ink inline-block" style={{ borderTop: '2px dashed #0E1116' }} />
                    FC2 Target
                  </span>
                </>
              ) : (
                derived.years.map((y, i) => (
                  <span key={y} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-blue-soft text-brand-blue">
                    <span className="w-2 h-2 rounded-sm" style={{ background: i === 0 ? '#A9C3F5' : '#1F6FEB' }} />
                    FY {y}
                  </span>
                ))
              )}
            </div>
          </div>

          {view === 'mom'
            ? <MoMChart data={momData} />
            : <YoYChart data={yoyMonthlyData} years={derived.years} />}
        </div>

        {/* Detail table */}
        {view === 'mom'
          ? <SubCategoryTable data={subCatData} year={year} />
          : <YoYTypeTable data={yoyTypeData} years={derived.years} />}
      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}
