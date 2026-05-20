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
  const { monthly } = Y

  if (!monthly || monthly.length === 0) return []

  // Pattern 1: Highest Revenue Month
  const highestRevMonth = [...monthly].sort((a, b) => b.revAct - a.revAct)[0]
  if (highestRevMonth) {
    out.push({
      kind: 'highest-rev',
      severity: 'info',
      tag: 'Revenue Pattern',
      title: `Highest revenue: ${highestRevMonth.m} at ₹${highestRevMonth.revAct.toFixed(1)} Cr`,
      reason: `Peak month with highest service line contribution.`,
      chips: ['Highest', highestRevMonth.m]
    })
  }

  // Pattern 2: Lowest Revenue Month
  const lowestRevMonth = [...monthly].sort((a, b) => a.revAct - b.revAct)[0]
  if (lowestRevMonth) {
    out.push({
      kind: 'lowest-rev',
      severity: 'info',
      tag: 'Revenue Pattern',
      title: `Lowest revenue: ${lowestRevMonth.m} at ₹${lowestRevMonth.revAct.toFixed(1)} Cr`,
      reason: `Trough month - seasonal or execution dip.`,
      chips: ['Lowest', lowestRevMonth.m]
    })
  }

  // Pattern 3: Highest Cost Month
  const highestCostMonth = [...monthly].sort((a, b) => b.costAct - a.costAct)[0]
  if (highestCostMonth) {
    out.push({
      kind: 'highest-cost',
      severity: 'info',
      tag: 'Cost Pattern',
      title: `Highest cost: ${highestCostMonth.m} at ₹${highestCostMonth.costAct.toFixed(1)} Cr`,
      reason: `Peak cost month - likely capex or hiring spike.`,
      chips: ['Highest', highestCostMonth.m]
    })
  }

  // Pattern 4: Lowest Cost Month
  const lowestCostMonth = [...monthly].sort((a, b) => a.costAct - b.costAct)[0]
  if (lowestCostMonth) {
    out.push({
      kind: 'lowest-cost',
      severity: 'info',
      tag: 'Cost Pattern',
      title: `Lowest cost: ${lowestCostMonth.m} at ₹${lowestCostMonth.costAct.toFixed(1)} Cr`,
      reason: `Trough cost month - seasonal low or timing benefit.`,
      chips: ['Lowest', lowestCostMonth.m]
    })
  }

  // Pattern 5: Revenue vs Cost Gap (Margin)
  const bestMarginMonth = [...monthly].sort((a, b) => b.npRatio - a.npRatio)[0]
  if (bestMarginMonth) {
    out.push({
      kind: 'best-margin',
      severity: 'good',
      tag: 'Margin Pattern',
      title: `Best margin: ${bestMarginMonth.m} at ${bestMarginMonth.npRatio}%`,
      reason: `Most efficient month - revenue peak with controlled costs.`,
      chips: ['Best efficiency', bestMarginMonth.m]
    })
  }

  return out
}
