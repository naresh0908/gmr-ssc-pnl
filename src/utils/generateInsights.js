/**
 * Generate insights from derived metrics.
 *
 * This is rule-based for now. To swap in an LLM later, replace the body
 * with a call to your LLM endpoint that takes `derived[year]` as input
 * and returns the same shape: { kind, severity, tag, title, reason, chips }
 *
 * Severity: 'warn' | 'good' | 'info' | 'plan'
 */
export function generateInsights(derived, year) {
  const Y = derived.byYear?.[year]
  if (!Y) return []

  const out = []
  const { kpis, byDept, costByType, monthly } = Y

  // 1. Revenue vs FC1
  const revGapFc1 = kpis.totalRevenue - kpis.revFc1
  if (Math.abs(revGapFc1) > 1) {
    out.push({
      kind: 'rev-fc1',
      severity: revGapFc1 < 0 ? 'warn' : 'good',
      tag: 'Revenue · FC1 → Actual',
      title: revGapFc1 < 0
        ? `Revenue trailed FC1 by ₹${Math.abs(revGapFc1).toFixed(1)} Cr`
        : `Revenue beat FC1 by ₹${revGapFc1.toFixed(1)} Cr`,
      reason: revGapFc1 < 0
        ? `Service-fee underrun across departments. Review onboarding pipeline and re-baseline FY${year + 1} commercial plan.`
        : `Service-fee outperformance. Lock in tailwind in FY${year + 1} baseline.`,
      chips: ['Service Fees', revGapFc1 < 0 ? 'Below plan' : 'Above plan']
    })
  }

  // 2. Cost vs FC1
  const costGapFc1 = kpis.totalCost - kpis.costFc1
  if (Math.abs(costGapFc1) > 1) {
    out.push({
      kind: 'cost-fc1',
      severity: costGapFc1 < 0 ? 'good' : 'warn',
      tag: 'Cost · FC1 → Actual',
      title: costGapFc1 < 0
        ? `Cost ran ₹${Math.abs(costGapFc1).toFixed(1)} Cr below FC1`
        : `Cost overshot FC1 by ₹${costGapFc1.toFixed(1)} Cr`,
      reason: costGapFc1 < 0
        ? `Largely from delayed hiring and CAPEX deferral. Some savings are timing - they may flow into FY${year + 1}.`
        : `Cost discipline weakened. Investigate top-3 deviating cost lines.`,
      chips: ['All cost lines', costGapFc1 < 0 ? 'Saving' : 'Overrun']
    })
  }

  // 3. Planning revision: FC1 -> FC2
  const planRev = kpis.costFc2 - kpis.costFc1
  if (Math.abs(planRev) > 0.5) {
    out.push({
      kind: 'plan-rev',
      severity: 'plan',
      tag: 'Plan · FC1 → FC2',
      title: planRev < 0
        ? `Forecast revised down ₹${Math.abs(planRev).toFixed(1)} Cr in FC2`
        : `Forecast revised up ₹${planRev.toFixed(1)} Cr in FC2`,
      reason: `Mid-year re-plan. Watch whether FY${year + 1} baseline absorbs this revision or treats it as one-off.`,
      chips: ['Re-baseline', 'Mid-year']
    })
  }

  // 4. CAPEX behavior
  const capex = costByType.find((c) => c.type === 'CAPEX')
  if (capex && capex.fc1 - capex.actual > 1) {
    out.push({
      kind: 'capex-defer',
      severity: 'info',
      tag: 'CAPEX · FC1 → Actual',
      title: `CAPEX deferred ₹${(capex.fc1 - capex.actual).toFixed(1)} Cr`,
      reason: `Laptop/equipment refresh slipped. Likely to land in FY${year + 1} Q1 - model the cash impact now.`,
      chips: ['CAPEX', `FY${year + 1} Q1 risk`]
    })
  }

  // 5. Top under-performing dept (lowest margin)
  if (byDept.length) {
    const worst = [...byDept].sort((a, b) => a.margin - b.margin)[0]
    out.push({
      kind: 'dept-margin',
      severity: worst.margin < 8 ? 'warn' : 'info',
      tag: `Department · ${worst.department}`,
      title: `${worst.department} margin at ${worst.margin}%`,
      reason: `EBIT ₹${worst.ebit} Cr on revenue ₹${worst.revAct} Cr. ${
        worst.execChange > 0
          ? `Cost overshot FC2 by ₹${worst.execChange.toFixed(1)} Cr.`
          : `Cost ran ₹${Math.abs(worst.execChange).toFixed(1)} Cr below FC2 - savings may not be structural.`
      }`,
      chips: [worst.department, `Margin ${worst.margin}%`]
    })
  }

  // 6. Best month MoM lift
  if (monthly.length >= 2) {
    let bestLift = { delta: -Infinity }
    for (let i = 1; i < monthly.length; i++) {
      const delta = monthly[i].npAct - monthly[i - 1].npAct
      if (delta > bestLift.delta) bestLift = { delta, m: monthly[i], prev: monthly[i - 1] }
    }
    if (bestLift.delta > 0.1) {
      out.push({
        kind: 'mom-best',
        severity: 'good',
        tag: `MoM · ${bestLift.prev.m} → ${bestLift.m.m}`,
        title: `${bestLift.m.m} net profit climbed ₹${bestLift.delta.toFixed(2)} Cr MoM`,
        reason: `Net profit reached ₹${bestLift.m.npAct} Cr (margin ${bestLift.m.npRatio}%). Strongest sequential lift of the year.`,
        chips: ['MoM', 'Strongest lift']
      })
    }
  }

  return out
}
