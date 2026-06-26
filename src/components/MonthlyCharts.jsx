import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'
import {
  ComposedChart, Bar, Line, Area, AreaChart, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { getAvailMonths, getActivePeriodMonths } from '../utils/periodUtils'
import KpiDrillModal from './KpiDrillModal'

const CR = 1e7

const fmtMonth = (m, year) => `${m} ${year}`
const fmtRupee = (v) => v == null ? '–' : `₹${(+v).toFixed(2)} Cr`
const fmtAxis = (v) => {
  const n = Number(v) || 0
  if (n === 0) return '₹0'
  const abs = Math.abs(n)
  if (abs >= 100) return `${n < 0 ? '-' : ''}₹${(abs).toFixed(0)}Cr`
  if (abs >= 10)  return `${n < 0 ? '-' : ''}₹${(abs).toFixed(1)}Cr`
  return `${n < 0 ? '-' : ''}₹${abs.toFixed(2)}Cr`
}

const COLORS = {
  cost:    '#C0392B',
  rev:     '#1F6FEB',
  margin:  '#E1B027',
  ranks:   ['#0F2747', '#1F6FEB', '#2CA15D', '#E1B027', '#C0392B'],
  title:   '#0F2747',
  axisTxt: '#3B4252',
  grid:    '#E5EBF3',
  zero:    '#94A3B8',
}

export default function MonthlyCharts() {
  const { derived, year, rawRevenue, rawCost, fromMonth, toMonth } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )

  const monthlyData = useMemo(() => {
    return activeMonths.map((m) => {
      const row = Y.monthly.find((x) => x.month === m)
      const revenue = row?.revAct ?? 0
      const cost    = row?.costAct ?? 0
      const margin  = revenue - cost
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
      return {
        month: m,
        label: fmtMonth(m, year),
        revenue: +revenue.toFixed(2),
        cost:    +cost.toFixed(2),
        margin:  +margin.toFixed(2),
        marginPct: +marginPct.toFixed(1),
      }
    })
  }, [activeMonths, Y, year])

  const projects = useMemo(() => {
    const set = new Set()
    for (const r of rawRevenue) {
      if (r.customer && r.department) set.add(`${r.customer}||${r.department}`)
    }
    for (const c of rawCost) {
      if (c.customer && c.department) set.add(`${c.customer}||${c.department}`)
    }
    return [...set].map((k) => {
      const [customer, department] = k.split('||')
      return { customer, department }
    })
  }, [rawRevenue, rawCost])
  const topCostRanks = useMemo(
    () => buildRankSeries(activeMonths, projects, rawCost, year, 'actual'),
    [activeMonths, projects, rawCost, year]
  )
  const topRevRanks = useMemo(
    () => buildRankSeries(activeMonths, projects, rawRevenue, year, '__rev'),
    [activeMonths, projects, rawRevenue, year]
  )

  const customerCount = useMemo(() => new Set(rawRevenue.map((r) => r.customer).filter(Boolean)).size, [rawRevenue])
  const N = Math.min(5, customerCount || 5)
  const monthCountLabel = `${activeMonths.length} month${activeMonths.length === 1 ? '' : 's'} in ${year}`

  // Avoid x-axis label overlap on narrower cards (e.g. Margin %, rank cards)
  // when many months are visible. Skip every other tick once we exceed 6.
  const tickInterval = activeMonths.length > 6 ? 1 : 0

  const [drill, setDrill] = useState(null)

  return (
    <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
      {/* Revenue · Cost · Margin */}
      <Card className="md:col-span-8" title="Revenue · Cost · Margin" subtitle="Per-month — Cost as bars, Revenue & Margin as lines" footer={`X-axis = month · per-month activity · ${monthCountLabel}`}>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={monthlyData} margin={{ top: 16, right: 28, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
            <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={68} />
            <Tooltip
              formatter={(v, k) => [fmtRupee(v), k === 'cost' ? 'Cost' : k === 'revenue' ? 'Revenue' : 'Margin']}
              labelStyle={{ color: COLORS.title, fontWeight: 600 }}
              contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(15,39,71,0.08)' }}
              cursor={{ fill: 'rgba(31,111,235,0.04)' }}
            />
            <ReferenceLine y={0} stroke={COLORS.zero} strokeWidth={1} />
            <Bar dataKey="cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} barSize={36} />
            <Line type="monotone" dataKey="revenue" stroke={COLORS.rev}    strokeWidth={3} dot={{ r: 5, fill: COLORS.rev,    strokeWidth: 0 }} activeDot={{ r: 7 }} />
            <Line type="monotone" dataKey="margin"  stroke={COLORS.margin} strokeWidth={3} dot={{ r: 5, fill: COLORS.margin, strokeWidth: 0 }} activeDot={{ r: 7 }} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: 12.5, paddingTop: 12, color: COLORS.axisTxt, fontWeight: 600 }}
              payload={[
                { value: 'Cost',    type: 'circle', color: COLORS.cost },
                { value: 'Revenue', type: 'circle', color: COLORS.rev },
                { value: 'Margin',  type: 'circle', color: COLORS.margin },
              ]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Margin % */}
      <Card className="md:col-span-4" title="Margin %" subtitle="Per-month margin % (margin ÷ revenue for each month)">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={monthlyData} margin={{ top: 16, right: 18, left: 0, bottom: 28 }}>
            <defs>
              <linearGradient id="marginPctFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLORS.margin} stopOpacity={0.45} />
                <stop offset="100%" stopColor={COLORS.margin} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} interval={tickInterval} />
            <YAxis tickFormatter={(v) => `${(+v).toFixed(0)}%`} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip
              formatter={(v) => [`${(+v).toFixed(1)}%`, 'Margin %']}
              labelStyle={{ color: COLORS.title, fontWeight: 600 }}
              contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(15,39,71,0.08)' }}
            />
            <ReferenceLine y={0} stroke={COLORS.zero} strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="marginPct"
              stroke={COLORS.margin}
              strokeWidth={3}
              fill="url(#marginPctFill)"
              dot={{ r: 5, fill: COLORS.margin, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Top N Highest Cost Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} Highest Cost Projects`}
        subtitle={`Each month's top ${N} projects by actual cost · hover a point for the customer · department behind that rank`}
        data={topCostRanks}
        rankCount={N}
        valueLabel="Cost"
        explainer={[
          { label: 'What this chart shows:', body: 'This chart shows the projects with the highest cost each month.' },
          { label: 'How it is calculated:',  body: `Projects are ranked based on total actual cost (₹) within each month, and the top ${N} are selected.` },
          { label: 'Why it matters:',        body: 'This helps spot where the biggest spend is happening month to month.' },
        ]}
        footnote={`Lines are ranks (#1 = highest cost). The project at each rank can change month to month — hover a point to see it.`}
        tickInterval={tickInterval}
        onOpenData={() => setDrill({ key: 'cost', label: `Top ${N} Highest Cost Projects` })}
      />

      {/* Top N Highest Revenue Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} Highest Revenue Projects`}
        subtitle={`Each month's top ${N} projects by operating revenue · hover a point for the customer · department behind that rank`}
        data={topRevRanks}
        rankCount={N}
        valueLabel="Revenue"
        explainer={[
          { label: 'What this chart shows:', body: 'This chart shows the projects with the highest revenue each month.' },
          { label: 'How it is calculated:',  body: `Projects are ranked based on total revenue (₹) within each month, and the top ${N} are selected.` },
          { label: 'Why it matters:',        body: 'This helps identify the strongest revenue drivers in the portfolio.' },
        ]}
        footnote={`Lines are ranks (#1 = highest revenue). The project at each rank can change month to month — hover a point to see it.`}
        tickInterval={tickInterval}
        onOpenData={() => setDrill({ key: 'revenue', label: `Top ${N} Highest Revenue Projects` })}
      />
      {drill && <KpiDrillModal metric={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

function Card({ title, subtitle, footer, children, className = '' }) {
  return (
    <div
      className={`relative rounded-[18px] border border-[var(--line)] p-4 md:p-5 shadow-[0_1px_2px_rgba(15,39,71,0.04)] ${className}`}
      style={{ background: 'var(--card)' }}
    >
      <div className="mb-3">
        <h3 className="font-display font-bold text-[16px] md:text-[18px] tracking-tight" style={{ color: COLORS.title }}>
          {title}
        </h3>
        {subtitle && <p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
      {footer && <p className="text-[10.5px] md:text-[11px] text-[var(--muted)] mt-2.5">{footer}</p>}
    </div>
  )
}

function RankCard({ title, subtitle, data, rankCount, valueLabel, explainer = [], footnote, className = '', onOpenData, tickInterval = 0 }) {
  return (
    <motion.div
      whileHover={onOpenData ? { y: -3, transition: { duration: 0.18 } } : undefined}
      className={`relative rounded-[18px] border border-[var(--line)] p-4 md:p-5 shadow-[0_1px_2px_rgba(15,39,71,0.04)] flex flex-col transition-[box-shadow,border-color] ${onOpenData ? 'hover:shadow-[0_10px_28px_rgba(15,39,71,0.10)] hover:border-[var(--ink)]/15' : ''} ${className}`}
      style={{ background: 'var(--card)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-[16px] md:text-[18px] tracking-tight" style={{ color: COLORS.title }}>
            {title}
          </h3>
          {subtitle && <p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
        </div>
        {onOpenData && (
          <button
            type="button"
            onClick={onOpenData}
            className="shrink-0 inline-flex items-center gap-1.5 text-[10.5px] md:text-[11.5px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] px-2.5 py-1.5 rounded-full border border-[var(--line)] hover:border-[var(--ink)]/30 hover:bg-[var(--bg)] transition"
            aria-label="View data"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            View data
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} interval={tickInterval} />
          <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<RankTooltip valueLabel={valueLabel} />} />
          {Array.from({ length: rankCount }).map((_, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`rank${idx + 1}.value`}
              name={`Rank #${idx + 1}`}
              stroke={COLORS.ranks[idx % COLORS.ranks.length]}
              strokeWidth={2.4}
              dot={{ r: 4, fill: COLORS.ranks[idx % COLORS.ranks.length], strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-white/60 p-3 text-[11px] md:text-[12px] leading-relaxed text-[var(--ink-soft)]">
        {explainer.map((row, i) => (
          <div key={i} className={i === 0 ? '' : 'mt-1'}>
            <span className="font-semibold" style={{ color: COLORS.title }}>{row.label}</span> {row.body}
          </div>
        ))}
      </div>
      {footnote && <p className="text-[10.5px] md:text-[11px] text-[var(--muted)] mt-2.5">{footnote}</p>}
    </motion.div>
  )
}

function RankTooltip({ active, payload, label, valueLabel }) {
  if (!active || !payload || !payload.length) return null
  const entries = payload
    .map((p, i) => ({ ...(p.payload?.[`rank${i + 1}`] || {}), color: p.color, rank: i + 1 }))
    .filter((e) => e && e.value != null)
  if (!entries.length) return null
  const valueColor = valueLabel === 'Cost' ? '#C0392B' : '#1F8A4C'
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: i === 0 ? 0 : 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, background: e.color, display: 'inline-block', flexShrink: 0, marginTop: 5 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0F2747', fontSize: 13, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.primary ?? e.name ?? '–'}
            </div>
            {e.secondary && (
              <div style={{ color: '#94A3B8', fontSize: 11.5, lineHeight: 1.35, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.secondary}
              </div>
            )}
          </div>
          <div style={{ fontWeight: 700, color: valueColor, fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmtRupee(e.value)}
          </div>
        </div>
      ))}
    </div>
  )
}

function buildRankSeries(months, projects, rows, year, field) {
  return months.map((m) => {
    const ranked = projects.map((p) => {
      const filtered = rows.filter(
        (r) => r.year === year && r.month === m && r.customer === p.customer && r.department === p.department
      )
      let total = 0
      if (field === '__rev') {
        total = filtered.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0)
      } else {
        total = filtered.reduce((s, r) => s + (r[field] || 0), 0)
      }
      return {
        name: p.customer,
        primary: p.customer,
        secondary: p.department,
        value: +(total / CR).toFixed(2),
      }
    }).sort((a, b) => b.value - a.value)

    const out = { month: m, label: `${m} ${year}` }
    ranked.forEach((r, idx) => { out[`rank${idx + 1}`] = r })
    return out
  })
}
