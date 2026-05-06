import { motion } from 'framer-motion'
import { useDashStore } from '../store/useDashStore'

export default function KPISection() {
  const { derived, year } = useDashStore()
  const Y = derived.byYear[year]
  if (!Y) return null
  const k = Y.kpis
  const prevYear = derived.years[derived.years.indexOf(year) - 1]
  const prevK = prevYear ? derived.byYear[prevYear].kpis : null

  const cards = [
    {
      label: 'Total Revenue', value: k.totalRevenue, unit: 'Cr',
      delta: prevK ? `▲ ₹${(k.totalRevenue - prevK.totalRevenue).toFixed(1)} Cr vs FY${prevYear}` : '—',
      sub: `FC2 target: ₹${k.revFc2} Cr`,
      up: prevK ? k.totalRevenue >= prevK.totalRevenue : true
    },
    {
      label: 'Total Cost', value: k.totalCost, unit: 'Cr',
      delta: prevK ? `${k.totalCost > prevK.totalCost ? '▲' : '▼'} ₹${Math.abs(k.totalCost - prevK.totalCost).toFixed(1)} Cr vs FY${prevYear}` : '—',
      sub: `FC2 target: ₹${k.costFc2} Cr · saved ₹${(k.costFc2 - k.totalCost).toFixed(1)} Cr`,
      up: prevK ? k.totalCost > prevK.totalCost : false
    },
    {
      label: 'Net Profit', value: k.netProfit, unit: 'Cr',
      delta: prevK ? `${k.netProfit >= prevK.netProfit ? '▲' : '▼'} ₹${Math.abs(k.netProfit - prevK.netProfit).toFixed(1)} Cr vs FY${prevYear}` : '—',
      sub: `FC1 plan: ₹${(k.revFc1 - k.costFc1).toFixed(1)} Cr`,
      up: prevK ? k.netProfit >= prevK.netProfit : true
    },
    {
      label: 'Profit Margin', value: k.margin, unit: '%',
      delta: prevK ? `${k.margin >= prevK.margin ? '▲' : '▼'} ${Math.abs(k.margin - prevK.margin).toFixed(1)} pts vs FY${prevYear}` : '—',
      sub: 'Cost vs revenue trajectory',
      up: prevK ? k.margin >= prevK.margin : true
    },
    {
      label: 'YoY Growth',
      value: k.yoyGrowth ?? null,
      unit: '%',
      delta: k.yoyGrowth == null ? '— Base year' : k.yoyGrowth >= 0 ? '▲ healthy' : '▼ contraction',
      sub: prevYear ? `vs FY${prevYear} actual ₹${prevK?.totalRevenue} Cr` : 'No prior-year data',
      up: k.yoyGrowth == null ? null : k.yoyGrowth >= 0
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 * i }}
          className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4 px-5"
        >
          <div className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] font-semibold">{c.label}</div>
          <div className="font-display font-medium text-[30px] tracking-[-.5px] mt-2">
            {c.value != null ? c.value.toFixed(1) : '—'}
            <span className="font-mono text-[13px] text-[var(--muted)] font-medium ml-1">{c.value != null ? c.unit : ''}</span>
          </div>
          <div className={`text-[12px] mt-1.5 font-mono font-medium ${c.up == null ? 'text-[var(--muted)]' : c.up ? 'text-brand-green' : 'text-brand-red'}`}>
            {c.delta}
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-1">{c.sub}</div>
        </motion.div>
      ))}
    </div>
  )
}
