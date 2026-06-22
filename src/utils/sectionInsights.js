// Descriptive insight engine.
//
// Every card answers the same simple question for the user:
//   "How does this number compare to the forecast (FC2) or to the prior period?"
//
// No diagnosis, no recommendations, no "drill into X" prompts. Just:
//   tag    - short label so the user knows what metric / period it covers
//   title  - the headline number framed against its benchmark
//   reason - supporting numbers (actual, forecast, delta, %, prior period) so the
//            user can verify the headline without any extra clicks
//
// Severity is purely a visual cue: good = better than benchmark,
// warn = meaningfully worse, info = on plan / within tolerance.

const r1  = (n) => Math.round(n * 10) / 10
const r2  = (n) => Math.round(n * 100) / 100
const abs = Math.abs
const CR  = 1e7

const fmtCr = (n) => `₹${r2(n).toFixed(2)} Cr`
const fmtCr1 = (n) => `₹${r1(n).toFixed(1)} Cr`
const signedCr = (n) => `${n >= 0 ? '+' : '-'}${fmtCr(abs(n))}`
const signedPct = (n) => `${n >= 0 ? '+' : ''}${r1(n).toFixed(1)}%`

const shortDept = (name) => {
  if (!name) return ''
  const par = name.match(/\(([^)]+)\)/)?.[1]
  if (par) return par
  const parts = name.split(' ').filter(Boolean)
  const ampIdx = parts.indexOf('&')
  if (ampIdx > 0) return parts.slice(0, ampIdx).join(' ')
  return parts.slice(0, 2).join(' ')
}

const cleanDept = (name) => (name ? name.split('(')[0].trim() : '')

// Compare value vs benchmark and pick a severity for a positive-good metric
// (revenue, EBIT, margin, net profit). For cost-type metrics use sevCost().
function sevPositive(delta, threshold = 0.5) {
  if (delta > threshold) return 'good'
  if (delta < -threshold) return 'warn'
  return 'info'
}
function sevCost(delta, threshold = 0.5) {
  // for cost-type metrics, over-spending (positive delta) is bad
  if (delta > threshold) return 'warn'
  if (delta < -threshold) return 'good'
  return 'info'
}

function pctOf(part, whole) {
  if (!whole || abs(whole) < 1e-9) return 0
  return r1((part / whole) * 100)
}

function biggestMonthlyOverrun(rawCost, year, costType, months) {
  if (!rawCost) return null
  const byMonth = {}
  for (const c of rawCost) {
    if (c.year !== year) continue
    if (costType && c.costType !== costType) continue
    if (months && !months.includes(c.month)) continue
    const m = c.month
    if (!byMonth[m]) byMonth[m] = { actual: 0, fc2: 0 }
    byMonth[m].actual += c.actual
    byMonth[m].fc2    += c.fc2
  }
  let worst = null, worstDiff = 0
  for (const [m, v] of Object.entries(byMonth)) {
    if (v.actual === 0) continue
    const diff = v.actual - v.fc2
    if (diff > worstDiff) {
      worstDiff = diff
      worst = { month: m, actual: v.actual / CR, fc2: v.fc2 / CR, diff: diff / CR }
    }
  }
  return worst
}

// ─── Public entry point ───────────────────────────────────────────────────────
import { getActivePeriodMonths, derivePeriodKPIs, derivePeriodCostByType, derivePeriodByDept, getPeriodLabel } from './periodUtils'

export function getSectionInsights(section, { derived, serviceRevenue, year, rawRevenue, rawCost, fromMonth, toMonth }) {
  const Y = derived?.byYear?.[year]
  if (!Y) return []

  const availMonths  = Y.monthly.map((m) => m.month)
  const activeMonths = getActivePeriodMonths(fromMonth, toMonth, availMonths)
  const pk = derivePeriodKPIs(Y.monthly, activeMonths) ?? Y.kpis

  // Prior period = same fromMonth..toMonth applied to prior year.
  const prevYear = year - 1
  const prevY    = derived.byYear?.[prevYear]
  let prevPk = null
  if (prevY) {
    const prevAvail  = prevY.monthly.map((m) => m.month)
    const prevMonths = getActivePeriodMonths(fromMonth, toMonth, prevAvail)
    prevPk = derivePeriodKPIs(prevY.monthly, prevMonths) || null
  }

  const periodCostByType = rawCost && activeMonths.length
    ? derivePeriodCostByType(rawCost, year, activeMonths)
    : (Y.costByType || [])
  const periodByDept = (rawRevenue && rawCost && derived?.departments && activeMonths.length)
    ? derivePeriodByDept(rawRevenue, rawCost, derived.departments, year, activeMonths)
    : (Y.byDept || [])

  const periodLabel = getPeriodLabel(fromMonth, toMonth, year)
  const prevLabel   = getPeriodLabel(fromMonth, toMonth, prevYear)

  const ctx = {
    fromMonth, toMonth,
    activeMonths, periodLabel, prevLabel,
    pk, prevPk, prevYear,
    periodCostByType, periodByDept,
  }

  switch (section) {
    case 'pl':              return plInsights(Y, year, ctx)
    case 'monthly':         return monthlyInsights(Y, year, ctx)
    case 'service-revenue': return serviceRevenueInsights(serviceRevenue?.[year], year, ctx)
    case 'ebit-dept':       return ebitDeptInsights(Y, year, ctx)
    case 'cost-prof':       return costProfInsights(Y, year, ctx)
    case 'waterfall':       return waterfallInsights(Y, year, rawCost, ctx)
    case 'ebit-customer':   return ebitCustomerInsights(Y, year, ctx)
    case 'cost-analysis':   return costAnalysisInsights(Y, year, rawCost, ctx)
    default: return []
  }
}

// ─── 01 · P&L Statement ───────────────────────────────────────────────────────
function plInsights(Y, year, ctx) {
  const { pk, prevPk, periodLabel, prevLabel } = ctx
  const out = []

  // 1. Net result vs forecast
  const np      = pk.netProfit ?? 0
  const npFc2   = pk.netProfitFc2 ?? 0
  const npDelta = r2(np - npFc2)
  const npPct   = pctOf(npDelta, abs(npFc2) || 1)
  const margin  = pk.totalRevenue > 0 ? r1((pk.ebit ?? 0) / pk.totalRevenue * 100) : 0
  out.push({
    severity: sevPositive(npDelta, 0.5),
    tag: `Net Result · ${periodLabel}`,
    title: `${fmtCr(np)} net profit · ${signedCr(npDelta)} vs FC2 forecast (${signedPct(npPct)})`,
    reason: `Actual ${fmtCr(np)} · Forecast (FC2) ${fmtCr(npFc2)} · EBIT margin ${margin}%${prevPk ? ` · ${prevLabel}: ${fmtCr(prevPk.netProfit ?? 0)}` : ''}`,
  })

  // 2. Revenue vs forecast
  const rev      = pk.totalRevenue ?? 0
  const revFc2   = pk.revFc2 ?? 0
  const revDelta = r2(rev - revFc2)
  const revPct   = pctOf(revDelta, revFc2)
  out.push({
    severity: sevPositive(revDelta, 0.5),
    tag: `Revenue · ${periodLabel}`,
    title: `${fmtCr(rev)} revenue · ${signedCr(revDelta)} vs FC2 forecast (${signedPct(revPct)})`,
    reason: `Actual ${fmtCr(rev)} · Forecast (FC2) ${fmtCr(revFc2)}${prevPk ? ` · ${prevLabel}: ${fmtCr(prevPk.totalRevenue ?? 0)}` : ''}`,
  })

  // 3. Total cost vs forecast
  const cost      = pk.totalCost ?? 0
  const costFc2   = pk.costFc2 ?? 0
  const costDelta = r2(cost - costFc2)
  const costPct   = pctOf(costDelta, costFc2)
  out.push({
    severity: sevCost(costDelta, 0.5),
    tag: `Total Cost · ${periodLabel}`,
    title: `${fmtCr(cost)} total cost · ${signedCr(costDelta)} vs FC2 forecast (${signedPct(costPct)})`,
    reason: `Actual ${fmtCr(cost)} · Forecast (FC2) ${fmtCr(costFc2)}${prevPk ? ` · ${prevLabel}: ${fmtCr(prevPk.totalCost ?? 0)}` : ''}`,
  })

  return out
}

// ─── 02 · Monthly Performance ─────────────────────────────────────────────────
function monthlyInsights(Y, year, ctx) {
  const { activeMonths } = ctx
  const monthly = Y.monthly.filter((m) => activeMonths.includes(m.month) && m.revAct > 0)
  if (!monthly.length) return []
  const out = []

  // 1. Strongest month
  const best = [...monthly].sort((a, b) => b.npAct - a.npAct)[0]
  const bestDelta = r2(best.npAct - best.npFc2)
  const bestTitle = best.npAct < 0
    ? `${best.month}: ${fmtCr(abs(best.npAct))} net loss` 
    : `${best.month}: ${fmtCr(best.npAct)} net profit at ${r1(best.npRatio)}% margin`
  const bestNetNote = (best.npAct < 0 && best.npFc2 < 0 && bestDelta > 0)
  ? `${signedCr(bestDelta)} vs FC2 forecast (smaller loss)`
  : ` ${signedCr(bestDelta)} vs FC2 forecast`
  out.push({
    severity: 'good',
    tag: `Strongest Month · ${best.month}`,
    title: bestTitle,
    reason: `Revenue ${fmtCr(best.revAct)} (FC2 ${fmtCr(best.revFc2)}) · Cost ${fmtCr(best.costAct)} (FC2 ${fmtCr(best.costFc2)}) · Net${bestNetNote}`,
  })

  // 2. Softest month
  const worst = [...monthly].sort((a, b) => a.npAct - b.npAct)[0]
  const worstDelta = r2(worst.npAct - worst.npFc2)
  out.push({
    severity: worst.npAct < 0 ? 'warn' : 'info',
    tag: `Softest Month · ${worst.month}`,
    title: worst.npAct < 0
      ? `${worst.month}: ${fmtCr(abs(worst.npAct))} net loss`
      : `${worst.month}: ${fmtCr(worst.npAct)} net profit at ${r1(worst.npRatio)}% margin`,
    reason: `Revenue ${fmtCr(worst.revAct)} (FC2 ${fmtCr(worst.revFc2)}) · Cost ${fmtCr(worst.costAct)} (FC2 ${fmtCr(worst.costFc2)}) · Net ${signedCr(worstDelta)} vs FC2 forecast${(worst.npAct < 0 && worst.npFc2 < 0 && worstDelta > 0) ? ' (smaller loss)' : ''}`,
  })

  // 3. Average performance / YoY trend
  if (monthly.length >= 2) {
    const avgNp     = r2(monthly.reduce((s, m) => s + m.npAct, 0) / monthly.length)
    const avgNpFc2  = r2(monthly.reduce((s, m) => s + m.npFc2, 0) / monthly.length)
    const avgDelta  = r2(avgNp - avgNpFc2)
    const monthsAboveFc2 = monthly.filter((m) => m.npAct >= m.npFc2).length
    const monthsPhrase = (avgNp < 0 && avgNpFc2 < 0)
      ? `${monthsAboveFc2} of ${monthly.length} months had smaller losses than FC2`
      : `${monthsAboveFc2} of ${monthly.length} months met or beat FC2`
    out.push({
      severity: sevPositive(avgDelta, 0.2),
      tag: `Average Month · ${monthly.length} months`,
      title: `Average ${fmtCr(avgNp)} net per month · ${signedCr(avgDelta)} vs FC2 forecast`,
      reason: `${monthsPhrase} · Forecast average ${fmtCr(avgNpFc2)}/month`,
    })
  }

  return out
}

// ─── 03 · Service Revenue ─────────────────────────────────────────────────────
function serviceRevenueInsights(SRY, year, ctx) {
  if (!SRY || !SRY.byDept?.length) return []
  const { byDept, totalFte, totalTxn, total, monthly } = SRY
  const out = []

  // 1. Total + leading department
  const topDept = byDept[0]
  const topPct  = pctOf(topDept.total, total)
  out.push({
    severity: 'info',
    tag: `Total Service Revenue · ${year}`,
    title: `${fmtCr(total)} total · ${cleanDept(topDept.dept)} contributes ${topPct}%`,
    reason: `Top department ${cleanDept(topDept.dept)}: ${fmtCr(topDept.total)} · ${byDept.length} departments in the portfolio`,
  })

  // 2. FTE vs Transaction mix
  const ftePct = pctOf(totalFte, total)
  const txnPct = r1(100 - ftePct)
  out.push({
    severity: 'info',
    tag: `Revenue Mix · FTE / Transaction`,
    title: `${ftePct}% FTE-based · ${txnPct}% transaction-based`,
    reason: `FTE revenue ${fmtCr(totalFte)} · Transaction revenue ${fmtCr(totalTxn)} · FTE billing is headcount-linked; transaction billing is volume-linked`,
  })

  // 3. H1 vs H2 momentum
  if (monthly?.length >= 4) {
    const mid = Math.floor(monthly.length / 2)
    const h1  = r2(monthly.slice(0, mid).reduce((s, m) => s + m.total, 0))
    const h2  = r2(monthly.slice(mid).reduce((s, m) => s + m.total, 0))
    const growth = pctOf(h2 - h1, h1)
    const h1Months = monthly.slice(0, mid)
    const h2Months = monthly.slice(mid)
    const h1Range  = `${h1Months[0].month}-${h1Months[h1Months.length - 1].month}`
    const h2Range  = `${h2Months[0].month}-${h2Months[h2Months.length - 1].month}`
    out.push({
      severity: sevPositive(growth, 3),
      tag: `Momentum · H1 vs H2`,
      title: `H2 is ${signedPct(growth)} compared with H1`,
      reason: `H1 (${h1Range}): ${fmtCr(h1)} · H2 (${h2Range}): ${fmtCr(h2)} · H2 average ${fmtCr(h2 / h2Months.length)}/month`,
    })
  }

  return out
}

// ─── 04 · EBIT Matrix · Department ────────────────────────────────────────────
function ebitDeptInsights(Y, year, ctx) {
  const { ebitMatrix } = Y
  const byDept = ctx.periodByDept || Y.byDept || []
  if (!ebitMatrix?.length) return []
  const out = []

  const totalEBIT = ebitMatrix.reduce((s, d) => s + d.total, 0)

  // 1. Top EBIT contributor
  const top = ebitMatrix[0]
  if (top) {
    const topPct = pctOf(abs(top.total), abs(totalEBIT) || 1)
    const topData = byDept.find((d) => d.department === top.department)
    const topMargin = topData?.margin ?? 0
    out.push({
      severity: 'good',
      tag: `Top EBIT · ${shortDept(top.department)}`,
      title: `${cleanDept(top.department)}: ${fmtCr(top.total)} EBIT (${topPct}% of total) at ${r1(topMargin)}% margin`,
      reason: `Highest EBIT contributor across ${ebitMatrix.length} departments · Total portfolio EBIT ${fmtCr(totalEBIT)}`,
    })
  }

  // 2. Lowest margin department
  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD  = sorted[0]
    const worstD = sorted[sorted.length - 1]
    const gap    = r1(bestD.margin - worstD.margin)
    out.push({
      severity: worstD.margin < 0 ? 'warn' : worstD.margin < 5 ? 'info' : 'info',
      tag: `Margin Range · ${gap} ppt spread`,
      title: `${cleanDept(bestD.department)} at ${r1(bestD.margin)}% margin · ${cleanDept(worstD.department)} at ${r1(worstD.margin)}%`,
      reason: `Highest margin ${cleanDept(bestD.department)}: EBIT ${fmtCr(bestD.ebit)} on revenue ${fmtCr(bestD.revAct)} · Lowest ${cleanDept(worstD.department)}: EBIT ${fmtCr(worstD.ebit)} on revenue ${fmtCr(worstD.revAct)}`,
    })
  }

  // 3. Loss-cell summary (descriptive only)
  const allCells = ebitMatrix.flatMap((d) => d.cells.map((c) => ({ ...c, dept: d.department })))
  const lossCells = allCells.filter((c) => c.ebit < 0)
  if (lossCells.length > 0) {
    const worst = [...lossCells].sort((a, b) => a.ebit - b.ebit)[0]
    const lossDeptCount = new Set(lossCells.map((c) => c.dept)).size
    out.push({
      severity: 'warn',
      tag: `Loss Cells · ${lossCells.length} month-department combos`,
      title: `${lossCells.length} loss-making month-department cell${lossCells.length > 1 ? 's' : ''} across ${lossDeptCount} department${lossDeptCount > 1 ? 's' : ''}`,
      reason: `Deepest single loss: ${cleanDept(worst.dept)} in ${worst.month} at ${fmtCr(abs(worst.ebit))}`,
    })
  } else {
    out.push({
      severity: 'good',
      tag: `Loss Cells · None`,
      title: `Every department was EBIT-positive in every month`,
      reason: `${ebitMatrix.length} departments × ${ebitMatrix[0]?.cells?.length || 0} months · no loss-making cells in ${year}`,
    })
  }

  return out
}

// ─── 05 · Cost & Profitability ────────────────────────────────────────────────
function costProfInsights(Y, year, ctx) {
  const costByType = ctx.periodCostByType || Y.costByType || []
  const byDept     = ctx.periodByDept     || Y.byDept     || []
  const { periodLabel } = ctx
  const out = []

  const total = costByType.reduce((s, c) => s + c.actual, 0)
  const pex   = costByType.find((c) => c.type === 'PEX')
  const opex  = costByType.find((c) => c.type === 'OPEX')
  const capex = costByType.find((c) => c.type === 'CAPEX')

  if (pex && total > 0) {
    const pexPct   = pctOf(pex.actual, total)
    const pexDelta = r2(pex.actual - pex.fc2)
    out.push({
      severity: sevCost(pexDelta, 1.5),
      tag: `Personnel Cost · ${pexPct}% of total`,
      title: `PEX ${fmtCr(pex.actual)} · ${signedCr(pexDelta)} vs FC2 forecast`,
      reason: `Actual ${fmtCr(pex.actual)} · Forecast (FC2) ${fmtCr(pex.fc2)} · ${pexPct}% of total cost in ${periodLabel}`,
    })
  }

  if (opex && total > 0) {
    const opexPct   = pctOf(opex.actual, total)
    const opexDelta = r2(opex.actual - opex.fc2)
    out.push({
      severity: sevCost(opexDelta, 1),
      tag: `Operating Cost · ${opexPct}% of total`,
      title: `OPEX ${fmtCr(opex.actual)} · ${signedCr(opexDelta)} vs FC2 forecast`,
      reason: `Actual ${fmtCr(opex.actual)} · Forecast (FC2) ${fmtCr(opex.fc2)} · ${opexPct}% of total cost in ${periodLabel}`,
    })
  }

  if (capex) {
    const capexDelta = r2(capex.actual - capex.fc2)
    out.push({
      severity: sevCost(capexDelta, 0.5),
      tag: `Capital Cost`,
      title: `CAPEX ${fmtCr(capex.actual)} · ${signedCr(capexDelta)} vs FC2 forecast`,
      reason: `Actual ${fmtCr(capex.actual)} · Forecast (FC2) ${fmtCr(capex.fc2)}${capexDelta < -0.5 ? ' · spend below forecast' : capexDelta > 0.5 ? ' · spend above forecast' : ' · in line with forecast'}`,
    })
  }

  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD  = sorted[0]
    const worstD = sorted[sorted.length - 1]
    out.push({
      severity: worstD.margin < 0 ? 'warn' : 'info',
      tag: `Department Margins · spread`,
      title: `${cleanDept(bestD.department)} at ${r1(bestD.margin)}% · ${cleanDept(worstD.department)} at ${r1(worstD.margin)}%`,
      reason: `Highest margin ${cleanDept(bestD.department)}: EBIT ${fmtCr(bestD.ebit)} · Lowest ${cleanDept(worstD.department)}: EBIT ${fmtCr(worstD.ebit)}`,
    })
  }

  return out
}

// ─── 06 · Driver Waterfall ────────────────────────────────────────────────────
function waterfallInsights(Y, year, rawCost, ctx) {
  const costByType = ctx.periodCostByType || Y.costByType || []
  const { pk, periodLabel, activeMonths } = ctx
  const out = []

  const costActual = pk.totalCost ?? 0
  const costFc2    = pk.costFc2 ?? 0
  const costDelta  = r2(costActual - costFc2)
  const costPct    = pctOf(costDelta, costFc2)
  const overrun    = biggestMonthlyOverrun(rawCost, year, null, activeMonths)

  out.push({
    severity: sevCost(costDelta, 2),
    tag: `Total Cost · ${periodLabel}`,
    title: `${fmtCr(costActual)} total cost · ${signedCr(costDelta)} vs FC2 forecast (${signedPct(costPct)})`,
    reason: `Actual ${fmtCr(costActual)} · Forecast (FC2) ${fmtCr(costFc2)}${overrun ? ` · Highest single-month gap: ${overrun.month} at ${fmtCr(overrun.actual)} (forecast ${fmtCr(overrun.fc2)})` : ''}`,
  })

  const sorted = [...costByType].sort((a, b) => (b.actual - b.fc2) - (a.actual - a.fc2))
  const topOver = sorted[0]
  const topSave = sorted[sorted.length - 1]

  if (topOver && topOver.actual - topOver.fc2 > 0.3) {
    const diff = r2(topOver.actual - topOver.fc2)
    const share = costDelta > 0 ? pctOf(diff, costDelta) : null
    out.push({
      severity: 'warn',
      tag: `Largest Overrun · ${topOver.type}`,
      title: `${topOver.type} ran ${signedCr(diff)} above forecast${share != null ? ` · ${share}% of the total cost gap` : ''}`,
      reason: `Actual ${fmtCr(topOver.actual)} · Forecast (FC2) ${fmtCr(topOver.fc2)}`,
    })
  }

  if (topSave && topSave.actual - topSave.fc2 < -0.3) {
    const save = r2(topSave.fc2 - topSave.actual)
    out.push({
      severity: 'good',
      tag: `Largest Saving · ${topSave.type}`,
      title: `${topSave.type} was ${fmtCr(save)} below FC2 forecast`,
      reason: `Actual ${fmtCr(topSave.actual)} · Forecast (FC2) ${fmtCr(topSave.fc2)}`,
    })
  }

  return out
}

// ─── 07 · EBIT Matrix · Customer ──────────────────────────────────────────────
function ebitCustomerInsights(Y, year, ctx) {
  const { ebitCustomerMatrix } = Y
  if (!ebitCustomerMatrix?.length) return []
  const out = []

  const totalEBIT = ebitCustomerMatrix.reduce((s, d) => s + d.total, 0)

  // 1. Top customer
  const top = ebitCustomerMatrix[0]
  if (top) {
    const topPct = pctOf(abs(top.total), abs(totalEBIT) || 1)
    out.push({
      severity: 'info',
      tag: `Top Customer · ${top.department}`,
      title: `${top.department}: ${fmtCr(top.total)} EBIT (${topPct}% of customer EBIT)`,
      reason: `${ebitCustomerMatrix.length} customers in the portfolio · Total customer EBIT ${fmtCr(totalEBIT)}`,
    })
  }

  // 2. Loss-making customers
  const lossCust = ebitCustomerMatrix.filter((d) => d.total < 0)
  if (lossCust.length > 0) {
    const drain = r2(lossCust.reduce((s, d) => s + d.total, 0))
    out.push({
      severity: 'warn',
      tag: `Loss-Making Customers · ${lossCust.length}`,
      title: `${lossCust.length} customer${lossCust.length > 1 ? 's' : ''} ended with negative EBIT · combined ${fmtCr(abs(drain))}`,
      reason: `Accounts: ${lossCust.map((d) => d.department).join(', ')}`,
    })
  } else {
    out.push({
      severity: 'good',
      tag: `Loss-Making Customers · None`,
      title: `All ${ebitCustomerMatrix.length} customers ended with positive EBIT`,
      reason: `Smallest contributor: ${ebitCustomerMatrix[ebitCustomerMatrix.length - 1].department} at ${fmtCr(ebitCustomerMatrix[ebitCustomerMatrix.length - 1].total)}`,
    })
  }

  // 3. Margin spread
  if (ebitCustomerMatrix.length >= 3) {
    const withRev = ebitCustomerMatrix
      .filter((d) => d.cells.some((c) => c.revenue > 0))
      .map((d) => {
        const rev = d.cells.reduce((s, c) => s + c.revenue, 0)
        return { name: d.department, ebit: d.total, rev, margin: rev > 0 ? r1((d.total / rev) * 100) : 0 }
      })
      .sort((a, b) => b.margin - a.margin)
    if (withRev.length >= 2) {
      const best  = withRev[0]
      const worst = withRev[withRev.length - 1]
      const gap   = r1(best.margin - worst.margin)
      if (gap > 5) {
        out.push({
          severity: 'info',
          tag: `Customer Margin Range · ${gap} ppt spread`,
          title: `${best.name} at ${r1(best.margin)}% margin · ${worst.name} at ${r1(worst.margin)}%`,
          reason: `Highest ${best.name}: EBIT ${fmtCr(best.ebit)} on revenue ${fmtCr(best.rev)} · Lowest ${worst.name}: EBIT ${fmtCr(worst.ebit)} on revenue ${fmtCr(worst.rev)}`,
        })
      }
    }
  }

  return out
}

// ─── 08 · Cost Analysis ───────────────────────────────────────────────────────
function costAnalysisInsights(Y, year, rawCost, ctx) {
  const { activeMonths, periodLabel, pk } = ctx
  const costByType = ctx.periodCostByType || Y.costByType || []
  const monthly    = Y.monthly.filter((m) => activeMonths.includes(m.month) && m.costAct > 0)
  const out = []

  if (!monthly.length) return []

  // 1. Peak cost month
  const peak       = monthly.reduce((p, m) => m.costAct > p.costAct ? m : p, monthly[0])
  const peakDelta  = r2(peak.costAct - peak.costFc2)
  const peakPct    = pctOf(peakDelta, peak.costFc2)
  out.push({
  severity: sevCost(peakDelta, 0.5),
  tag: `Peak Cost Month · ${peak.month}`,
  title: `${peak.month}: ${fmtCr(peak.costAct)} · ${signedCr(peakDelta)} vs FC2 forecast (${signedPct(peakPct)})`,
    reason: `Highest single-month cost in ${periodLabel} · Actual ${fmtCr(peak.costAct)} · Forecast (FC2) ${fmtCr(peak.costFc2)}`,
  })

  // 2. H1 vs H2 trajectory (only if enough data)
  if (monthly.length >= 6) {
    const mid   = Math.floor(monthly.length / 2)
    const h1Sum = monthly.slice(0, mid).reduce((s, m) => s + m.costAct, 0)
    const h2Sum = monthly.slice(mid).reduce((s, m) => s + m.costAct, 0)
    const h1Avg = r2(h1Sum / mid)
    const h2Avg = r2(h2Sum / (monthly.length - mid))
    const trend = pctOf(h2Avg - h1Avg, h1Avg)
    const h1Months = monthly.slice(0, mid)
    const h2Months = monthly.slice(mid)
    const h1Range  = `${h1Months[0].month}-${h1Months[h1Months.length - 1].month}`
    const h2Range  = `${h2Months[0].month}-${h2Months[h2Months.length - 1].month}`
    out.push({
      severity: sevCost(h2Avg - h1Avg, 0.3),
      tag: `H1 vs H2 · Cost Trend`,
      title: `Cost ${trend >= 0 ? 'rose' : 'fell'} ${signedPct(trend)} from H1 to H2`,
      reason: `H1 (${h1Range}) average ${fmtCr(h1Avg)}/month · H2 (${h2Range}) average ${fmtCr(h2Avg)}/month`,
    })
  }

  // 3. OPEX vs forecast for the period
  const opex = costByType.find((c) => c.type === 'OPEX')
  if (opex) {
    const opexDelta = r2(opex.actual - opex.fc2)
    const opexPct   = pctOf(opexDelta, opex.fc2)
    const activeCount = activeMonths?.length || monthly.length
    const isPartial   = activeCount < 12
    const runRate     = activeCount > 0 ? r2(opex.actual * (12 / activeCount)) : null
    out.push({
      severity: sevCost(opexDelta, 0.5),
      tag: `OPEX · ${periodLabel}`,
      title: `OPEX ${fmtCr(opex.actual)} · ${signedCr(opexDelta)} vs forecast (${signedPct(opexPct)})`,
      reason: isPartial && runRate != null
        ? `Actual ${fmtCr(opex.actual)} across ${activeCount} month${activeCount > 1 ? 's' : ''} · Forecast (FC2) ${fmtCr(opex.fc2)} · Full-year run-rate (×12/${activeCount}) ${fmtCr(runRate)}`
        : `Actual ${fmtCr(opex.actual)} · Forecast (FC2) ${fmtCr(opex.fc2)}`,
    })
  }

  return out
}
