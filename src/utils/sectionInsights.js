const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
const shortDept = (name) => name.match(/\(([^)]+)\)/)?.[1] ?? name.split(' ').slice(0, 2).join(' ')

export function getSectionInsights(section, { derived, serviceRevenue, year }) {
  const Y = derived?.byYear?.[year]
  if (!Y) return []
  switch (section) {
    case 'pl':              return plInsights(Y, year)
    case 'monthly':         return monthlyInsights(Y, year)
    case 'service-revenue': return serviceRevenueInsights(serviceRevenue?.[year], year)
    case 'ebit-dept':       return ebitDeptInsights(Y, year)
    case 'cost-prof':       return costProfInsights(Y, year)
    case 'waterfall':       return waterfallInsights(Y, year)
    case 'ebit-customer':   return ebitCustomerInsights(Y, year)
    case 'cost-analysis':   return costAnalysisInsights(Y, year)
    default: return []
  }
}

// ─── 01 · P&L Statement ──────────────────────────────────────────────────────
function plInsights(Y, year) {
  const { kpis, costByType } = Y
  const out = []
  const total = costByType.reduce((s, c) => s + c.actual, 0)

  // Net result verdict
  const netVsF1 = r2(kpis.netProfit - (kpis.netProfitFc1 ?? 0))
  const netVsF2 = r2(kpis.netProfit - (kpis.netProfitFc2 ?? 0))
  out.push({
    severity: kpis.netProfit < 0 ? 'warn' : netVsF1 >= 0 ? 'good' : 'info',
    tag: 'Net Result · FY Summary',
    title: kpis.netProfit < 0
      ? `Full-year net loss of ₹${Math.abs(kpis.netProfit).toFixed(1)} Cr`
      : netVsF1 >= 0
        ? `Net result beat FC1 by ₹${netVsF1.toFixed(1)} Cr`
        : `Net result missed FC1 by ₹${Math.abs(netVsF1).toFixed(1)} Cr`,
    reason: `Actual ₹${kpis.netProfit.toFixed(1)} Cr — Var·FC1: ${netVsF1 >= 0 ? '+' : ''}₹${netVsF1.toFixed(1)} Cr, Var·FC2: ${netVsF2 >= 0 ? '+' : ''}₹${netVsF2.toFixed(1)} Cr. ${
      kpis.netProfit < 0
        ? 'Cost pressure exceeded revenue. Re-baseline FY' + String(year + 1) + ' before committing commitments.'
        : netVsF1 >= 0
          ? 'Above-plan revenue and cost discipline drove the beat — lock into FY' + String(year + 1) + ' assumptions.'
          : 'Revenue shortfall or cost overspend. Review which departments drove the miss.'
    }`
  })

  // FC1 → FC2 plan revision
  const revRev = r2(kpis.revFc2 - kpis.revFc1)
  const costRev = r2(kpis.costFc2 - kpis.costFc1)
  out.push({
    severity: Math.abs(revRev) > 3 ? 'plan' : 'info',
    tag: 'Mid-Year Plan Revision FC1 → FC2',
    title: revRev < 0
      ? `Revenue target cut ₹${Math.abs(revRev).toFixed(1)} Cr and cost revised ${costRev >= 0 ? 'up' : 'down'} ₹${Math.abs(costRev).toFixed(1)} Cr in FC2`
      : `Revenue target raised ₹${revRev.toFixed(1)} Cr in FC2 re-plan`,
    reason: `Revenue: FC1 ₹${kpis.revFc1.toFixed(1)} → FC2 ₹${kpis.revFc2.toFixed(1)} Cr. Cost: FC1 ₹${kpis.costFc1.toFixed(1)} → FC2 ₹${kpis.costFc2.toFixed(1)} Cr. ${
      Math.abs(revRev) > 5
        ? 'Large revision — assess whether assumptions have structurally changed before finalising FY' + String(year + 1) + ' budget.'
        : 'Minor mid-year recalibration — directionally consistent with original plan.'
    }`
  })

  // PEX as largest cost driver
  const pex = costByType.find(c => c.type === 'PEX')
  if (pex) {
    const pexPct = r1((pex.actual / total) * 100)
    const pexVarF1 = r2(pex.actual - pex.fc1)
    out.push({
      severity: pexVarF1 > 1.5 ? 'warn' : pexVarF1 < -1.5 ? 'good' : 'info',
      tag: 'PEX · Largest Cost Driver',
      title: `Personnel cost (${pexPct}% of spend) ${pexVarF1 > 0 ? 'overran' : 'saved'} ₹${Math.abs(pexVarF1).toFixed(1)} Cr vs FC1`,
      reason: `PEX actual ₹${pex.actual.toFixed(1)} Cr vs FC1 ₹${pex.fc1.toFixed(1)} Cr / FC2 ₹${pex.fc2.toFixed(1)} Cr. ${
        pexVarF1 > 0
          ? 'Hiring pace or salary revisions exceeded forecast — verify headcount-to-revenue alignment.'
          : 'Hiring below plan — check if timing or structural lean, and carry savings forward only if permanent.'
      }`
    })
  }

  return out
}

// ─── 02 · Monthly Performance ────────────────────────────────────────────────
function monthlyInsights(Y, year) {
  const { monthly } = Y
  if (!monthly.length) return []
  const out = []

  const best = [...monthly].sort((a, b) => b.npAct - a.npAct)[0]
  out.push({
    severity: 'good',
    tag: `Best Month · ${best.month}`,
    title: `${best.month} delivered the strongest net profit: ₹${best.npAct.toFixed(2)} Cr (${best.npRatio}% margin)`,
    reason: `Revenue ₹${best.revAct.toFixed(1)} Cr vs FC1 ₹${best.revFc1.toFixed(1)} Cr / FC2 ₹${best.revFc2.toFixed(1)} Cr. Net profit ${best.npAct >= best.npFc1 ? 'beat FC1 — use as execution benchmark for FY' + String(year + 1) + '.' : 'below FC1 — even peak month missed plan, indicating systemic revenue pressure.'}`
  })

  const worst = [...monthly].sort((a, b) => a.npAct - b.npAct)[0]
  out.push({
    severity: worst.npAct < 0 ? 'warn' : 'info',
    tag: `Weakest Month · ${worst.month}`,
    title: worst.npAct < 0
      ? `${worst.month} recorded a net loss of ₹${Math.abs(worst.npAct).toFixed(2)} Cr — only loss month this year`
      : `${worst.month} was the weakest at ₹${worst.npAct.toFixed(2)} Cr net profit`,
    reason: `Revenue ₹${worst.revAct.toFixed(1)} Cr vs FC1 ₹${worst.revFc1.toFixed(1)} Cr. Net profit Var·FC1: ${r2(worst.npAct - worst.npFc1) >= 0 ? '+' : ''}₹${r2(worst.npAct - worst.npFc1).toFixed(2)} Cr. ${
      worst.npAct < 0
        ? 'Loss driven by cost spike and revenue dip coinciding. Identify root cause and build contingency for similar months in FY' + String(year + 1) + '.'
        : 'Weak month likely reflects seasonal softness — model this into FY' + String(year + 1) + ' forecast shape.'
    }`
  })

  const negYoY = monthly.filter(m => m.yoy != null && m.yoy < 0)
  if (negYoY.length > 0) {
    const deepest = [...negYoY].sort((a, b) => a.yoy - b.yoy)[0]
    out.push({
      severity: negYoY.length >= 3 ? 'warn' : 'info',
      tag: 'YoY Growth · Negative Months',
      title: `${negYoY.length} month${negYoY.length > 1 ? 's' : ''} showed negative YoY revenue — deepest: ${deepest.month} at ${deepest.yoy?.toFixed(1)}%`,
      reason: `Negative YoY in: ${negYoY.map(m => m.month).join(', ')}. These months signal either prior-year high-base effect or structural FY${year} weakness. Verify FY${year + 1} pipeline covers the shortfall.`
    })
  } else {
    const yoyMonths = monthly.filter(m => m.yoy != null)
    if (yoyMonths.length) {
      const avgYoY = r1(yoyMonths.reduce((s, m) => s + (m.yoy ?? 0), 0) / yoyMonths.length)
      out.push({
        severity: 'good',
        tag: 'YoY Growth · All Months Positive',
        title: `Every month grew YoY — average +${avgYoY}% revenue growth across FY${year}`,
        reason: `Consistent outperformance vs FY${year - 1} across all ${yoyMonths.length} months. Strong momentum supports FY${year + 1} baseline growth assumption.`
      })
    }
  }

  return out
}

// ─── 03 · Service Revenue ────────────────────────────────────────────────────
function serviceRevenueInsights(SRY, year) {
  if (!SRY || !SRY.byDept?.length) return []
  const { byDept, totalFte, totalTxn, total, monthly } = SRY
  const out = []

  const topDept = byDept[0]
  const topPct = r1((topDept.total / total) * 100)
  out.push({
    severity: topPct > 45 ? 'info' : 'good',
    tag: `Revenue Leader · ${shortDept(topDept.dept)}`,
    title: `${topDept.dept.split('(')[0].trim()} generates ${topPct}% of service revenue at ₹${topDept.total.toFixed(1)} Cr`,
    reason: `FTE billing: ₹${topDept.fteRevenue.toFixed(1)} Cr + Transaction billing: ₹${topDept.txnRevenue.toFixed(1)} Cr. ${
      topPct > 45
        ? 'High concentration risk — if this department loses scope, total revenue falls materially. Diversify.'
        : 'Balanced contribution. Healthy portfolio distribution across departments.'
    }`
  })

  const ftePct = r1((totalFte / total) * 100)
  const txnPct = 100 - ftePct
  out.push({
    severity: ftePct > 75 ? 'info' : txnPct > 55 ? 'good' : 'info',
    tag: 'Billing Mix · FTE vs Transaction',
    title: `${ftePct}% FTE-based (₹${totalFte.toFixed(1)} Cr) vs ${txnPct}% transaction-based (₹${totalTxn.toFixed(1)} Cr)`,
    reason: `FTE billing provides stable recurring base. Transaction billing scales with client volume. ${
      txnPct > 40
        ? 'Strong transaction share — revenue will grow organically as client volumes increase. Protect per-unit rates.'
        : 'FTE-heavy mix is resilient but limits upside. Explore transaction fee opportunities in high-volume services.'
    }`
  })

  if (monthly?.length >= 6) {
    const midpoint = Math.floor(monthly.length / 2)
    const h1 = r2(monthly.slice(0, midpoint).reduce((s, m) => s + m.total, 0))
    const h2 = r2(monthly.slice(midpoint).reduce((s, m) => s + m.total, 0))
    const h2Growth = r1(((h2 - h1) / Math.max(h1, 0.01)) * 100)
    out.push({
      severity: h2Growth >= 3 ? 'good' : h2Growth < -5 ? 'warn' : 'info',
      tag: 'H1 vs H2 Revenue Trajectory',
      title: h2Growth >= 0
        ? `H2 service revenue grew ${h2Growth}% over H1 — building momentum into FY${year + 1}`
        : `H2 service revenue declined ${Math.abs(h2Growth)}% vs H1 — closing momentum weakened`,
      reason: `H1: ₹${h1.toFixed(1)} Cr → H2: ₹${h2.toFixed(1)} Cr. ${
        h2Growth >= 0
          ? 'Positive trajectory supports FY' + String(year + 1) + ' growth plan. Use H2 run-rate as floor assumption.'
          : 'H2 softness may reflect pricing pressure or demand dip. Validate FY' + String(year + 1) + ' client pipeline before confirming targets.'
      }`
    })
  }

  return out
}

// ─── 04 · EBIT Matrix — Department ──────────────────────────────────────────
function ebitDeptInsights(Y, year) {
  const { ebitMatrix, byDept } = Y
  const out = []

  const top = ebitMatrix[0]
  if (top) {
    const allEBIT = ebitMatrix.reduce((s, d) => s + d.total, 0)
    const topPct = r1((top.total / Math.max(allEBIT, 0.01)) * 100)
    const peakCell = top.cells.reduce((b, c) => c.ebit > b.ebit ? c : b, top.cells[0] || { month: '—', ebit: 0 })
    out.push({
      severity: 'good',
      tag: `EBIT Leader · ${shortDept(top.department)}`,
      title: `${top.department.split('(')[0].trim()} leads with ₹${top.total.toFixed(1)} Cr annual EBIT (${topPct}% of total)`,
      reason: `Peak contribution in ${peakCell.month} at ₹${peakCell.ebit.toFixed(2)} Cr. Consistent EBIT across months indicates stable operations. Use as the benchmark department for FY${year + 1} delivery standards.`
    })
  }

  const negDepts = ebitMatrix.filter(d => d.cells.some(c => c.ebit < 0))
  if (negDepts.length > 0) {
    const worst = negDepts.reduce((w, d) => {
      const minE = Math.min(...d.cells.map(c => c.ebit))
      return minE < Math.min(...w.cells.map(c => c.ebit)) ? d : w
    }, negDepts[0])
    const lossMonths = worst.cells.filter(c => c.ebit < 0)
    const deepLoss = Math.min(...lossMonths.map(c => c.ebit))
    out.push({
      severity: 'warn',
      tag: `EBIT Loss · ${shortDept(worst.department)}`,
      title: `${worst.department.split('(')[0].trim()} posted EBIT loss in ${lossMonths.length} month${lossMonths.length > 1 ? 's' : ''} (deepest: ₹${deepLoss.toFixed(2)} Cr)`,
      reason: `Loss months: ${lossMonths.map(c => c.month).join(', ')}. Usually driven by cost spikes or revenue seasonality. Review contract pricing and delivery cost for these periods before FY${year + 1} re-pricing.`
    })
  } else {
    out.push({
      severity: 'good',
      tag: 'EBIT Consistency',
      title: `All ${ebitMatrix.length} departments maintained positive EBIT throughout FY${year}`,
      reason: `Zero loss-making months across all departments — strong operational control. Lock this as a performance commitment in FY${year + 1} service-level agreements.`
    })
  }

  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD = sorted[0], worstD = sorted[sorted.length - 1]
    out.push({
      severity: worstD.margin < 5 ? 'warn' : 'info',
      tag: 'Margin Spread Across Departments',
      title: `Margin range: ${bestD.margin}% (${shortDept(bestD.department)}) → ${worstD.margin}% (${shortDept(worstD.department)}) — ${r1(bestD.margin - worstD.margin)} ppt gap`,
      reason: `Structural cost or pricing differences drive the spread. ${worstD.margin < 5 ? shortDept(worstD.department) + ' below 5% threshold — urgent renegotiation or cost restructure needed.' : 'Acceptable spread — close the gap through productivity improvements and selective pricing uplift.'}`
    })
  }

  return out
}

// ─── 05 · Cost & Profitability ───────────────────────────────────────────────
function costProfInsights(Y, year) {
  const { costByType, byDept } = Y
  const out = []

  const total = costByType.reduce((s, c) => s + c.actual, 0)
  const pex   = costByType.find(c => c.type === 'PEX')
  const capex = costByType.find(c => c.type === 'CAPEX')

  if (pex) {
    const pexPct   = r1((pex.actual / total) * 100)
    const pexVarF1 = r2(pex.actual - pex.fc1)
    out.push({
      severity: pexPct > 65 ? 'info' : 'good',
      tag: 'PEX Dominance · Cost Composition',
      title: `Personnel expense is ${pexPct}% of total cost — ${pexVarF1 > 0 ? '₹' + pexVarF1.toFixed(1) + ' Cr above FC1' : '₹' + Math.abs(pexVarF1).toFixed(1) + ' Cr below FC1'}`,
      reason: `PEX ₹${pex.actual.toFixed(1)} Cr vs FC1 ₹${pex.fc1.toFixed(1)} Cr / FC2 ₹${pex.fc2.toFixed(1)} Cr. ${pexPct > 65 ? 'High PEX is typical for SSC model. Ensure headcount growth rate stays below revenue growth rate.' : 'Healthy PEX ratio — operational leverage is improving.'}`
    })
  }

  if (capex) {
    const capexDefer = r2(capex.fc1 - capex.actual)
    out.push({
      severity: capexDefer > 1 ? 'plan' : 'info',
      tag: 'CAPEX Deferral',
      title: capexDefer > 0.5
        ? `CAPEX deferred ₹${capexDefer.toFixed(1)} Cr vs FC1 — actual ₹${capex.actual.toFixed(1)} Cr vs plan ₹${capex.fc1.toFixed(1)} Cr`
        : `CAPEX on track at ₹${capex.actual.toFixed(1)} Cr vs FC1 ₹${capex.fc1.toFixed(1)} Cr`,
      reason: capexDefer > 0.5
        ? `Equipment/infrastructure refresh slipped. Budget ₹${capexDefer.toFixed(1)} Cr carry-forward into FY${year + 1} Q1. Reassess depreciation timeline and assess operational risk of deferred assets.`
        : `Capital deployment matched plan — infrastructure investment is proceeding as scheduled.`
    })
  }

  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD = sorted[0], worstD = sorted[sorted.length - 1]
    out.push({
      severity: worstD.margin < 5 ? 'warn' : 'info',
      tag: 'Department Profitability Ranking',
      title: `${bestD.department.split('(')[0].trim()} most profitable at ${bestD.margin}% EBIT margin; ${worstD.department.split('(')[0].trim()} lags at ${worstD.margin}%`,
      reason: `EBIT gap: ₹${r2(bestD.ebit - worstD.ebit).toFixed(1)} Cr between top and bottom. ${worstD.margin < 5 ? 'Below 5% margin warrants immediate pricing review or delivery cost reduction for ' + shortDept(worstD.department) + '.' : 'Margin spread is manageable — drive bottom-quartile departments toward median through targeted efficiency programs.'}`
    })
  }

  return out
}

// ─── 06 · Driver Waterfall ───────────────────────────────────────────────────
function waterfallInsights(Y, year) {
  const { costByType, kpis } = Y
  const out = []

  const costVarF1 = r2(kpis.totalCost - kpis.costFc1)
  const costVarF2 = r2(kpis.totalCost - kpis.costFc2)
  out.push({
    severity: costVarF1 > 2 ? 'warn' : costVarF1 < -2 ? 'good' : 'info',
    tag: 'Total Cost Bridge · FC1 & FC2 vs Actual',
    title: costVarF1 > 0
      ? `Total cost overran FC1 by ₹${costVarF1.toFixed(1)} Cr — FC2 gap: ${costVarF2 >= 0 ? '+' : ''}₹${costVarF2.toFixed(1)} Cr`
      : `Total cost saved ₹${Math.abs(costVarF1).toFixed(1)} Cr vs FC1 — FC2 gap: ${costVarF2 >= 0 ? '+' : ''}₹${costVarF2.toFixed(1)} Cr`,
    reason: `Actual ₹${kpis.totalCost.toFixed(1)} Cr vs FC1 ₹${kpis.costFc1.toFixed(1)} Cr and FC2 ₹${kpis.costFc2.toFixed(1)} Cr. ${
      Math.abs(costVarF1) > 3
        ? 'Significant variance — the category-level waterfall below identifies which cost drivers are responsible.'
        : 'Variance within normal range — cost control mechanisms are functioning.'
    }`
  })

  const sorted = [...costByType].sort((a, b) => (b.actual - b.fc1) - (a.actual - a.fc1))
  const topOverrun = sorted[0]
  if (topOverrun && topOverrun.actual - topOverrun.fc1 > 0.3) {
    out.push({
      severity: 'warn',
      tag: `Biggest Overrun · ${topOverrun.type}`,
      title: `${topOverrun.type} is the primary cost driver — +₹${r2(topOverrun.actual - topOverrun.fc1).toFixed(1)} Cr over FC1 (FC2 var: ${r2(topOverrun.actual - topOverrun.fc2) >= 0 ? '+' : ''}₹${r2(topOverrun.actual - topOverrun.fc2).toFixed(1)} Cr)`,
      reason: `${topOverrun.type} actual ₹${topOverrun.actual.toFixed(1)} Cr vs FC1 ₹${topOverrun.fc1.toFixed(1)} Cr. ${
        topOverrun.type === 'PEX'
          ? 'Headcount additions or salary revisions drove the overage — align hiring plan with revenue contract pipeline.'
          : topOverrun.type === 'OPEX'
            ? 'Variable operating spend exceeded plan — review discretionary cost controls and approval thresholds.'
            : 'Capital expenditure exceeded plan — review project approval and procurement process.'
      }`
    })
  }

  const topSaving = sorted[sorted.length - 1]
  if (topSaving && topSaving.actual - topSaving.fc1 < -0.3) {
    out.push({
      severity: 'good',
      tag: `Cost Saving · ${topSaving.type}`,
      title: `${topSaving.type} delivered ₹${Math.abs(r2(topSaving.actual - topSaving.fc1)).toFixed(1)} Cr saving vs FC1`,
      reason: `${topSaving.type} actual ₹${topSaving.actual.toFixed(1)} Cr vs FC1 ₹${topSaving.fc1.toFixed(1)} Cr. ${
        topSaving.type === 'CAPEX'
          ? 'Equipment refresh deferred — plan FY' + String(year + 1) + ' cash impact and depreciation schedule accordingly.'
          : 'Structural savings from process improvement or volume leverage — lock into FY' + String(year + 1) + ' baseline, not just one-off.'
      }`
    })
  }

  return out
}

// ─── 07 · EBIT Matrix — Customer ────────────────────────────────────────────
function ebitCustomerInsights(Y, year) {
  const { ebitCustomerMatrix } = Y
  if (!ebitCustomerMatrix?.length) return []
  const out = []

  const allEBIT = ebitCustomerMatrix.reduce((s, d) => s + d.total, 0)
  const top = ebitCustomerMatrix[0]
  if (top) {
    const topPct = r1((top.total / Math.max(allEBIT, 0.01)) * 100)
    out.push({
      severity: topPct > 40 ? 'info' : 'good',
      tag: `Top Customer · ${top.department}`,
      title: `${top.department} contributes ${topPct}% of customer EBIT at ₹${top.total.toFixed(1)} Cr`,
      reason: `${topPct > 40 ? 'High customer concentration — losing or repricing this account has outsized P&L impact. Negotiate long-term contract lock-in.' : 'Well-distributed customer EBIT base — resilient to single-client risk.'} Monitor renewal schedule.`
    })
  }

  const lossCust = ebitCustomerMatrix.filter(d => d.total < 0)
  if (lossCust.length > 0) {
    out.push({
      severity: 'warn',
      tag: 'Loss-Making Customers',
      title: `${lossCust.length} customer${lossCust.length > 1 ? 's' : ''} generated negative EBIT: ${lossCust.map(d => d.department).join(', ')}`,
      reason: 'Unprofitable accounts drain margin from high-performing ones. Review delivery cost, SLA scope, and pricing model. Consider renegotiation or managed exit if structurally loss-making.'
    })
  } else {
    out.push({
      severity: 'good',
      tag: 'Customer Profitability · Clean Sheet',
      title: `All ${ebitCustomerMatrix.length} customers contributed positive EBIT in FY${year}`,
      reason: `Full customer profitability is a strong foundation. Build customer-level EBIT targets into FY${year + 1} scorecards and maintain regular account profitability reviews.`
    })
  }

  return out
}

// ─── 08 · Cost Analysis ──────────────────────────────────────────────────────
function costAnalysisInsights(Y, year) {
  const { monthly, costByType } = Y
  const out = []

  const validMonths = monthly.filter(m => m.costAct > 0)
  if (validMonths.length >= 6) {
    const midpoint = Math.floor(validMonths.length / 2)
    const h1Avg = r2(validMonths.slice(0, midpoint).reduce((s, m) => s + m.costAct, 0) / midpoint)
    const h2Avg = r2(validMonths.slice(midpoint).reduce((s, m) => s + m.costAct, 0) / (validMonths.length - midpoint))
    const trend = r1(((h2Avg - h1Avg) / Math.max(h1Avg, 0.01)) * 100)
    out.push({
      severity: trend > 10 ? 'warn' : trend < -5 ? 'good' : 'info',
      tag: 'Monthly Cost Trend · H1 vs H2',
      title: trend > 0
        ? `H2 monthly cost run-rate is ${trend}% higher than H1 — cost acceleration`
        : `H2 monthly cost run-rate fell ${Math.abs(trend)}% vs H1 — improving cost discipline`,
      reason: `H1 avg ₹${h1Avg.toFixed(1)} Cr/month → H2 avg ₹${h2Avg.toFixed(1)} Cr/month. ${
        trend > 10
          ? 'Rising run-rate warrants scrutiny before FY' + String(year + 1) + ' budget lock — identify whether driven by headcount, discretionary, or one-off.'
          : 'Declining run-rate signals structural efficiency improvement. Use H2 as the FY' + String(year + 1) + ' base.'
      }`
    })
  }

  const opex = costByType.find(c => c.type === 'OPEX')
  if (opex) {
    const varF1 = r2(opex.actual - opex.fc1)
    const varF2 = r2(opex.actual - opex.fc2)
    out.push({
      severity: varF1 > 0.5 ? 'warn' : varF1 < -0.5 ? 'good' : 'info',
      tag: 'OPEX Variance · FC1 & FC2',
      title: varF1 > 0
        ? `OPEX overran FC1 by ₹${varF1.toFixed(1)} Cr — Var·FC2: ${varF2 >= 0 ? '+' : ''}₹${varF2.toFixed(1)} Cr`
        : `OPEX ran ₹${Math.abs(varF1).toFixed(1)} Cr below FC1 — operating efficiency gain`,
      reason: `OPEX actual ₹${opex.actual.toFixed(1)} Cr vs FC1 ₹${opex.fc1.toFixed(1)} Cr and FC2 ₹${opex.fc2.toFixed(1)} Cr. ${
        varF1 > 0
          ? 'Check discretionary cost approval process — travel, software, and facilities are common OPEX swing items.'
          : 'OPEX savings structural or deferred — investigate whether service quality is maintained before declaring efficiency.'
      }`
    })
  }

  if (validMonths.length > 0) {
    const peak = validMonths.reduce((p, m) => m.costAct > p.costAct ? m : p, validMonths[0])
    const peakVarF2 = r2(peak.costAct - peak.costFc2)
    out.push({
      severity: peak.costAct > peak.costFc2 ? 'warn' : 'info',
      tag: `Peak Cost Month · ${peak.month}`,
      title: `${peak.month} was the most expensive at ₹${peak.costAct.toFixed(1)} Cr total cost — ${peak.costAct > peak.costFc2 ? '₹' + peakVarF2.toFixed(1) + ' Cr above FC2' : 'within FC2 range'}`,
      reason: `FC1: ₹${peak.costFc1.toFixed(1)} Cr, FC2: ₹${peak.costFc2.toFixed(1)} Cr, Actual: ₹${peak.costAct.toFixed(1)} Cr. ${
        peak.costAct > peak.costFc2
          ? 'Both forecasts missed — one-off spike or systemic issue. If recurring, revise FY' + String(year + 1) + ' seasonality profile.'
          : 'Peak month within forecast — good planning accuracy for seasonal cost patterns.'
      }`
    })
  }

  return out
}
