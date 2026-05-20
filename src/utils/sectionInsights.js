// Data-first insight engine - every card answers two things:
//   1. SIGNAL   - what happened, quantified (₹ Cr + %)
//   2. CONTEXT   - the measured period / department / cost line
//
// Keep the output factual. Do not invent causes, actors, or stories.

const r1  = (n) => Math.round(n * 10) / 10
const r2  = (n) => Math.round(n * 100) / 100
const CR  = 1e7
const abs = Math.abs
const shortDept = (name) => name.match(/\(([^)]+)\)/)?.[1] ?? name.split(' ').slice(0, 2).join(' ')

const CAUSAL_NOTES = {}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function biggestMonthlyOverrun(rawCost, year, costType) {
  if (!rawCost) return null
  const byMonth = {}
  for (const c of rawCost) {
    if (c.year !== year || (costType && c.costType !== costType)) continue
    const m = c.month
    if (!byMonth[m]) byMonth[m] = { actual: 0, fc2: 0 }
    byMonth[m].actual += c.actual
    byMonth[m].fc2    += c.fc2
  }
  let worst = null, worstDiff = 0
  for (const [m, v] of Object.entries(byMonth)) {
    if (v.actual === 0) continue
    const diff = v.actual - v.fc2
    if (diff > worstDiff) { worstDiff = diff; worst = { month: m, actual: v.actual / CR, fc2: v.fc2 / CR, diff: diff / CR } }
  }
  return worst
}

function biggestMonthlyRevMiss(rawRevenue, year) {
  if (!rawRevenue) return null
  const byMonth = {}
  for (const r of rawRevenue) {
    if (r.year !== year) continue
    const m = r.month
    if (!byMonth[m]) byMonth[m] = { act: 0, fc2: 0 }
    byMonth[m].act += r.actServiceFees + r.actOtherIncome
    byMonth[m].fc2 += r.fc2ServiceFees + r.fc2OtherIncome
  }
  let worst = null, worstDiff = 0
  for (const [m, v] of Object.entries(byMonth)) {
    if (v.act === 0) continue
    const diff = v.fc2 - v.act
    if (diff > worstDiff) { worstDiff = diff; worst = { month: m, act: v.act / CR, fc2: v.fc2 / CR, diff: diff / CR } }
  }
  return worst
}

function biggestMonthlyRevBeat(rawRevenue, year) {
  if (!rawRevenue) return null
  const byMonth = {}
  for (const r of rawRevenue) {
    if (r.year !== year) continue
    const m = r.month
    if (!byMonth[m]) byMonth[m] = { act: 0, fc2: 0 }
    byMonth[m].act += r.actServiceFees + r.actOtherIncome
    byMonth[m].fc2 += r.fc2ServiceFees + r.fc2OtherIncome
  }
  let best = null, bestDiff = 0
  for (const [m, v] of Object.entries(byMonth)) {
    if (v.act === 0) continue
    const diff = v.act - v.fc2
    if (diff > bestDiff) { bestDiff = diff; best = { month: m, act: v.act / CR, fc2: v.fc2 / CR, diff: diff / CR } }
  }
  return best
}

function deptHitInMonth(rawRevenue, year, month) {
  if (!rawRevenue) return null
  const byDept = {}
  for (const r of rawRevenue) {
    if (r.year !== year || r.month !== month) continue
    const d = r.department
    if (!byDept[d]) byDept[d] = { act: 0, fc2: 0 }
    byDept[d].act += r.actServiceFees + r.actOtherIncome
    byDept[d].fc2 += r.fc2ServiceFees + r.fc2OtherIncome
  }
  let worst = null, worstPct = 0
  for (const [d, v] of Object.entries(byDept)) {
    if (v.fc2 === 0) continue
    const pct = (v.act / v.fc2 - 1) * 100
    if (pct < worstPct) { worstPct = pct; worst = { dept: d, pct: r1(pct), miss: r2((v.fc2 - v.act) / CR) } }
  }
  return worst
}

// ─── Public entry point ───────────────────────────────────────────────────────
import { getActivePeriodMonths, derivePeriodKPIs, QUARTERS, derivePeriodCostByType, derivePeriodByDept } from './periodUtils'

export function getSectionInsights(section, { derived, serviceRevenue, year, rawRevenue, rawCost, periodMode = 'year', selectedQ = 'Q1', selectedPeriodMonth = 'Jan' }) {
  const Y = derived?.byYear?.[year]
  if (!Y) return []

  // Determine active months for the selected period and the previous period
  const availMonths = Y.monthly.map((m) => m.month)
  const activeMonths = getActivePeriodMonths(periodMode, selectedQ, selectedPeriodMonth, availMonths)
  const pk = derivePeriodKPIs(Y.monthly, activeMonths) ?? Y.kpis

  // previous period
  function getPrevInfo() {
    if (periodMode === 'year') return { yearOffset: -1, months: null }
    if (periodMode === 'quarter') {
      const keys = Object.keys(QUARTERS)
      const idx = keys.indexOf(selectedQ)
      const prevIdx = idx <= 0 ? keys.length - 1 : idx - 1
      const yearOffset = idx <= 0 ? -1 : 0
      return { yearOffset, months: QUARTERS[keys[prevIdx]] }
    }
    // month
    const monthsOrder = availMonths.length ? availMonths : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const idx = monthsOrder.indexOf(selectedPeriodMonth)
    const prevIdx = idx <= 0 ? monthsOrder.length - 1 : idx - 1
    const yearOffset = idx <= 0 ? -1 : 0
    return { yearOffset, months: [monthsOrder[prevIdx]] }
  }

  const prevInfo = getPrevInfo()
  const prevYear = year + prevInfo.yearOffset
  const prevY = derived.byYear?.[prevYear]
  let prevPk = null
  if (prevY) {
    const prevMonths = prevInfo.months === null ? prevY.monthly.map((m) => m.month) : prevInfo.months
    prevPk = derivePeriodKPIs(prevY.monthly, prevMonths) || null
  }

  // derive period-level cost and dept slices when raw data is available
  const periodCostByType = rawCost && activeMonths.length ? derivePeriodCostByType(rawCost, year, activeMonths) : (Y.costByType || [])
  const periodByDept = (rawRevenue && rawCost && derived?.departments && activeMonths.length)
    ? derivePeriodByDept(rawRevenue, rawCost, derived.departments, year, activeMonths)
    : (Y.byDept || [])

  let prevPeriodCostByType = null
  let prevPeriodByDept = null
  if (prevY && prevInfo.months) {
    prevPeriodCostByType = rawCost ? derivePeriodCostByType(rawCost, prevYear, prevInfo.months) : prevY.costByType
    prevPeriodByDept = (rawRevenue && rawCost && derived?.departments)
      ? derivePeriodByDept(rawRevenue, rawCost, derived.departments, prevYear, prevInfo.months)
      : prevY.byDept
  }

  const ctx = { periodMode, selectedQ, selectedPeriodMonth, activeMonths, pk, prevPk, prevYear, periodCostByType, prevPeriodCostByType, periodByDept, prevPeriodByDept }

  switch (section) {
    case 'pl':              return plInsights(Y, year, rawRevenue, rawCost, derived, ctx)
    case 'monthly':         return monthlyInsights(Y, year, rawRevenue, rawCost, ctx)
    case 'service-revenue': return serviceRevenueInsights(serviceRevenue?.[year], year, ctx)
    case 'ebit-dept':       return ebitDeptInsights(Y, year, rawRevenue, rawCost, ctx)
    case 'cost-prof':       return costProfInsights(Y, year, rawCost, ctx)
    case 'waterfall':       return waterfallInsights(Y, year, rawCost, ctx)
    case 'ebit-customer':   return ebitCustomerInsights(Y, year, ctx)
    case 'cost-analysis':   return costAnalysisInsights(Y, year, rawCost, ctx)
    default: return []
  }
}

// ─── 01 · P&L Statement ───────────────────────────────────────────────────────
function plInsights(Y, year, rawRevenue, rawCost, derived, ctx = {}) {
  const { kpis: Ykpis } = Y
  const costByType = ctx.periodCostByType || Y.costByType || []
  const kpis = ctx.pk ?? Ykpis
  const causal  = CAUSAL_NOTES[year]
  const out     = []

  // Prior year for context
  const prevY   = derived?.years?.slice().reverse().find((y) => y < year)
  const prevNet = prevY ? derived.byYear[prevY]?.kpis?.netProfit : null
  const prevRev = prevY ? derived.byYear[prevY]?.kpis?.totalRevenue : null

  // ── 1. Net result: framing the year's financial summary ──────────────────────
  const netVsF2      = r2(kpis.netProfit - (kpis.netProfitFc2 ?? 0))
  const revVsF2      = r2(kpis.totalRevenue - (kpis.revFc2 ?? 0))
  const ebit         = kpis.ebit ?? 0
  const ebitMargin   = kpis.totalRevenue > 0 ? r1((ebit / kpis.totalRevenue) * 100) : 0

  if (kpis.netProfit < 0) {
    // Loss year - find whether event-driven or structural
    const swing = prevNet != null ? r2(kpis.netProfit - prevNet) : null
    const swingDir = swing != null && swing < 0 ? `a ₹${abs(swing).toFixed(1)} Cr swing from the prior year's ₹${prevNet >= 0 ? '+' : ''}${prevNet?.toFixed(1)} Cr result` : null
    out.push({
      severity: 'warn',
      tag:   `P&L · Net Loss FY ${year}`,
      title: `₹${abs(kpis.netProfit).toFixed(1)} Cr net loss on ₹${kpis.totalRevenue.toFixed(1)} Cr revenue - EBIT margin ${ebitMargin}%, below the break-even threshold`,
      reason: swingDir
        ? `${swingDir}. Revenue is ₹${abs(revVsF2).toFixed(1)} Cr below FC2 and cost is ₹${abs(r2(kpis.totalCost - (kpis.costFc2 ?? 0))).toFixed(1)} Cr above FC2.`
        : `Net profit is ₹${abs(netVsF2).toFixed(1)} Cr below FC2 and ₹${abs(r2(kpis.netProfit - (kpis.netProfitFc1 ?? 0))).toFixed(1)} Cr versus FC1.`,
    })
  } else if (netVsF2 >= 0) {
    out.push({
      severity: 'good',
      tag:   `P&L · Plan Beat FY ${year}`,
      title: `₹${kpis.netProfit.toFixed(1)} Cr net result beats FC2 by ₹${netVsF2.toFixed(1)} Cr - EBIT margin ${ebitMargin}%, above target`,
      reason: prevRev && kpis.totalRevenue > prevRev
        ? `Revenue grew ₹${r2(kpis.totalRevenue - prevRev).toFixed(1)} Cr vs prior year while cost discipline held. Drill into H2 run-rate and revenue composition to validate sustainability.`
        : `Both revenue beat (₹${abs(revVsF2).toFixed(1)} Cr above FC2) and cost discipline contributed. Drill into revenue and cost composition to assess persistence of the beat.`,
    })
  } else {
    out.push({
      severity: 'info',
      tag:   `P&L · Plan Miss FY ${year}`,
      title: `₹${kpis.netProfit.toFixed(1)} Cr net result - ₹${abs(netVsF2).toFixed(1)} Cr short of FC2, EBIT margin ${ebitMargin}%`,
      reason: `Net profit is ₹${abs(netVsF2).toFixed(1)} Cr below FC2 and ₹${abs(r2(kpis.netProfit - (kpis.netProfitFc1 ?? 0))).toFixed(1)} Cr versus FC1.`,
    })
  }

  // ── 2. Revenue swing - biggest miss or beat with causal detail ───────────────
  const revMiss = biggestMonthlyRevMiss(rawRevenue, year)
  const revBeat = biggestMonthlyRevBeat(rawRevenue, year)

  if (kpis.netProfit < 0 && revMiss && revMiss.diff > 0.5) {
    const note    = causal?.rev?.[revMiss.month]?.note
    const culprit = deptHitInMonth(rawRevenue, year, revMiss.month)
    const pctMiss = revMiss.fc2 > 0 ? r1((revMiss.diff / revMiss.fc2) * 100) : 0
    out.push({
      severity: 'warn',
      tag:   `Revenue · Deepest Miss · ${revMiss.month}`,
      title: `${revMiss.month} revenue gap ₹${revMiss.diff.toFixed(1)} Cr (${pctMiss}% below FC2) - single largest drag on the year`,
      reason: `Actual ₹${revMiss.act.toFixed(1)} Cr vs FC2 ₹${revMiss.fc2.toFixed(1)} Cr.${culprit ? ` ${shortDept(culprit.dept)} accounts for ${abs(culprit.pct).toFixed(0)}% of the gap (₹${culprit.miss.toFixed(1)} Cr).` : ''}`,
    })
  } else if (revBeat && revBeat.diff > 0.5) {
    const note    = causal?.rev?.[revBeat.month]?.note
    const pctBeat = revBeat.fc2 > 0 ? r1((revBeat.diff / revBeat.fc2) * 100) : 0
    out.push({
      severity: 'good',
      tag:   `Revenue · Strongest Month · ${revBeat.month}`,
      title: `${revBeat.month} outperformed FC2 by ₹${revBeat.diff.toFixed(1)} Cr (+${pctBeat}%) - highest single-month revenue beat`,
      reason: `Actual ₹${revBeat.act.toFixed(1)} Cr vs FC2 ₹${revBeat.fc2.toFixed(1)} Cr.`,
    })
  }

  // ── 3. Personnel cost - biggest single cost driver ───────────────────────────
  const pex   = costByType.find((c) => c.type === 'PEX')
  const total = costByType.reduce((s, c) => s + c.actual, 0)
  if (pex && total > 0) {
    const pexPct   = r1((pex.actual / total) * 100)
    const pexVarF2 = r2(pex.actual - pex.fc2)
    const revPerCostRatio = pex.actual > 0 ? r1(kpis.totalRevenue / pex.actual) : null
    const pexNote  = causal?.cost ? Object.values(causal.cost).find((v) => v.type === 'PEX')?.note : null
    const verdict  = pexVarF2 > 1.5 ? `overran FC2 by ₹${pexVarF2.toFixed(1)} Cr - hiring outpaced revenue growth`
                   : pexVarF2 < -1.5 ? `saved ₹${abs(pexVarF2).toFixed(1)} Cr vs FC2 - headcount growth trailed plan`
                   : `tracking within ₹${abs(pexVarF2).toFixed(1)} Cr of FC2`
    out.push({
      severity: pexVarF2 > 1.5 ? 'warn' : pexVarF2 < -1.5 ? 'good' : 'info',
      tag:   `PEX · ${pexPct}% of Total Cost`,
      title: `Personnel at ₹${pex.actual.toFixed(1)} Cr (${pexPct}% of cost) - ${verdict}`,
      reason: pexNote
        ? `${pexNote}${revPerCostRatio ? ` Revenue-to-PEX ratio is ${revPerCostRatio.toFixed(1)}×.` : ''}`
        : pexVarF2 > 1.5
          ? `PEX ₹${pex.actual.toFixed(1)} Cr vs FC2 ₹${pex.fc2.toFixed(1)} Cr (Δ ₹${pexVarF2.toFixed(1)} Cr). Drill into headcount, hire dates and revenue-per-FTE by dept.`
          : `PEX ₹${pex.actual.toFixed(1)} Cr vs FC2 ₹${pex.fc2.toFixed(1)} Cr (Δ ₹${pexVarF2.toFixed(1)} Cr). Drill into payroll timing and hiring to determine recurrence.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 02 · Monthly Performance ─────────────────────────────────────────────────
function monthlyInsights(Y, year, rawRevenue, rawCost, ctx = {}) {
  const { monthly } = Y
  const causal = CAUSAL_NOTES[year]
  const kpis = ctx.pk ?? Y.kpis
  const out    = []

  const actualMonths = monthly.filter((m) => m.revAct > 0)
  if (!actualMonths.length) return []

  // ── Best month - name the driver, not just the number ───────────────────────
  const best     = [...actualMonths].sort((a, b) => b.npAct - a.npAct)[0]
  const bestNote = causal?.rev?.[best.month]?.note
  const beatFC2  = r2(best.npAct - best.npFc2)
  out.push({
    severity: 'good',
    tag:   `Peak Month · ${best.month} · ₹${best.npAct.toFixed(2)} Cr`,
    title: `${best.month} recorded the highest net result: ₹${best.npAct.toFixed(2)} Cr at ${best.npRatio}% margin${beatFC2 > 0 ? `, beating FC2 by ₹${beatFC2.toFixed(2)} Cr` : ''}`,
    reason: `Revenue ₹${best.revAct.toFixed(1)} Cr vs FC2 ₹${best.revFc2.toFixed(1)} Cr, cost ₹${best.costAct.toFixed(1)} Cr vs FC2 ₹${best.costFc2.toFixed(1)} Cr.`,
  })

  // ── Worst month - show the double-squeeze when both rev miss and cost spike ──
  const worst         = [...actualMonths].sort((a, b) => a.npAct - b.npAct)[0]
  const worstRevNote  = causal?.rev?.[worst.month]?.note
  const worstCostNote = causal?.cost?.[worst.month]?.note
  const doubleSqueeze = worstRevNote && worstCostNote
  const worstRevMiss  = r2(worst.revFc2 - worst.revAct)
  const worstCostOver = r2(worst.costAct - worst.costFc2)
  const totalSwing    = r2(worstRevMiss + worstCostOver)

  let worstReason
    if (doubleSqueeze) {
    worstReason = `Revenue and cost moved against plan in the same month: ₹${worstRevMiss.toFixed(1)} Cr revenue shortfall and ₹${worstCostOver.toFixed(1)} Cr cost overrun.`
  } else if (worstRevNote || worstCostNote) {
    worstReason = `Revenue ₹${worst.revAct.toFixed(1)} Cr vs FC2 ₹${worst.revFc2.toFixed(1)} Cr; cost ₹${worst.costAct.toFixed(1)} Cr vs FC2 ₹${worst.costFc2.toFixed(1)} Cr.`
  } else {
    worstReason = `Revenue ₹${worst.revAct.toFixed(1)} Cr vs FC2 ₹${worst.revFc2.toFixed(1)} Cr; cost ₹${worst.costAct.toFixed(1)} Cr vs FC2 ₹${worst.costFc2.toFixed(1)} Cr.`
  }
  out.push({
    severity: worst.npAct < 0 ? 'warn' : 'info',
    tag:   `Weakest Month · ${worst.month} · ₹${worst.npAct.toFixed(2)} Cr`,
    title: worst.npAct < 0
      ? `${worst.month} posted a ₹${abs(worst.npAct).toFixed(2)} Cr net loss`
      : `${worst.month} was the softest month: ₹${worst.npAct.toFixed(2)} Cr net at ${worst.npRatio}% margin`,
    reason: worstReason,
  })

  // ── YoY signal - project to full-year implication ────────────────────────────
  const withYoY    = actualMonths.filter((m) => m.yoy != null && m.yoy !== 0)
  const negYoY     = withYoY.filter((m) => m.yoy < 0)
  const posYoY     = withYoY.filter((m) => m.yoy > 0)

  if (withYoY.length > 0) {
    const avgYoY = r1(withYoY.reduce((s, m) => s + (m.yoy ?? 0), 0) / withYoY.length)
    if (negYoY.length > 0) {
      const deepest  = [...negYoY].sort((a, b) => a.yoy - b.yoy)[0]
      const deepNote = causal?.rev?.[deepest.month]?.note
      const annualised = Y.kpis.totalRevenue > 0
        ? r1(Y.kpis.totalRevenue * (negYoY.length / withYoY.length) * abs(avgYoY) / 100)
        : null
      out.push({
        severity: negYoY.length >= 3 ? 'warn' : 'info',
        tag:   `YoY Trend · ${negYoY.length} Negative Month${negYoY.length > 1 ? 's' : ''}`,
        title: `${negYoY.length} of ${withYoY.length} months declined vs base year - deepest in ${deepest.month} at ${deepest.yoy?.toFixed(1)}%${annualised ? `, equivalent to ~₹${annualised.toFixed(1)} Cr annual revenue shortfall` : ''}`,
        reason: `Negative vs base in ${negYoY.map((m) => m.month).join(', ')}.`,
      })
    } else if (posYoY.length > 0) {
      const annualised = Y.kpis.totalRevenue > 0 && Y.kpis.yoyGrowth
        ? r2(Y.kpis.totalRevenue - (Y.kpis.totalRevenue / (1 + Y.kpis.yoyGrowth / 100)))
        : null
      out.push({
        severity: 'good',
        tag:   `YoY Trend · All Months Positive`,
        title: `All ${posYoY.length} comparable months grew vs base year - average +${avgYoY}%${annualised ? `, adding ₹${annualised.toFixed(1)} Cr above the baseline` : ''}`,
        reason: `Consistent growth across every month with actuals. The recovery trajectory is intact - set FY ${year + 1} baseline at the current H2 run-rate, not the full-year average, to avoid sandbagging the target.`,
      })
    }
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 03 · Service Revenue ─────────────────────────────────────────────────────
function serviceRevenueInsights(SRY, year, ctx = {}) {
  if (!SRY || !SRY.byDept?.length) return []
  const { byDept, totalFte, totalTxn, total, monthly } = SRY
  const out = []

  // ── Revenue concentration: who drives the portfolio ──────────────────────────
  const topDept  = byDept[0]
  const topPct   = r1((topDept.total / total) * 100)
  const exitRisk = r2(topDept.total * 0.35) // rough EBIT proxy: loss if top dept exits
  out.push({
    severity: topPct > 45 ? 'warn' : 'good',
    tag:   `Revenue Leader · ${shortDept(topDept.dept)} · ${topPct}%`,
    title: topPct > 45
      ? `${topDept.dept.split('(')[0].trim()} carries ${topPct}% of service revenue (₹${topDept.total.toFixed(1)} Cr) - single-account concentration above safe threshold`
      : `${topDept.dept.split('(')[0].trim()} leads at ₹${topDept.total.toFixed(1)} Cr (${topPct}%) - portfolio is reasonably distributed`,
    reason: topPct > 45
      ? `FTE ₹${topDept.fteRevenue.toFixed(1)} Cr + Txn ₹${topDept.txnRevenue.toFixed(1)} Cr. Concentration risk ~₹${exitRisk.toFixed(1)} Cr of EBIT. Drill into customer contract and monthly revenue to quantify exposure.`
      : `FTE ₹${topDept.fteRevenue.toFixed(1)} Cr + Txn ₹${topDept.txnRevenue.toFixed(1)} Cr. Healthy spread. Drill into department monthly performance to monitor concentration.`,
  })

  // ── Billing mix: FTE (fixed income) vs Transaction (volume-linked upside) ────
  const ftePct = r1((totalFte / total) * 100)
  const txnPct = r1(100 - ftePct)
  const upside = txnPct > 40
    ? `Volume growth flows directly to margin at zero incremental headcount cost.`
    : `Current mix caps revenue growth to headcount growth; drill into service mix and pricing to evaluate scalability options.`
  out.push({
    severity: txnPct > 40 ? 'good' : 'info',
    tag:   `Billing Mix · ${ftePct}% FTE · ${txnPct}% Txn`,
    title: `${ftePct}% FTE-billed (₹${totalFte.toFixed(1)} Cr) · ${txnPct}% transaction-billed (₹${totalTxn.toFixed(1)} Cr)`,
    reason: `${upside} Drill into service mix and pricing to evaluate scalability and margin implications.`,
  })

  // ── Revenue momentum: is the portfolio accelerating or decelerating? ──────────
  if (monthly?.length >= 4) {
    const midpoint  = Math.floor(monthly.length / 2)
    const h1        = r2(monthly.slice(0, midpoint).reduce((s, m) => s + m.total, 0))
    const h2        = r2(monthly.slice(midpoint).reduce((s, m) => s + m.total, 0))
    const h2Growth  = r1(((h2 - h1) / Math.max(h1, 0.01)) * 100)
    const monthly_run = r2((h2 / (monthly.length - midpoint)))
    out.push({
      severity: h2Growth >= 3 ? 'good' : h2Growth < -5 ? 'warn' : 'info',
      tag:   `H1→H2 Momentum · ${h2Growth >= 0 ? '+' : ''}${h2Growth}%`,
      title: h2Growth >= 0
        ? `Service revenue accelerated ${h2Growth}% from H1 to H2 - current monthly run-rate ₹${monthly_run.toFixed(1)} Cr`
        : `Service revenue decelerated ${abs(h2Growth)}% in H2 - run-rate entering FY ${year + 1} is below the H1 base`,
      reason: `H1 ₹${h1.toFixed(1)} Cr → H2 ₹${h2.toFixed(1)} Cr. ${h2Growth >= 3 ? `H2 run-rate ~₹${monthly_run.toFixed(1)} Cr/month` : h2Growth < -5 ? `H2 deceleration observed` : `Broadly stable`} Drill into signed scope and monthly run-rate to set FY ${year + 1} baseline.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 04 · EBIT Matrix - Department ───────────────────────────────────────────
function ebitDeptInsights(Y, year, rawRevenue, rawCost, ctx = {}) {
  const { ebitMatrix } = Y
  const causal = CAUSAL_NOTES[year]
  const out    = []
  const kpis = ctx.pk ?? Y.kpis

  const byDept = ctx.periodByDept || Y.byDept || []
  const totalEBIT = ebitMatrix.reduce((s, d) => s + d.total, 0)

  // ── EBIT leader - what is making it work, and can it be replicated? ──────────
  const top = ebitMatrix[0]
  if (top) {
    const topPct    = r1((top.total / Math.max(abs(totalEBIT), 0.01)) * 100)
    const peakCell  = top.cells.reduce((b, c) => c.ebit > b.ebit ? c : b, top.cells[0] || { month: '-', ebit: 0 })
    const troughCell= top.cells.reduce((b, c) => c.ebit < b.ebit ? c : b, top.cells[0] || { month: '-', ebit: 0 })
    const topDeptData = byDept.find((d) => d.department === top.department)
    const topMargin = topDeptData?.margin ?? 0
    out.push({
      severity: 'good',
      tag:   `EBIT Leader · ${shortDept(top.department)} · ${topPct}% share`,
      title: `${top.department.split('(')[0].trim()} generates ₹${top.total.toFixed(1)} Cr EBIT (${topPct}% of total) at ${topMargin}% margin - highest in the portfolio`,
      reason: `Monthly range: ₹${troughCell.ebit.toFixed(2)} Cr (${troughCell.month}) to ₹${peakCell.ebit.toFixed(2)} Cr (${peakCell.month}). Drill into pricing and delivery cost structure to identify replicable elements.`,
    })
  }

  // ── Loss cells - deepest single department-month loss ───────────────────────
  const allCells   = ebitMatrix.flatMap((d) => d.cells.map((c) => ({ ...c, dept: d.department })))
  const lossCells  = allCells.filter((c) => c.ebit < 0).sort((a, b) => a.ebit - b.ebit)
  if (lossCells.length > 0) {
    const worst         = lossCells[0]
    const worstNote     = causal?.cost?.[worst.month]?.note || causal?.rev?.[worst.month]?.note
    const lossDeptCount = new Set(lossCells.map((c) => c.dept)).size
    const annualised    = r2(worst.ebit * 12)
    out.push({
      severity: 'warn',
      tag:   `EBIT Loss · ${shortDept(worst.dept)} · ${worst.month}`,
      title: `${shortDept(worst.dept)} burned ₹${abs(worst.ebit).toFixed(2)} Cr in ${worst.month} - deepest single-cell loss (${lossCells.length} loss-cell${lossCells.length > 1 ? 's' : ''} across ${lossDeptCount} dept${lossDeptCount > 1 ? 's' : ''})`,
      reason: worstNote
        ? `${worstNote} Annualised drag ~₹${abs(annualised).toFixed(1)} Cr if repeated. Drill into the ${shortDept(worst.dept)} dept-month cells and contract terms to identify drivers.`
        : `${lossCells.length} loss-cell${lossCells.length > 1 ? 's' : ''} indicate pricing or delivery cost misalignment (deepest: ₹${abs(worst.ebit).toFixed(2)} Cr). Drill into account-level cost-to-serve and pricing to quantify remediation need.`,
    })
  } else {
    out.push({
      severity: 'good',
      tag:   `EBIT Quality · Zero Loss Months`,
      title: `All ${ebitMatrix.length} departments contributed positive EBIT every month - no loss-cells in FY ${year}`,
      reason: `All departments delivered positive EBIT for every month in FY ${year}. Drill into monthly cells to track any departments approaching break-even.`,
    })
  }

  // ── Margin spread - convert ppt gap to ₹ opportunity ──────────────────────
  if (byDept.length >= 2) {
    const sorted  = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD   = sorted[0]
    const worstD  = sorted[sorted.length - 1]
    const gap     = r1(bestD.margin - worstD.margin)
    const uplift  = worstD.revAct > 0 ? r2(worstD.revAct * (gap / 100)) : null
    out.push({
      severity: worstD.margin < 0 ? 'warn' : worstD.margin < 5 ? 'warn' : 'info',
      tag:   `Margin Spread · ${gap} ppt Gap`,
      title: `${gap} ppt margin gap: ${shortDept(bestD.department)} at ${bestD.margin}% vs ${shortDept(worstD.department)} at ${worstD.margin}%${uplift ? ` - closing the gap is worth ₹${uplift.toFixed(1)} Cr EBIT` : ''}`,
      reason: worstD.margin < 0
        ? `${shortDept(worstD.department)} is loss-making - burning ₹${abs(worstD.ebit).toFixed(1)} Cr per year. Drill into dept-level revenue, pricing and delivery cost to quantify drivers.`
        : worstD.margin < 5
          ? `${shortDept(worstD.department)} is below the 5% viability threshold. A single re-pricing action (8-10% rate increase or equivalent scope reduction) moves it above the line without losing the account.`
          : `Spread is manageable but a ₹${uplift?.toFixed(1) ?? '-'} Cr EBIT opportunity exists. Drive bottom-quartile departments to median margin through productivity programmes - target 200 bps improvement in FY ${year + 1}.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 05 · Cost & Profitability ────────────────────────────────────────────────
function costProfInsights(Y, year, rawCost, ctx = {}) {
  const { costByType: YcostByType, byDept: YbyDept } = Y
  const costByType = ctx.periodCostByType || YcostByType || []
  const byDept = ctx.periodByDept || YbyDept || []
  const out = []
  const kpis = ctx.pk ?? Y.kpis

  const total = costByType.reduce((s, c) => s + c.actual, 0)
  const pex   = costByType.find((c) => c.type === 'PEX')
  const opex  = costByType.find((c) => c.type === 'OPEX')
  const capex = costByType.find((c) => c.type === 'CAPEX')

  if (pex && total > 0) {
    const pexPct   = r1((pex.actual / total) * 100)
    const pexVarF2 = r2(pex.actual - pex.fc2)
    const pexNote  = Object.values(CAUSAL_NOTES[year]?.cost || {}).find((v) => v.type === 'PEX')?.note
    out.push({
      severity: pexVarF2 > 1.5 ? 'warn' : pexVarF2 < -1.5 ? 'good' : 'info',
      tag:   `PEX · ${pexPct}% of Cost`,
      title: `Personnel cost ₹${pex.actual.toFixed(1)} Cr (${pexPct}% of total) - ${pexVarF2 > 0 ? `₹${pexVarF2.toFixed(1)} Cr above FC2` : `₹${abs(pexVarF2).toFixed(1)} Cr below FC2`}`,
      reason: pexNote
        ? pexNote
        : pexPct > 65
          ? `At ${pexPct}% PEX concentration (₹${pex.actual.toFixed(1)} Cr). Drill into revenue-per-FTE and hiring cadence by department to assess leverage.`
          : `PEX ₹${pex.actual.toFixed(1)} Cr is within plan. Drill into revenue-per-FTE to monitor headcount efficiency.`,
    })
  }

  if (opex && total > 0) {
    const opexPct   = r1((opex.actual / total) * 100)
    const opexVarF2 = r2(opex.actual - opex.fc2)
    const opexNote  = Object.values(CAUSAL_NOTES[year]?.cost || {}).find((v) => v.type === 'OPEX')?.note
    out.push({
      severity: opexVarF2 > 1 ? 'warn' : opexVarF2 < -1 ? 'good' : 'info',
      tag:   `OPEX · ${opexPct}% of Cost`,
      title: `Operating cost ₹${opex.actual.toFixed(1)} Cr (${opexPct}%) - ${opexVarF2 > 0 ? `₹${opexVarF2.toFixed(1)} Cr above FC2, consulting and IT the primary drivers` : `₹${abs(opexVarF2).toFixed(1)} Cr below FC2`}`,
      reason: opexNote
        ? opexNote
        : opexVarF2 > 1
          ? `OPEX overrun concentrated in discretionary lines. Drill into cost-by-subcategory (consulting/IT/facility) to locate drivers and quantify recurrence.`
          : `OPEX is below plan. Drill into service delivery and cost-by-subcategory to determine whether the saving is recurring.`,
    })
  }

  if (capex) {
    const capexDefer = r2(capex.fc2 - capex.actual)
    const capexNote  = Object.values(CAUSAL_NOTES[year]?.cost || {}).find((v) => v.type === 'CAPEX')?.note
    out.push({
      severity: capexDefer > 1 ? 'plan' : 'info',
      tag:   capexDefer > 0.5 ? 'CAPEX · Deferred Refresh' : 'CAPEX · On Track',
      title: capexDefer > 0.5
        ? `CAPEX under-spent ₹${capexDefer.toFixed(1)} Cr vs FC2 - infrastructure refresh pushed into FY ${year + 1}`
        : `CAPEX on track at ₹${capex.actual.toFixed(1)} Cr vs FC2 ₹${capex.fc2.toFixed(1)} Cr`,
      reason: capexDefer > 0.5
        ? `CAPEX is ₹${capexDefer.toFixed(1)} Cr below FC2.`
        : `CAPEX actual is ₹${capex.actual.toFixed(1)} Cr vs FC2 ₹${capex.fc2.toFixed(1)} Cr.`,
    })
  }

  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD  = sorted[0]
    const worstD = sorted[sorted.length - 1]
    const uplift = worstD.revAct > 0 ? r2(worstD.revAct * 0.05) : null
    out.push({
      severity: worstD.margin < 5 ? 'warn' : 'info',
      tag:   'Department P&L · Spread',
      title: `${bestD.department.split('(')[0].trim()} leads margin at ${bestD.margin}% · ${worstD.department.split('(')[0].trim()} trails at ${worstD.margin}%`,
      reason: worstD.margin < 0
        ? `${shortDept(worstD.department)} is loss-making - burning ₹${abs(worstD.ebit).toFixed(1)} Cr per year. Drill into dept-level revenue, cost and contract terms to quantify remediation need.`
        : worstD.margin < 5
          ? `${shortDept(worstD.department)} is below the 5% viability floor.${uplift ? ` Potential uplift ~₹${uplift.toFixed(1)} Cr EBIT from a 500 bps improvement.` : ''} Drill into pricing and delivery cost for uplift opportunities.`
          : `Portfolio margin spread is acceptable. Drill into lagging departments' cost and pricing to identify targeted improvements.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 06 · Driver Waterfall ────────────────────────────────────────────────────
function waterfallInsights(Y, year, rawCost, ctx = {}) {
  const { costByType: YcostByType } = Y
  const causal = CAUSAL_NOTES[year]
  const out    = []
  const kpis = ctx.pk ?? Y.kpis
  const costByType = ctx.periodCostByType || YcostByType || []

  const costVarF2  = r2(kpis.totalCost - (kpis.costFc2 ?? 0))
  const overrun    = biggestMonthlyOverrun(rawCost, year, null)
  const overrunPct = overrun && abs(costVarF2) > 0.01
    ? r1((overrun.diff / abs(costVarF2)) * 100) : null

  out.push({
    severity: costVarF2 > 2 ? 'warn' : costVarF2 < -2 ? 'good' : 'info',
    tag:   `Cost Bridge · FY ${year} Total`,
    title: costVarF2 > 0
      ? `Total cost overran FC2 by ₹${costVarF2.toFixed(1)} Cr - ${overrun ? `${overrunPct}% of that overrun concentrated in ${overrun.month} alone` : 'spread across the year'}`
      : `Total cost ₹${abs(costVarF2).toFixed(1)} Cr below FC2 - strongest full-year cost performance`,
    reason: overrun
      ? `${overrun.month}: ₹${overrun.actual.toFixed(1)} Cr actual vs ₹${overrun.fc2.toFixed(1)} Cr FC2 (+₹${overrun.diff.toFixed(1)} Cr). ${overrunPct ? `One month is ${overrunPct}% of the full-year variance - ` : ''}strip the ${overrun.month} one-off from the FY ${year + 1} baseline; only carry recurring elements forward.`
      : `Actual ₹${kpis.totalCost.toFixed(1)} Cr vs FC2 ₹${kpis.costFc2.toFixed(1)} Cr. Variance is within tolerance - use the actual as the FY ${year + 1} cost floor without adjustment.`,
  })

  const sorted   = [...costByType].sort((a, b) => (b.actual - b.fc2) - (a.actual - a.fc2))
  const topOver  = sorted[0]
  const topSave  = sorted[sorted.length - 1]

  if (topOver && topOver.actual - topOver.fc2 > 0.3) {
    const diff     = r2(topOver.actual - topOver.fc2)
    const overNote = causal?.cost ? Object.values(causal.cost).find((v) => v.type === topOver.type)?.note : null
    const shareOfVar = costVarF2 > 0 ? r1((diff / costVarF2) * 100) : null
    out.push({
      severity: 'warn',
      tag:   `Biggest Overrun · ${topOver.type} · ₹${diff.toFixed(1)} Cr`,
      title: `${topOver.type} is the primary cost driver: ₹${diff.toFixed(1)} Cr above FC2${shareOfVar ? ` (${shareOfVar}% of total overrun)` : ''}`,
      reason: topOver.type === 'PEX'
        ? `PEX actual is above FC2.`
        : topOver.type === 'OPEX'
          ? `OPEX actual is above FC2.`
          : `CAPEX actual is above FC2.`,
    })
  }

  if (topSave && topSave.actual - topSave.fc2 < -0.3) {
    const saveDiff = r2(topSave.fc2 - topSave.actual)
    out.push({
      severity: 'good',
      tag:   `Cost Saving · ${topSave.type} · ₹${saveDiff.toFixed(1)} Cr`,
      title: `${topSave.type} is ₹${saveDiff.toFixed(1)} Cr below FC2`,
      reason: topSave.type === 'CAPEX'
        ? `CAPEX actual is below FC2 by ₹${saveDiff.toFixed(1)} Cr.`
        : `Cost actual is below FC2 by ₹${saveDiff.toFixed(1)} Cr.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 07 · EBIT Matrix - Customer ─────────────────────────────────────────────
function ebitCustomerInsights(Y, year, ctx = {}) {
  const { ebitCustomerMatrix } = Y
  if (!ebitCustomerMatrix?.length) return []
  const out = []

  const totalEBIT = ebitCustomerMatrix.reduce((s, d) => s + d.total, 0)
  const top = ebitCustomerMatrix[0]
  if (top) {
    const topPct   = r1((top.total / Math.max(abs(totalEBIT), 0.01)) * 100)
    const exitRisk = r2(top.total * 0.8)
    out.push({
      severity: topPct > 40 ? 'warn' : 'good',
      tag:   `Top Customer · ${top.department} · ${topPct}% EBIT`,
      title: topPct > 40
        ? `${top.department} generates ${topPct}% of customer EBIT (₹${top.total.toFixed(1)} Cr) - concentration above safe threshold`
        : `${top.department} is the EBIT anchor at ₹${top.total.toFixed(1)} Cr (${topPct}% of total) - portfolio is well distributed`,
      reason: topPct > 40
        ? `Top customer concentration ~${topPct}% (~₹${top.total.toFixed(1)} Cr EBIT). Drill into customer contract, renewal schedule and monthly EBIT to assess retention risk.`
        : `Customer-level EBIT is well-spread. Drill into customer-level EBIT to monitor concentration when adding new strategic accounts.`,
    })
  }

  const lossCust = ebitCustomerMatrix.filter((d) => d.total < 0)
  const breakEven = ebitCustomerMatrix.filter((d) => d.total >= 0 && d.total < 0.5)
  if (lossCust.length > 0) {
    const totalDrain = r2(lossCust.reduce((s, d) => s + d.total, 0))
    out.push({
      severity: 'warn',
      tag:   `Loss Customers · ${lossCust.length} Account${lossCust.length > 1 ? 's' : ''}`,
      title: `${lossCust.length} customer${lossCust.length > 1 ? 's' : ''} are EBIT-negative: ${lossCust.map((d) => d.department).join(', ')} - total drain ₹${abs(totalDrain).toFixed(1)} Cr`,
      reason: `These accounts consume margin: total drain ₹${abs(totalDrain).toFixed(1)} Cr. Drill into account-level revenue, cost-to-serve and contract terms to prioritise remediation.`,
    })
  } else {
    out.push({
      severity: 'good',
      tag:   `Customer Profitability · All Positive`,
      title: `All ${ebitCustomerMatrix.length} customers contributed positive EBIT in FY ${year}${breakEven.length > 0 ? ` (${breakEven.length} near break-even - watch list)` : ''}`,
      reason: breakEven.length > 0
        ? `${breakEven.map((d) => d.department).join(', ')} are within ₹0.5 Cr of break-even. Drill into these accounts' monthly EBIT and contract terms for a focused watchlist.`
        : `Customer profitability is healthy for this portfolio size. Drill into customer EBIT trends to retain this profile.`,
    })
  }

  // Margin by customer spread
  if (ebitCustomerMatrix.length >= 3) {
    const byMargin = ebitCustomerMatrix
      .filter((d) => d.cells.some((c) => c.revenue > 0))
      .map((d) => {
        const rev = d.cells.reduce((s, c) => s + c.revenue, 0)
        return { name: d.department, ebit: d.total, margin: rev > 0 ? r1((d.total / rev) * 100) : 0 }
      }).sort((a, b) => b.margin - a.margin)
    if (byMargin.length >= 2) {
      const best  = byMargin[0]
      const worst = byMargin[byMargin.length - 1]
      const gap   = r1(best.margin - worst.margin)
      if (gap > 5) {
        out.push({
          severity: worst.margin < 5 ? 'info' : 'info',
          tag:   `Customer Margin Gap · ${gap} ppt`,
          title: `${gap} ppt customer margin spread: ${best.name} at ${best.margin}% vs ${worst.name} at ${worst.margin}%`,
          reason: `${best.name}'s pricing and delivery model outperforms the portfolio average - identify the key differentiators (contract structure, volume, automation) and apply them to the next contract renewal with ${worst.name}.`,
        })
      }
    }
  }

  return out.map(o => { delete o.reason; return o })
}

// ─── 08 · Cost Analysis ───────────────────────────────────────────────────────
function costAnalysisInsights(Y, year, rawCost, ctx = {}) {
  const { monthly, costByType: YcostByType } = Y
  const causal = CAUSAL_NOTES[year]
  const out    = []
  const kpis = ctx.pk ?? Y.kpis
  const costByType = ctx.periodCostByType || YcostByType || []

  const validMonths = monthly.filter((m) => m.costAct > 0)

  // ── Biggest OPEX spike - name the event, project the normalisation ────────────
  const opexOverrun = biggestMonthlyOverrun(rawCost, year, 'OPEX')
  if (opexOverrun && opexOverrun.diff > 0.2) {
    const note    = causal?.cost?.[opexOverrun.month]?.note
    const pctSpike= r1((opexOverrun.diff / opexOverrun.fc2) * 100)
    out.push({
      severity: opexOverrun.diff > 1.5 ? 'warn' : 'info',
      tag:   `OPEX Spike · ${opexOverrun.month} · +${pctSpike}%`,
      title: `${opexOverrun.month} OPEX hit ₹${opexOverrun.actual.toFixed(1)} Cr - ₹${opexOverrun.diff.toFixed(1)} Cr (${pctSpike}%) above FC2, the largest single-month overshoot`,
      reason: note
        ? `${note} Classify this cost as one-time and strip it from the FY ${year + 1} OPEX baseline - permanently carrying it forward inflates the budget by ₹${r2(opexOverrun.diff * 12).toFixed(1)} Cr annually.`
        : `Actual ₹${opexOverrun.actual.toFixed(1)} Cr vs FC2 ₹${opexOverrun.fc2.toFixed(1)} Cr. Identify the sub-category driver (consulting/IT/facility), classify as one-time vs recurring, and adjust the FY ${year + 1} baseline accordingly.`,
    })
  } else if (validMonths.length >= 6) {
    const mid   = Math.floor(validMonths.length / 2)
    const h1Avg = r2(validMonths.slice(0, mid).reduce((s, m) => s + m.costAct, 0) / mid)
    const h2Avg = r2(validMonths.slice(mid).reduce((s, m) => s + m.costAct, 0) / (validMonths.length - mid))
    const trend = r1(((h2Avg - h1Avg) / Math.max(h1Avg, 0.01)) * 100)
    out.push({
      severity: trend > 10 ? 'warn' : trend < -5 ? 'good' : 'info',
      tag:   `Cost Trajectory · H1→H2 ${trend >= 0 ? '+' : ''}${trend}%`,
      title: trend > 0
        ? `Cost run-rate accelerated ${trend}% from H1 to H2 - ₹${h2Avg.toFixed(1)} Cr/month vs ₹${h1Avg.toFixed(1)} Cr/month`
        : `Cost run-rate fell ${abs(trend)}% from H1 to H2 - ₹${h2Avg.toFixed(1)} Cr/month vs ₹${h1Avg.toFixed(1)} Cr/month`,
      reason: trend > 10
        ? `H2 acceleration implies annualised cost ~₹${r2(h2Avg * 12).toFixed(1)} Cr. Drill into H2 monthly drivers to separate structural headcount from discretionary one-offs.`
        : `H2 cost discipline is improving. Drill into H2 run-rate components to determine a recurring baseline for FY ${year + 1}.`,
    })
  }

  // ── Full-year OPEX variance - with context ────────────────────────────────────
  const opex = costByType.find((c) => c.type === 'OPEX')
  if (opex) {
    const varF2  = r2(opex.actual - opex.fc2)
    const note   = causal?.cost ? Object.values(causal.cost).find((v) => v.type === 'OPEX')?.note : null
    const pctVar = opex.fc2 > 0 ? r1((varF2 / opex.fc2) * 100) : 0
    out.push({
      severity: varF2 > 0.5 ? 'warn' : varF2 < -0.5 ? 'good' : 'info',
      tag:   `OPEX FY · ${varF2 > 0 ? '+' : ''}${pctVar}% vs FC2`,
      title: varF2 > 0
        ? `OPEX overran FC2 by ₹${varF2.toFixed(1)} Cr (${pctVar}%) for the full year - discretionary spend needs tighter gates`
        : `OPEX landed ₹${abs(varF2).toFixed(1)} Cr (${abs(pctVar)}%) below FC2 - full-year saving confirmed`,
      reason: note
        ? note
        : varF2 > 0
          ? `OPEX ₹${opex.actual.toFixed(1)} Cr vs FC2 ₹${opex.fc2.toFixed(1)} Cr (Δ ₹${varF2.toFixed(1)} Cr, ${pctVar}%). Drill into cost-by-type and monthly view to locate drivers.`
          : `OPEX ₹${opex.actual.toFixed(1)} Cr vs FC2 ₹${opex.fc2.toFixed(1)} Cr (Δ ₹${varF2.toFixed(1)} Cr, ${pctVar}%). Drill into cost-by-type and monthly view to validate whether the saving is recurring.`,
    })
  }

  // ── Peak cost month - what caused it, will it repeat? ────────────────────────
  if (validMonths.length > 0) {
    const peak    = validMonths.reduce((p, m) => m.costAct > p.costAct ? m : p, validMonths[0])
    const peakVar = r2(peak.costAct - peak.costFc2)
    const note    = causal?.cost?.[peak.month]?.note
    const pctPeak = peak.costFc2 > 0 ? r1((peakVar / peak.costFc2) * 100) : 0
    out.push({
      severity: peak.costAct > peak.costFc2 ? 'warn' : 'info',
      tag:   `Peak Spend · ${peak.month} · ₹${peak.costAct.toFixed(1)} Cr`,
      title: peak.costAct > peak.costFc2
        ? `${peak.month} was the most expensive month (₹${peak.costAct.toFixed(1)} Cr) - ₹${peakVar.toFixed(1)} Cr (${pctPeak}%) above FC2; both forecasts underestimated this month`
        : `${peak.month} was the peak cost month at ₹${peak.costAct.toFixed(1)} Cr - within FC2 (₹${peak.costFc2.toFixed(1)} Cr), planning accuracy held`,
      reason: note
        ? note
        : peak.costAct > peak.costFc2
          ? `Actual ₹${peak.costAct.toFixed(1)} Cr vs FC1 ₹${peak.costFc1.toFixed(1)} Cr / FC2 ₹${peak.costFc2.toFixed(1)} Cr. If this was event-driven, strip the one-off from the FY ${year + 1} seasonal profile; if it was under-forecasting, adjust the FY ${year + 1} forecast model for this month.`
          : `Both forecasts captured the seasonality correctly - planning model is calibrated. Use the same seasonality curve for FY ${year + 1} cost phasing.`,
    })
  }

  return out.map(o => { delete o.reason; return o })
}
