import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getAvailMonths, getActivePeriodMonths } from '../utils/periodUtils'

const CR = 1e7

const TITLE_COLOR = '#0F2747'
const GRID        = '#E5EBF3'
const AXIS_TXT    = '#3B4252'
const ZERO        = '#94A3B8'

const RANK_COLORS = ['#0F2747', '#1F6FEB', '#2CA15D', '#E1B027', '#C0392B']

const fmtAxis = (v) => {
  const n = Number(v) || 0
  if (n === 0) return '₹0'
  const abs = Math.abs(n)
  if (abs >= 100) return `${n < 0 ? '-' : ''}₹${abs.toFixed(0)}Cr`
  if (abs >= 10)  return `${n < 0 ? '-' : ''}₹${abs.toFixed(1)}Cr`
  return `${n < 0 ? '-' : ''}₹${abs.toFixed(2)}Cr`
}
const fmtRupee = (v) => v == null ? '–' : `₹${(+v).toFixed(2)} Cr`

export default function MarginRankCharts() {
  const { derived, year, rawRevenue, rawCost, fromMonth, toMonth } = useDashStore()
  if (!derived.byYear?.[year]) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )

  // Project = (customer × department) — yields ~30 projects with our data,
  // so Top 5 / Bottom 5 produce meaningful, non-redundant rankings.
  const projects = useMemo(() => {
    const set = new Set()
    for (const r of rawRevenue) {
      if (r.customer && r.department) set.add(`${r.customer}||${r.department}`)
    }
    return [...set].map((k) => {
      const [customer, department] = k.split('||')
      return { key: k, customer, department, name: `${customer} · ${department}` }
    })
  }, [rawRevenue])

  // Compute per-month margin per project
  const marginByMonth = useMemo(() => {
    return activeMonths.map((m) => {
      const ranked = projects.map((p) => {
        const rev = rawRevenue
          .filter((r) => r.year === year && r.month === m && r.customer === p.customer && r.department === p.department)
          .reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0)
        const cost = rawCost
          .filter((c) => c.year === year && c.month === m && c.customer === p.customer && c.department === p.department)
          .reduce((s, c) => s + (c.actual || 0), 0)
        return {
          name: p.name,
          primary: p.customer,
          secondary: p.department,
          value: +((rev - cost) / CR).toFixed(2),
        }
      })
      return {
        month: m,
        label: `${m} ${year}`,
        all: ranked,
      }
    })
  }, [activeMonths, projects, rawRevenue, rawCost, year])

  const N = 5
  const tickInterval = activeMonths.length > 6 ? 1 : 0

  const topData = useMemo(() => marginByMonth.map((row) => ({
    ...packRanks([...row.all].sort((a, b) => b.value - a.value).slice(0, N)),
    month: row.month, label: row.label,
  })), [marginByMonth])

  const bottomData = useMemo(() => marginByMonth.map((row) => ({
    ...packRanks([...row.all].sort((a, b) => a.value - b.value).slice(0, N)),
    month: row.month, label: row.label,
  })), [marginByMonth])

  return (
    <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
      {/* Top 5 Highest Margin Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} Highest Margin Projects`}
        subtitle={`Each month's top ${N} projects by margin · hover a point for the customer · department behind that rank`}
        data={topData}
        rankCount={N}
        explainer={[
          { label: 'What this chart shows:', body: 'This chart shows the projects with the highest profit contribution over time.' },
          { label: 'How it is calculated:',  body: `Projects are ranked based on total margin (₹) within each month, and the top ${N} are selected.` },
          { label: 'Why it matters:',        body: 'This helps highlight the projects contributing most to profitability.' },
        ]}
        footnote={`Lines are ranks (#1 = highest margin). The project at each rank can change month to month — hover a point to see it.`}
        rankLabel="highest"
        tickInterval={tickInterval}
      />

      {/* Top 5 Lowest Margin Projects */}
      <RankCard
        className="md:col-span-6"
        title={`Top ${N} Lowest Margin Projects`}
        subtitle={`Each month's bottom ${N} projects by margin · hover a point for the customer · department behind that rank`}
        data={bottomData}
        rankCount={N}
        explainer={[
          { label: 'What this chart shows:', body: 'This chart shows the projects with the lowest profit contribution over time.' },
          { label: 'How it is calculated:',  body: `Projects are ranked based on total margin (₹) within each month, and the bottom ${N} are selected.` },
          { label: 'Why it matters:',        body: 'This helps identify projects that may be underperforming or causing margin risk.' },
        ]}
        footnote={`Lines are ranks (#1 = lowest margin). The project at each rank can change month to month — hover a point to see it.`}
        rankLabel="lowest"
        tickInterval={tickInterval}
      />
    </div>
  )
}

function packRanks(items) {
  const out = {}
  items.forEach((r, idx) => { out[`rank${idx + 1}`] = r })
  return out
}

function RankCard({ title, subtitle, data, rankCount, explainer, footnote, className = '', rankLabel, tickInterval = 0 }) {
  return (
    <div
      className={`relative rounded-[18px] border border-[var(--line)] p-4 md:p-5 shadow-[0_1px_2px_rgba(15,39,71,0.04)] flex flex-col ${className}`}
      style={{ background: 'var(--card)' }}
    >
      <div className="mb-3">
        <h3 className="font-display font-bold text-[16px] md:text-[18px] tracking-tight" style={{ color: TITLE_COLOR }}>
          {title}
        </h3>
        {subtitle && <p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: AXIS_TXT, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} interval={tickInterval} />
          <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={62} />
          <ReferenceLine y={0} stroke={ZERO} strokeWidth={1} />
          <Tooltip content={<MarginTooltip rankLabel={rankLabel} />} />
          {Array.from({ length: rankCount }).map((_, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`rank${idx + 1}.value`}
              name={`Rank #${idx + 1}`}
              stroke={RANK_COLORS[idx % RANK_COLORS.length]}
              strokeWidth={2.4}
              dot={{ r: 4, fill: RANK_COLORS[idx % RANK_COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-white/60 p-3 text-[11px] md:text-[12px] leading-relaxed text-[var(--ink-soft)]">
        {explainer.map((row, i) => (
          <div key={i} className={i === 0 ? '' : 'mt-1'}>
            <span className="font-semibold" style={{ color: TITLE_COLOR }}>{row.label}</span> {row.body}
          </div>
        ))}
      </div>
      {footnote && <p className="text-[10.5px] md:text-[11px] text-[var(--muted)] mt-2.5">{footnote}</p>}
    </div>
  )
}

function MarginTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const entries = payload
    .map((p, i) => ({ ...(p.payload?.[`rank${i + 1}`] || {}), color: p.color, rank: i + 1 }))
    .filter((e) => e && e.value != null)
  if (!entries.length) return null
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
        minWidth: 300,
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
          <div style={{ fontWeight: 700, color: e.value < 0 ? '#C0392B' : '#1F8A4C', fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmtRupee(e.value)}
          </div>
        </div>
      ))}
    </div>
  )
}
