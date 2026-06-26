import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { getAvailMonths, getActivePeriodMonths } from '../utils/periodUtils'

const CR = 1e7

const TITLE_COLOR = '#0F2747'
const GRID        = '#E5EBF3'
const AXIS_TXT    = '#3B4252'

const RANK_COLORS = ['#0F2747', '#1F6FEB', '#2CA15D', '#E1B027', '#C0392B']

// SAP status palette (matches the reference image)
const STATUS_ORDER  = ['Closed', 'Completed', 'Released', 'Started']
const STATUS_COLORS = {
  Closed:    '#7E8794',
  Completed: '#8B5CF6',
  Released:  '#2CA15D',
  Started:   '#1F6FEB',
}

const fmtAxis = (v) => {
  const n = Number(v) || 0
  if (n === 0) return '₹0'
  const abs = Math.abs(n)
  if (abs >= 100) return `${n < 0 ? '-' : ''}₹${abs.toFixed(0)}Cr`
  if (abs >= 10)  return `${n < 0 ? '-' : ''}₹${abs.toFixed(1)}Cr`
  return `${n < 0 ? '-' : ''}₹${abs.toFixed(2)}Cr`
}
const fmtRupee = (v) => v == null ? '–' : `₹${(+v).toFixed(2)} Cr`

export default function ProjectStatusChart() {
  const { derived, year, rawRevenue, fromMonth, toMonth } = useDashStore()
  const Y = derived.byYear?.[year]
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )

  const customers = useMemo(
    () => [...new Set(rawRevenue.map((r) => r.customer).filter(Boolean))],
    [rawRevenue]
  )

  // ── Top customers by revenue per month (rank series) ────────────────
  const topCustomers = useMemo(() => {
    return activeMonths.map((m) => {
      const ranked = customers.map((c) => {
        const filtered = rawRevenue.filter((r) => r.year === year && r.month === m && r.customer === c)
        const total = filtered.reduce((s, r) => s + (r.actServiceFees || 0) + (r.actOtherIncome || 0), 0)
        return { name: c, value: +(total / CR).toFixed(2) }
      }).sort((a, b) => b.value - a.value)

      const out = { month: m, label: `${m} ${year}` }
      ranked.forEach((r, idx) => { out[`rank${idx + 1}`] = r })
      return out
    })
  }, [activeMonths, customers, rawRevenue, year])

  // ── Project Status — cumulative project count by status per month ──
  const statusData = useMemo(() => {
    // Each (customer × department) for a given year is treated as a project
    // and assigned the customer's projectStatus for that year. We accumulate
    // monthly counts so the area grows over time, matching the reference.
    const cumulative = { Closed: 0, Completed: 0, Released: 0, Started: 0 }
    return activeMonths.map((m) => {
      const rows = rawRevenue.filter((r) => r.year === year && r.month === m)
      const projectsThisMonth = new Set()
      const statusCounts = { Closed: 0, Completed: 0, Released: 0, Started: 0 }
      for (const r of rows) {
        const projectKey = `${r.customer}|${r.department}`
        if (projectsThisMonth.has(projectKey)) continue
        projectsThisMonth.add(projectKey)
        if (statusCounts[r.projectStatus] !== undefined) statusCounts[r.projectStatus]++
      }
      for (const s of STATUS_ORDER) cumulative[s] += statusCounts[s]
      return {
        month: m,
        label: `${m} ${year}`,
        ...cumulative,
      }
    })
  }, [activeMonths, rawRevenue, year])

  const N = Math.min(5, customers.length || 5)
  const tickInterval = activeMonths.length > 6 ? 1 : 0

  return (
    <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
      {/* Top 5 Customers by Revenue */}
      <Card className="md:col-span-6">
        <Header
          title={`Top ${N} Customers by Revenue`}
          subtitle={`Each month's own top ${N} customers · per-month revenue · hover for the customer name`}
        />
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={topCustomers} margin={{ top: 12, right: 24, left: 8, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_TXT, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} interval={tickInterval} />
            <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={62} />
            <Tooltip content={<CustomerTooltip />} />
            {Array.from({ length: N }).map((_, idx) => (
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
        <p className="text-[10.5px] md:text-[11.5px] text-[var(--muted)] mt-3 leading-relaxed">
          For each month, the {N} customers with the highest revenue in that month. Lines are ranks
          (#1 = highest); the customer at each rank can change month to month — hover to see it.
        </p>
      </Card>

      {/* Project Status — stacked area */}
      <Card className="md:col-span-6">
        <Header
          title="Project Status"
          subtitle="Project count by SAP status, per snapshot"
        />
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={statusData} margin={{ top: 12, right: 18, left: 0, bottom: 10 }}>
            <defs>
              {STATUS_ORDER.map((s) => (
                <linearGradient key={s} id={`statusFill-${s}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={STATUS_COLORS[s]} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={STATUS_COLORS[s]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS_TXT, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} interval={tickInterval} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              labelStyle={{ color: TITLE_COLOR, fontWeight: 600 }}
              contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(15,39,71,0.08)' }}
              formatter={(v, k) => [v, k]}
            />
            {STATUS_ORDER.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                name={s}
                stroke={STATUS_COLORS[s]}
                strokeWidth={3}
                fill={`url(#statusFill-${s})`}
                dot={{ r: 5, fill: STATUS_COLORS[s], strokeWidth: 0 }}
                activeDot={{ r: 7 }}
              />
            ))}
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: 12.5, paddingTop: 12, color: AXIS_TXT, fontWeight: 600 }}
              payload={STATUS_ORDER.map((s) => ({ value: s, type: 'circle', color: STATUS_COLORS[s] }))}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div
      className={`relative rounded-[18px] border border-[var(--line)] p-4 md:p-5 shadow-[0_1px_2px_rgba(15,39,71,0.04)] flex flex-col ${className}`}
      style={{ background: 'var(--card)' }}
    >
      {children}
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h3 className="font-display font-bold text-[16px] md:text-[18px] tracking-tight" style={{ color: TITLE_COLOR }}>
        {title}
      </h3>
      {subtitle && <p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
    </div>
  )
}

function CustomerTooltip({ active, payload, label }) {
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
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i === 0 ? 0 : 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 9, background: e.color, display: 'inline-block', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0F2747', fontSize: 13, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.name ?? '–'}
            </div>
          </div>
          <div style={{ fontWeight: 700, color: '#1F8A4C', fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmtRupee(e.value)}
          </div>
        </div>
      ))}
    </div>
  )
}
