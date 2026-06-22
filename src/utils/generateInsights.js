/**
 * Generate factual insights from derived metrics.
 *
 * Output shape: { kind, severity, tag, title, reason, chips }
 * Keep it numeric, comparative, and free of fabricated causes.
 */
import { getActivePeriodMonths, derivePeriodKPIs } from './periodUtils'

export function generateInsights(derived, year, opts = {}) {
  const { fromMonth, toMonth } = opts
  const Y = derived.byYear?.[year]
  if (!Y) return []

  const out = []
  const { kpis, byDept = [], costByType = [], monthly } = Y

  if (!monthly || monthly.length === 0) return []

  // Compute current period KPIs and previous-period KPIs for comparisons
  const availMonths = monthly.map((m) => m.month)
  const activeMonths = getActivePeriodMonths(fromMonth, toMonth, availMonths)
  const pk = derivePeriodKPIs(monthly, activeMonths) || {}

  // Previous period = same range in the prior year
  const prevYear = year - 1
  const prevY = derived.byYear?.[prevYear]
  let prevPk = null
  if (prevY) {
    const prevAvail = prevY.monthly.map((m) => m.month)
    const prevActive = getActivePeriodMonths(fromMonth, toMonth, prevAvail)
    prevPk = derivePeriodKPIs(prevY.monthly, prevActive) || null
  }

  // Add a top-level period comparison card if we have previous period KPIs
  if (prevPk) {
    const revDelta = (pk.totalRevenue ?? 0) - (prevPk.totalRevenue ?? 0)
    const npDelta = (pk.netProfit ?? 0) - (prevPk.netProfit ?? 0)
    const revPct = prevPk.totalRevenue ? Math.round((revDelta / prevPk.totalRevenue) * 100 * 10) / 10 : null
    out.push({ kind: 'period-comparison', severity: revDelta >= 0 ? 'good' : 'warn', tag: 'Period · Comparison', title: `Revenue ₹${(pk.totalRevenue ?? 0).toFixed(1)} Cr · Δ ₹${revDelta.toFixed(1)} Cr ${revPct != null ? `(${revPct}%)` : ''}`, reason: '', chips: [ 'Period' ] })
  }

  // Simple monthly patterns (highest/lowest rev & cost, best margin)
  const highestRevMonth = [...monthly].sort((a, b) => b.revAct - a.revAct)[0]
  if (highestRevMonth) {
    out.push({ kind: 'highest-rev', severity: 'info', tag: 'Revenue Pattern', title: `Highest revenue: ${highestRevMonth.m} at ₹${highestRevMonth.revAct.toFixed(1)} Cr`, reason: `Peak month with highest revenue.`, chips: ['Highest', highestRevMonth.m] })
  }

  const lowestRevMonth = [...monthly].sort((a, b) => a.revAct - b.revAct)[0]
  if (lowestRevMonth) {
    out.push({ kind: 'lowest-rev', severity: 'info', tag: 'Revenue Pattern', title: `Lowest revenue: ${lowestRevMonth.m} at ₹${lowestRevMonth.revAct.toFixed(1)} Cr`, reason: `Lowest revenue month.`, chips: ['Lowest', lowestRevMonth.m] })
  }

  const highestCostMonth = [...monthly].sort((a, b) => b.costAct - a.costAct)[0]
  if (highestCostMonth) {
    out.push({ kind: 'highest-cost', severity: 'info', tag: 'Cost Pattern', title: `Highest cost: ${highestCostMonth.m} at ₹${highestCostMonth.costAct.toFixed(1)} Cr`, reason: `Peak cost month.`, chips: ['Highest', highestCostMonth.m] })
  }

  const lowestCostMonth = [...monthly].sort((a, b) => a.costAct - b.costAct)[0]
  if (lowestCostMonth) {
    out.push({ kind: 'lowest-cost', severity: 'info', tag: 'Cost Pattern', title: `Lowest cost: ${lowestCostMonth.m} at ₹${lowestCostMonth.costAct.toFixed(1)} Cr`, reason: `Lowest cost month.`, chips: ['Lowest', lowestCostMonth.m] })
  }

  const bestMarginMonth = [...monthly].sort((a, b) => b.npRatio - a.npRatio)[0]
  if (bestMarginMonth) {
    out.push({ kind: 'best-margin', severity: 'good', tag: 'Margin Pattern', title: `Best margin: ${bestMarginMonth.m} at ${bestMarginMonth.npRatio}%`, reason: `Most efficient month.`, chips: ['Best efficiency', bestMarginMonth.m] })
  }

  // Delta comparisons vs FC1/FC2 and plan shifts
  const pushDelta = ({ kind, severity, tag, title, amount, ref, chips }) => out.push({ kind, severity, tag, title, reason: `${amount} vs ${ref}.`, chips })

  if (kpis) {
    const revGapFc1 = (kpis.totalRevenue ?? 0) - (kpis.revFc1 ?? 0)
    if (Math.abs(revGapFc1) > 1) {
      pushDelta({ kind: 'rev-fc1', severity: revGapFc1 < 0 ? 'warn' : 'good', tag: 'Revenue · FC1 → Actual', title: revGapFc1 < 0 ? `Revenue trailed FC1 by ₹${Math.abs(revGapFc1).toFixed(1)} Cr` : `Revenue beat FC1 by ₹${revGapFc1.toFixed(1)} Cr`, amount: `Revenue ${revGapFc1 < 0 ? 'trailing' : 'above'} by ₹${Math.abs(revGapFc1).toFixed(1)} Cr`, ref: 'FC1', chips: ['Service Fees', revGapFc1 < 0 ? 'Below plan' : 'Above plan'] })
    }

    const costGapFc1 = (kpis.totalCost ?? 0) - (kpis.costFc1 ?? 0)
    if (Math.abs(costGapFc1) > 1) {
      pushDelta({ kind: 'cost-fc1', severity: costGapFc1 < 0 ? 'good' : 'warn', tag: 'Cost · FC1 → Actual', title: costGapFc1 < 0 ? `Cost ran ₹${Math.abs(costGapFc1).toFixed(1)} Cr below FC1` : `Cost overshot FC1 by ₹${costGapFc1.toFixed(1)} Cr`, amount: `Cost ${costGapFc1 < 0 ? 'below' : 'above'} by ₹${Math.abs(costGapFc1).toFixed(1)} Cr`, ref: 'FC1', chips: ['All cost lines', costGapFc1 < 0 ? 'Saving' : 'Overrun'] })
    }

    const planRev = (kpis.costFc2 ?? 0) - (kpis.costFc1 ?? 0)
    if (Math.abs(planRev) > 0.5) {
      pushDelta({ kind: 'plan-rev', severity: 'plan', tag: 'Plan · FC1 → FC2', title: planRev < 0 ? `Forecast revised down ₹${Math.abs(planRev).toFixed(1)} Cr in FC2` : `Forecast revised up ₹${planRev.toFixed(1)} Cr in FC2`, amount: `FC2 changed by ₹${Math.abs(planRev).toFixed(1)} Cr`, ref: 'FC1', chips: ['Re-baseline', 'Mid-year'] })
    }
  }

  const capex = costByType.find((c) => c.type === 'CAPEX')
  if (capex && (capex.fc1 ?? 0) - (capex.actual ?? 0) > 1) {
    const gap = (capex.fc1 ?? 0) - (capex.actual ?? 0)
    pushDelta({ kind: 'capex-defer', severity: 'info', tag: 'CAPEX · FC1 → Actual', title: `CAPEX below FC1 by ₹${gap.toFixed(1)} Cr`, amount: `CAPEX below by ₹${gap.toFixed(1)} Cr`, ref: 'FC1', chips: ['CAPEX'] })
  }

  if (byDept && byDept.length) {
    const worst = [...byDept].sort((a, b) => a.margin - b.margin)[0]
    out.push({ kind: 'dept-margin', severity: worst.margin < 8 ? 'warn' : 'info', tag: `Department · ${worst.department}`, title: `${worst.department} margin at ${worst.margin}%`, reason: `EBIT ₹${worst.ebit} Cr on revenue ₹${worst.revAct} Cr and cost ₹${worst.costAct} Cr.`, chips: [worst.department, `Margin ${worst.margin}%`] })
  }

  if (monthly.length >= 2) {
    let bestLift = { delta: -Infinity }
    for (let i = 1; i < monthly.length; i++) {
      const delta = monthly[i].npAct - monthly[i - 1].npAct
      if (delta > bestLift.delta) bestLift = { delta, m: monthly[i], prev: monthly[i - 1] }
    }
    if (bestLift.delta > 0.1) {
      out.push({ kind: 'mom-best', severity: 'good', tag: `MoM · ${bestLift.prev.m} → ${bestLift.m.m}`, title: `${bestLift.m.m} net profit climbed ₹${bestLift.delta.toFixed(2)} Cr MoM`, reason: `Net profit reached ₹${bestLift.m.npAct} Cr at ${bestLift.m.npRatio}% margin.`, chips: ['MoM', 'Strongest lift'] })
    }
  }

  return out
}
