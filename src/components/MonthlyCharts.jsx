import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import {
  ComposedChart, Bar, Line, Area, AreaChart, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { getAvailMonths, getActivePeriodMonths } from '../utils/periodUtils'

const CR = 1e7
const MONTH_DAYS = { Jan: 31, Feb: 28, Mar: 31, Apr: 30, May: 31, Jun: 30, Jul: 31, Aug: 31, Sep: 30, Oct: 31, Nov: 30, Dec: 31 }

const fmtMonth = (m, year) => `${MONTH_DAYS[m]} ${m} ${year}`
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

  const customers = useMemo(() => [...new Set(rawRevenue.map((r) => r.customer).filter(Boolean))], [rawRevenue])
  const topCostRanks = useMemo(
    () => buildRankSeries(activeMonths, customers, rawCost, year, 'actual'),
    [activeMonths, customers, rawCost, year]
  )
  const topRevRanks = useMemo(
    () => buildRankSeries(activeMonths, customers, rawRevenue, year, '__rev'),
    [activeMonths, customers, rawRevenue, year]
  )

  const N = Math.min(5, customers.length || 5)
  const monthCountLabel = `${activeMonths.length} month${activeMonths.length === 1 ? '' : 's'} in ${year}`

  return (
    <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
      {/* Revenue · Cost · Margin */}
      <Card className="md:col-span-8" title="Revenue · Cost · Margin" subtitle="Per-month — Cost as bars, Revenue & Margin as lines" footer={`X-axis = month · per-month activity · ${monthCountLabel}`}>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={monthlyData} margin={{ top: 16, right: 28, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} />
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
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} />
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

      {/* Top N High-Cost Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} High-Cost Projects`}
        subtitle={`Each month's own top ${N} highest-cost projects · per-month cost · hover for project ID · name`}
        data={topCostRanks}
        rankCount={N}
        valueLabel="Cost"
        whatHTML={<>For each month, the {N} projects with the highest cost incurred <em>in that month</em>. Hover names the project at each rank.</>}
        howHTML={<>Per-month cost = cumulative cost this month − last month; projects are ranked within each month and the top {N} shown.</>}
        footnote={`For each month, the ${N} projects with the highest cost in that month. Lines are ranks (#1 = highest); the project at each rank can change month to month — hover to see it.`}
      />

      {/* Top N High Revenue Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} High Revenue Projects`}
        subtitle={`Each month's own top ${N} highest-revenue projects · per-month revenue · hover for project ID · name`}
        data={topRevRanks}
        rankCount={N}
        valueLabel="Revenue"
        whatHTML={<>For each month, the {N} projects with the highest revenue <em>in that month</em>. Hover names the project at each rank.</>}
        howHTML={<>Per-month revenue = cumulative revenue this month − last month; projects are ranked within each month and the top {N} shown.</>}
        footnote={`For each month, the ${N} projects with the highest revenue in that month. Lines are ranks (#1 = highest); the project at each rank can change month to month — hover to see it.`}
      />
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

function RankCard({ title, subtitle, data, rankCount, valueLabel, whatHTML, howHTML, footnote, className = '' }) {
  return (
    <div
      className={`relative rounded-[18px] border border-[var(--line)] p-4 md:p-5 shadow-[0_1px_2px_rgba(15,39,71,0.04)] flex flex-col ${className}`}
      style={{ background: 'var(--card)' }}
    >
      <div className="mb-3">
        <h3 className="font-display font-bold text-[16px] md:text-[18px] tracking-tight" style={{ color: COLORS.title }}>
          {title}
        </h3>
        {subtitle && <p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: COLORS.axisTxt, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} />
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
        <div><span className="font-semibold" style={{ color: COLORS.title }}>What this chart shows:</span> {whatHTML}</div>
        <div className="mt-1"><span className="font-semibold" style={{ color: COLORS.title }}>How it is calculated:</span> {howHTML}</div>
      </div>
      {footnote && <p className="text-[10.5px] md:text-[11px] text-[var(--muted)] mt-2.5">{footnote}</p>}
    </div>
  )
}

function RankTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,39,71,0.08)' }}>
      <div style={{ fontWeight: 700, color: COLORS.title, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => {
        const rankKey = `rank${i + 1}`
        const name = p.payload?.[rankKey]?.name
        const value = p.payload?.[rankKey]?.value
        if (value == null) return null
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3B4252', marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: p.color, display: 'inline-block' }} />
            <span style={{ minWidth: 24, fontWeight: 600 }}>#{i + 1}</span>
            <span style={{ flex: 1 }}>{name ?? '–'}</span>
            <span style={{ fontWeight: 600 }}>{fmtRupee(value)}</span>
          </div>
        )
      })}
    </div>
  )
}

function buildRankSeries(months, customers, rows, year, field) {
  return months.map((m) => {
    const ranked = customers.map((c) => {
      const filtered = rows.filter((r) => r.year === year && r.month === m && r.customer === c)
      let total = 0
      if (field === '__rev') {
        total = filtered.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0)
      } else {
        total = filtered.reduce((s, r) => s + (r[field] || 0), 0)
      }
      return { name: c, value: +(total / CR).toFixed(2) }
    }).sort((a, b) => b.value - a.value)

    const out = { month: m, label: `${MONTH_DAYS[m]} ${m} ${year}` }
    ranked.forEach((r, idx) => { out[`rank${idx + 1}`] = r })
    return out
  })
}
