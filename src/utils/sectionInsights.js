// Insight engine — produces 2-4 narrative cards per section.
// Each card has:  severity (good|warn|info|plan), tag (chip), title (one line), reason (the WHY + SO WHAT).
//
// Wording rules (so the dashboard reads consistently):
//   • Title  = headline number + one-line conclusion
//   • Reason = WHY it happened (causal narrative) + a sharp NEXT-STEP verb
//   • Avoid hedge language ("likely", "may"); say what to do
//   • Use ₹ Cr with one decimal; percent with one decimal

const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100
const CR = 1e7
const shortDept = (name) => name.match(/\(([^)]+)\)/)?.[1] ?? name.split(' ').slice(0, 2).join(' ')

// ─────────────────────────────────────────────────────────────────────────────
// CAUSAL NARRATIVE LIBRARY
// Keyed by year → rev/cost → month. Each note is a one-line business cause
// with a specific lever (client, system, contract, hire wave) so the reader
// understands WHY a number moved, not just THAT it moved.
// ─────────────────────────────────────────────────────────────────────────────
const CAUSAL_NOTES = {
  2026: {
    rev: {
      Jan: { dept: 'HR', note: 'HR onboarded TechFab Industries (new payroll + onboarding scope), adding ~800 monthly transactions and lifting all-dept actuals 4% above FC2.' },
      Feb: { dept: 'P&C', note: 'Procurement & Contracts came in ~9% under FC2 — Arora Engineering deferred its Q1 PO batch while migrating SAP R/3 → S4HANA. The ₹2+ Cr slipped into March.' },
      Mar: { dept: 'IT', note: 'IT Management beat FC2 by ~4.5% — first month of the new airport-entity helpdesk SLA (two locations, fixed monthly fee) went live ahead of schedule.' },
      Apr: { dept: 'F&A+IT', note: 'F&A (+8%) and IT (+6%) signed two new service contracts; HR slipped 2% as MNR Aviation paused its FTE-based scope pending internal restructuring.' },
    },
    cost: {
      Feb: { type: 'OPEX', note: 'Consulting OPEX ran 42% above FC2 — external advisory fees for the Arora Engineering SAP migration, plus emergency IT support lines kept on standby through cutover.' },
      Mar: { type: 'OPEX', note: 'S4HANA go-live drove one-time OPEX: IT infrastructure +52%, SAP implementation consulting +48%. Budget normalises in Q2 once cutover support tails off.' },
      Apr: { type: 'PEX', note: 'Eight new FTEs onboarded across IT and F&A for contract expansion — Salaries +12%, agency Recruitment fees +35%, ramp-up Training +28% above FC2.' },
    },
  },
  2025: {
    rev: {
      Mar: { dept: 'P&C', note: 'Procurement & Contracts revenue collapsed 45% — Bangalore Aviation Group deferred its Q1 PO batch by a full quarter pending internal contract review. P&C absorbed the entire hit.' },
      Aug: { dept: 'HR+FMS', note: 'HR (-32%) and FMS (-28%) bore the brunt of a client-wide discretionary spend pause: payroll volume held but onboarding/recruitment transactions dried up; facility bookings plunged.' },
    },
    cost: {
      Mar: { type: 'OPEX', note: 'Consulting OPEX +120% — emergency SAP R/3 refresh advisory engaged after the BAG contract review surfaced compliance gaps. IT OPEX +65% from accelerated audit support.' },
      Jun: { type: 'OPEX', note: 'Hyderabad campus expansion was front-loaded into Q2 — Facility OPEX +180%, Equipment CAPEX +140%. Costs hit before revenue from the expanded footprint started flowing.' },
      Nov: { type: 'PEX', note: 'Year-end PEX surge: Salary accruals +55%, agency Recruitment +140% (12-hire intake for Dec peak), Training +85%. Hiring deliberately pulled forward to staff Q4 SLAs.' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export function getSectionInsights(section, { derived, serviceRevenue, year, rawRevenue, rawCost }) {
  const Y = derived?.byYear?.[year]
  if (!Y) return []
  switch (section) {
    case 'pl':              return plInsights(Y, year, rawRevenue, rawCost, derived)
    case 'monthly':         return monthlyInsights(Y, year, rawRevenue, rawCost)
    case 'service-revenue': return serviceRevenueInsights(serviceRevenue?.[year], year)
    case 'ebit-dept':       return ebitDeptInsights(Y, year, rawRevenue, rawCost)
    case 'cost-prof':       return costProfInsights(Y, year, rawCost)
    case 'waterfall':       return waterfallInsights(Y, year, rawCost)
    case 'ebit-customer':   return ebitCustomerInsights(Y, year)
    case 'cost-analysis':   return costAnalysisInsights(Y, year, rawCost)
    default: return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────
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
    if (diff > worstDiff) worst = { month: m, actual: v.actual / CR, fc2: v.fc2 / CR, diff: diff / CR }
    if (diff > worstDiff) worstDiff = diff
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

// ─── 01 · P&L Statement ──────────────────────────────────────────────────────
function plInsights(Y, year, rawRevenue, rawCost, derived) {
  const { kpis, costByType } = Y
  const causal = CAUSAL_NOTES[year]
  const out = []

  // ── 1. Net result headline ────────────────────────────────────────────────
  const netVsF2 = r2(kpis.netProfit - (kpis.netProfitFc2 ?? 0))
  const netVsF1 = r2(kpis.netProfit - (kpis.netProfitFc1 ?? 0))
  const yoy     = kpis.yoyGrowth
  const prevY   = derived?.years?.find((y) => y < year)
  const prevNet = prevY ? derived.byYear[prevY]?.kpis?.netProfit : null

  let title, reason, severity = 'info'
  if (kpis.netProfit < 0) {
    severity = 'warn'
    const swing = prevNet != null ? r2(kpis.netProfit - prevNet) : null
    title = `FY ${year} closed at a net loss of ₹${Math.abs(kpis.netProfit).toFixed(1)} Cr — margin ${kpis.margin.toFixed(1)}%`
    reason = swing != null
      ? `${swing.toFixed(1)} Cr swing vs FY ${prevY} (${prevNet >= 0 ? '+' : ''}₹${prevNet.toFixed(1)} Cr → ₹${kpis.netProfit.toFixed(1)} Cr). Plan miss: ₹${Math.abs(netVsF2).toFixed(1)} Cr below FC2 / ₹${Math.abs(netVsF1).toFixed(1)} Cr below FC1. Re-baseline FY ${year + 1} before signing new SLAs — current run-rate cannot absorb another adverse event.`
      : `Plan miss ₹${Math.abs(netVsF2).toFixed(1)} Cr vs FC2. Freeze discretionary OPEX, re-baseline FY ${year + 1} headcount.`
  } else if (netVsF2 >= 0) {
    severity = 'good'
    title = `Net result ₹${kpis.netProfit.toFixed(1)} Cr — beat FC2 by ₹${netVsF2.toFixed(1)} Cr (margin ${kpis.margin.toFixed(1)}%)`
    reason = `${yoy != null ? `Revenue grew ${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% YoY. ` : ''}FC1 var ₹${netVsF1.toFixed(1)} Cr, FC2 var ₹${netVsF2.toFixed(1)} Cr. Lock the H2 cost run-rate as the FY ${year + 1} baseline; do not regress.`
  } else {
    title = `Net result ₹${kpis.netProfit.toFixed(1)} Cr — missed FC2 by ₹${Math.abs(netVsF2).toFixed(1)} Cr`
    reason = `${yoy != null ? `Revenue ${yoy >= 0 ? 'grew' : 'fell'} ${Math.abs(yoy).toFixed(1)}% YoY. ` : ''}Identify whether the gap is one-off or structural before approving FY ${year + 1} hiring plan.`
  }
  out.push({ severity, tag: 'Net Result · FY Summary', title, reason })

  // ── 2. Largest revenue swing (miss for loss years, beat for good years) ──
  const revMiss = biggestMonthlyRevMiss(rawRevenue, year)
  const revBeat = biggestMonthlyRevBeat(rawRevenue, year)

  if (kpis.netProfit < 0 && revMiss && revMiss.diff > 0.5) {
    const note    = causal?.rev?.[revMiss.month]?.note
    const culprit = deptHitInMonth(rawRevenue, year, revMiss.month)
    out.push({
      severity: 'warn',
      tag:   `Revenue Miss · ${revMiss.month}`,
      title: `${revMiss.month} was the deepest revenue shortfall — ₹${revMiss.diff.toFixed(1)} Cr below FC2`,
      reason: note
        ? `${note} Actual ₹${revMiss.act.toFixed(1)} Cr vs FC2 ₹${revMiss.fc2.toFixed(1)} Cr. Pursue a contract amendment with the affected client and bake recovery milestones into FY ${year + 1} forecast.`
        : `Actual ₹${revMiss.act.toFixed(1)} Cr vs FC2 ₹${revMiss.fc2.toFixed(1)} Cr.${culprit ? ` Concentrated hit on ${shortDept(culprit.dept)} (-${Math.abs(culprit.pct).toFixed(0)}%, -₹${culprit.miss.toFixed(1)} Cr).` : ''} Investigate root cause within 2 weeks; flag in FY ${year + 1} pipeline review.`,
    })
  } else if (revBeat && revBeat.diff > 0.5) {
    const note = causal?.rev?.[revBeat.month]?.note
    out.push({
      severity: 'good',
      tag:   `Revenue Beat · ${revBeat.month}`,
      title: `${revBeat.month} outperformed FC2 by ₹${revBeat.diff.toFixed(1)} Cr — strongest month`,
      reason: note
        ? note + ` Confirm whether the driver is recurring before raising FY ${year + 1} baseline.`
        : `Actual ₹${revBeat.act.toFixed(1)} Cr vs FC2 ₹${revBeat.fc2.toFixed(1)} Cr. If the driver is recurring (new SLA, scope expansion), raise FY ${year + 1} baseline; if one-off, treat as a buffer.`,
    })
  }

  // ── 3. PEX as cost driver ─────────────────────────────────────────────────
  const pex = costByType.find((c) => c.type === 'PEX')
  const total = costByType.reduce((s, c) => s + c.actual, 0)
  if (pex && total > 0) {
    const pexPct   = r1((pex.actual / total) * 100)
    const pexVarF2 = r2(pex.actual - pex.fc2)
    const pexNote  = causal?.cost ? Object.values(causal.cost).find((v) => v.type === 'PEX')?.note : null
    const headcountVerdict = pexVarF2 > 1.5
      ? `overran FC2 by ₹${pexVarF2.toFixed(1)} Cr — hiring outpaced revenue`
      : pexVarF2 < -1.5
        ? `saved ₹${Math.abs(pexVarF2).toFixed(1)} Cr vs FC2 — hiring lagged plan`
        : `tracking FC2 within ₹${Math.abs(pexVarF2).toFixed(1)} Cr`
    out.push({
      severity: pexVarF2 > 1.5 ? 'warn' : pexVarF2 < -1.5 ? 'good' : 'info',
      tag:   'PEX · Personnel Cost Driver',
      title: `Personnel is ${pexPct}% of total cost — ${headcountVerdict}`,
      reason: pexNote
        ? pexNote
        : pexVarF2 > 1.5
          ? `PEX ₹${pex.actual.toFixed(1)} Cr (FC1 ₹${pex.fc1.toFixed(1)} / FC2 ₹${pex.fc2.toFixed(1)}). Freeze net headcount additions until revenue per FTE returns to FY ${year - 1} levels.`
          : pexVarF2 < -1.5
            ? `PEX ₹${pex.actual.toFixed(1)} Cr (FC1 ₹${pex.fc1.toFixed(1)} / FC2 ₹${pex.fc2.toFixed(1)}). Confirm whether savings are timing or structural — if structural, lower the FY ${year + 1} headcount plan.`
            : `PEX ₹${pex.actual.toFixed(1)} Cr (FC1 ₹${pex.fc1.toFixed(1)} / FC2 ₹${pex.fc2.toFixed(1)}). Maintain headcount-to-revenue ratio at the current level.`,
    })
  }

  return out
}

// ─── 02 · Monthly Performance ────────────────────────────────────────────────
function monthlyInsights(Y, year, rawRevenue, rawCost) {
  const { monthly } = Y
  const causal = CAUSAL_NOTES[year]
  const out = []

  const actualMonths = monthly.filter((m) => m.revAct > 0)
  if (!actualMonths.length) return []

  // Best month
  const best = [...actualMonths].sort((a, b) => b.npAct - a.npAct)[0]
  const bestNote = causal?.rev?.[best.month]?.note
  out.push({
    severity: 'good',
    tag:   `Best Month · ${best.month}`,
    title: `${best.month} was the strongest month — net ₹${best.npAct.toFixed(2)} Cr at ${best.npRatio}% margin`,
    reason: bestNote
      ? bestNote
      : `Revenue ₹${best.revAct.toFixed(1)} Cr vs FC2 ₹${best.revFc2.toFixed(1)} Cr; cost ₹${best.costAct.toFixed(1)} Cr vs FC2 ₹${best.costFc2.toFixed(1)} Cr. ${best.npAct >= best.npFc2 ? 'Use this month as the operating-model benchmark when scoping FY ' + (year + 1) + ' SLAs.' : 'Even the peak month missed FC2 — there is a structural ceiling on revenue. Reset the FY ' + (year + 1) + ' top-line plan.'}`,
  })

  // Worst month — pull both rev and cost narratives if available
  const worst = [...actualMonths].sort((a, b) => a.npAct - b.npAct)[0]
  const worstRevNote  = causal?.rev?.[worst.month]?.note
  const worstCostNote = causal?.cost?.[worst.month]?.note
  let worstReason
  if (worstRevNote && worstCostNote) {
    worstReason = `${worstRevNote} ${worstCostNote}`
  } else if (worstRevNote || worstCostNote) {
    worstReason = worstRevNote || worstCostNote
  } else {
    worstReason = `Revenue ₹${worst.revAct.toFixed(1)} Cr vs FC2 ₹${worst.revFc2.toFixed(1)} Cr; cost ₹${worst.costAct.toFixed(1)} Cr vs FC2 ₹${worst.costFc2.toFixed(1)} Cr. ${worst.npAct < 0 ? 'Cost spike and revenue dip compounded — design a contingency trigger for FY ' + (year + 1) + '.' : 'Seasonal soft month — bake into the FY ' + (year + 1) + ' shape.'}`
  }
  out.push({
    severity: worst.npAct < 0 ? 'warn' : 'info',
    tag:   `Weakest Month · ${worst.month}`,
    title: worst.npAct < 0
      ? `${worst.month} posted a net loss of ₹${Math.abs(worst.npAct).toFixed(2)} Cr — the largest drag on FY result`
      : `${worst.month} was the softest month — net ₹${worst.npAct.toFixed(2)} Cr`,
    reason: worstReason,
  })

  // YoY trend
  const negYoY = monthly.filter((m) => m.yoy != null && m.yoy < 0)
  if (negYoY.length > 0) {
    const deepest = [...negYoY].sort((a, b) => a.yoy - b.yoy)[0]
    const deepNote = causal?.rev?.[deepest.month]?.note
    out.push({
      severity: negYoY.length >= 3 ? 'warn' : 'info',
      tag:   'YoY Growth · Negative Months',
      title: `${negYoY.length} month${negYoY.length > 1 ? 's' : ''} declined YoY — deepest dip in ${deepest.month} (${deepest.yoy?.toFixed(1)}%)`,
      reason: deepNote
        ? deepNote + ` Negative months: ${negYoY.map((m) => m.month).join(', ')}.`
        : `Negative YoY in ${negYoY.map((m) => m.month).join(', ')}. ${negYoY.length >= 3 ? `Pattern is broad — FY ${year + 1} pipeline must cover at least the cumulative shortfall before targets are signed off.` : `Likely event-driven — confirm whether the affected accounts have stabilised.`}`,
    })
  } else {
    const yoyMonths = actualMonths.filter((m) => m.yoy != null)
    if (yoyMonths.length) {
      const avgYoY = r1(yoyMonths.reduce((s, m) => s + (m.yoy ?? 0), 0) / yoyMonths.length)
      out.push({
        severity: 'good',
        tag:   'YoY Growth · All Months Positive',
        title: `Every month grew YoY — average +${avgYoY}% across FY ${year}`,
        reason: `Consistent growth across ${yoyMonths.length} months with actuals. Strong base for FY ${year + 1} — set the baseline at the H2 run-rate, not the full-year average.`,
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
  const topPct  = r1((topDept.total / total) * 100)
  out.push({
    severity: topPct > 45 ? 'info' : 'good',
    tag:   `Revenue Leader · ${shortDept(topDept.dept)}`,
    title: `${topDept.dept.split('(')[0].trim()} is ${topPct}% of service revenue (₹${topDept.total.toFixed(1)} Cr)`,
    reason: `FTE ₹${topDept.fteRevenue.toFixed(1)} Cr + Txn ₹${topDept.txnRevenue.toFixed(1)} Cr. ${topPct > 45 ? `Concentration risk — losing this scope materially impacts P&L. Lock multi-year SLA before FY ${year + 1} renewal.` : `Healthy spread across departments — single-account churn is contained.`}`,
  })

  const ftePct = r1((totalFte / total) * 100)
  const txnPct = r1(100 - ftePct)
  out.push({
    severity: txnPct > 40 ? 'good' : 'info',
    tag:   'Billing Mix · FTE vs Transaction',
    title: `${ftePct}% FTE-based (₹${totalFte.toFixed(1)} Cr) · ${txnPct}% transaction-based (₹${totalTxn.toFixed(1)} Cr)`,
    reason: txnPct > 40
      ? `Transaction billing scales with client activity — ${txnPct}% share means organic upside as volumes grow. Defend per-unit rates at every renewal; raise rates before raising FTE counts.`
      : `FTE-heavy mix is stable but caps upside. Push transaction-fee variants for high-volume services (helpdesk, payroll) at the next contract review.`,
  })

  if (monthly?.length >= 4) {
    const midpoint = Math.floor(monthly.length / 2)
    const h1 = r2(monthly.slice(0, midpoint).reduce((s, m) => s + m.total, 0))
    const h2 = r2(monthly.slice(midpoint).reduce((s, m) => s + m.total, 0))
    const h2Growth = r1(((h2 - h1) / Math.max(h1, 0.01)) * 100)
    out.push({
      severity: h2Growth >= 3 ? 'good' : h2Growth < -5 ? 'warn' : 'info',
      tag:   'H1 vs H2 Trajectory',
      title: h2Growth >= 0
        ? `H2 service revenue grew ${h2Growth}% over H1 — momentum builds into FY ${year + 1}`
        : `H2 service revenue dropped ${Math.abs(h2Growth)}% vs H1 — closing softer than start`,
      reason: `H1 ₹${h1.toFixed(1)} Cr → H2 ₹${h2.toFixed(1)} Cr. ${h2Growth >= 0 ? `Use H2 run-rate as the floor for FY ${year + 1} growth — don't regress.` : `Validate FY ${year + 1} pipeline coverage exceeds the H2 run-rate before locking targets.`}`,
    })
  }

  return out
}

// ─── 04 · EBIT Matrix — Department ──────────────────────────────────────────
function ebitDeptInsights(Y, year, rawRevenue, rawCost) {
  const { ebitMatrix, byDept } = Y
  const causal = CAUSAL_NOTES[year]
  const out = []

  // Leader
  const top = ebitMatrix[0]
  if (top) {
    const allEBIT = ebitMatrix.reduce((s, d) => s + d.total, 0)
    const topPct  = r1((top.total / Math.max(Math.abs(allEBIT), 0.01)) * 100)
    const peakCell  = top.cells.reduce((b, c) => c.ebit > b.ebit ? c : b, top.cells[0] || { month: '—', ebit: 0 })
    const troughCell = top.cells.reduce((b, c) => c.ebit < b.ebit ? c : b, top.cells[0] || { month: '—', ebit: 0 })
    out.push({
      severity: 'good',
      tag:   `EBIT Leader · ${shortDept(top.department)}`,
      title: `${top.department.split('(')[0].trim()} leads EBIT at ₹${top.total.toFixed(1)} Cr (${topPct}% share)`,
      reason: `Peak ${peakCell.month} ₹${peakCell.ebit.toFixed(2)} Cr, trough ${troughCell.month} ₹${troughCell.ebit.toFixed(2)} Cr. Use this department's pricing model as the FY ${year + 1} benchmark for the rest of the portfolio.`,
    })
  }

  // Loss months — single biggest dept-month loss
  const allCells = ebitMatrix.flatMap((d) => d.cells.map((c) => ({ ...c, dept: d.department })))
  const lossCells = allCells.filter((c) => c.ebit < 0).sort((a, b) => a.ebit - b.ebit)
  if (lossCells.length > 0) {
    const worst = lossCells[0]
    const worstNote = causal?.cost?.[worst.month]?.note || causal?.rev?.[worst.month]?.note
    const lossDeptCount = new Set(lossCells.map((c) => c.dept)).size
    out.push({
      severity: 'warn',
      tag:   `EBIT Loss · ${shortDept(worst.dept)} · ${worst.month}`,
      title: `${shortDept(worst.dept)} burned ₹${Math.abs(worst.ebit).toFixed(2)} Cr in ${worst.month} — deepest single-cell loss of FY ${year}`,
      reason: worstNote
        ? `${worstNote} ${lossCells.length} loss-cells across ${lossDeptCount} department${lossDeptCount > 1 ? 's' : ''} in FY ${year}. Renegotiate the underlying contract scope before signing FY ${year + 1} renewals.`
        : `${lossCells.length} loss-cells across ${lossDeptCount} department${lossDeptCount > 1 ? 's' : ''}. Pricing or delivery cost is misaligned — initiate cost-to-serve review and re-rate the affected accounts.`,
    })
  } else {
    out.push({
      severity: 'good',
      tag:   'EBIT Consistency',
      title: `Zero loss-months across all ${ebitMatrix.length} departments in FY ${year}`,
      reason: `Operational cost control is holding. Commit the current loss-month-zero KPI as a non-negotiable in FY ${year + 1} SLAs.`,
    })
  }

  // Margin spread
  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD  = sorted[0]
    const worstD = sorted[sorted.length - 1]
    out.push({
      severity: worstD.margin < 0 ? 'warn' : worstD.margin < 5 ? 'warn' : 'info',
      tag:   'Margin Spread',
      title: `${shortDept(bestD.department)} ${bestD.margin}% → ${shortDept(worstD.department)} ${worstD.margin}% — ${r1(bestD.margin - worstD.margin)} ppt gap`,
      reason: worstD.margin < 0
        ? `${shortDept(worstD.department)} is loss-making (${worstD.margin}% EBIT margin). Pricing review and delivery cost reset both required before FY ${year + 1} renewal — every month of delay costs ₹${Math.abs(r2(worstD.ebit / 12)).toFixed(2)} Cr.`
        : worstD.margin < 5
          ? `${shortDept(worstD.department)} below 5% threshold. Either lift price by 8-10% or cut delivery cost — confirm direction within 6 weeks.`
          : `Spread is manageable. Drive bottom-quartile toward median through productivity (target +200 bps) in FY ${year + 1}.`,
    })
  }

  return out
}

// ─── 05 · Cost & Profitability ───────────────────────────────────────────────
function costProfInsights(Y, year, rawCost) {
  const { costByType, byDept } = Y
  const out = []

  const total = costByType.reduce((s, c) => s + c.actual, 0)
  const pex   = costByType.find((c) => c.type === 'PEX')
  const opex  = costByType.find((c) => c.type === 'OPEX')
  const capex = costByType.find((c) => c.type === 'CAPEX')

  if (pex && total > 0) {
    const pexPct    = r1((pex.actual / total) * 100)
    const pexVarF2  = r2(pex.actual - pex.fc2)
    const pexCausal = Object.values(CAUSAL_NOTES[year]?.cost || {}).find((v) => v.type === 'PEX')?.note
    out.push({
      severity: pexVarF2 > 1.5 ? 'warn' : pexVarF2 < -1.5 ? 'good' : 'info',
      tag:   'PEX Composition',
      title: `Personnel is ${pexPct}% of total cost — ${pexVarF2 > 0 ? '₹' + pexVarF2.toFixed(1) + ' Cr above FC2' : '₹' + Math.abs(pexVarF2).toFixed(1) + ' Cr below FC2'}`,
      reason: pexCausal
        ? pexCausal
        : pexPct > 65
          ? `PEX ₹${pex.actual.toFixed(1)} Cr — heavy personnel base. Headcount growth must trail revenue growth by 3-5 ppt to protect margin in FY ${year + 1}.`
          : `PEX ₹${pex.actual.toFixed(1)} Cr — operational leverage is healthy. Maintain current ratio while scaling.`,
    })
  }

  if (opex && total > 0) {
    const opexPct    = r1((opex.actual / total) * 100)
    const opexVarF2  = r2(opex.actual - opex.fc2)
    const opexCausal = Object.values(CAUSAL_NOTES[year]?.cost || {}).find((v) => v.type === 'OPEX')?.note
    out.push({
      severity: opexVarF2 > 1 ? 'warn' : opexVarF2 < -1 ? 'good' : 'info',
      tag:   'OPEX Variance',
      title: opexVarF2 > 0
        ? `OPEX is ${opexPct}% of total — ₹${opexVarF2.toFixed(1)} Cr above FC2`
        : `OPEX is ${opexPct}% of total — ₹${Math.abs(opexVarF2).toFixed(1)} Cr below FC2`,
      reason: opexCausal
        ? opexCausal
        : opexVarF2 > 1
          ? `OPEX ₹${opex.actual.toFixed(1)} Cr (FC2 ₹${opex.fc2.toFixed(1)}). Discretionary lines (consulting, IT, travel) are typically the swing items — tighten approval thresholds for FY ${year + 1}.`
          : `OPEX ₹${opex.actual.toFixed(1)} Cr — running below plan. Verify service quality is intact before declaring efficiency.`,
    })
  }

  if (capex) {
    const capexDefer = r2(capex.fc2 - capex.actual)
    out.push({
      severity: capexDefer > 1 ? 'plan' : 'info',
      tag:   'CAPEX Deferral',
      title: capexDefer > 0.5
        ? `CAPEX under-spent ₹${capexDefer.toFixed(1)} Cr vs FC2 — refresh deferred`
        : `CAPEX on track at ₹${capex.actual.toFixed(1)} Cr vs FC2 ₹${capex.fc2.toFixed(1)} Cr`,
      reason: capexDefer > 0.5
        ? `Carry-forward ₹${capexDefer.toFixed(1)} Cr into FY ${year + 1} Q1; reassess depreciation timeline. Flag operational risk where infrastructure refresh is delayed (uptime SLAs, security patches).`
        : `Capital deployment is on schedule — no carry-forward action needed.`,
    })
  }

  if (byDept.length >= 2) {
    const sorted = [...byDept].sort((a, b) => b.margin - a.margin)
    const bestD  = sorted[0]
    const worstD = sorted[sorted.length - 1]
    out.push({
      severity: worstD.margin < 5 ? 'warn' : 'info',
      tag:   'Department Profitability',
      title: `${bestD.department.split('(')[0].trim()} top at ${bestD.margin}% · ${worstD.department.split('(')[0].trim()} lags at ${worstD.margin}%`,
      reason: worstD.margin < 0
        ? `${shortDept(worstD.department)} burned ₹${Math.abs(worstD.ebit).toFixed(1)} Cr — initiate scope reset or managed exit before FY ${year + 1}.`
        : worstD.margin < 5
          ? `${shortDept(worstD.department)} below 5% — single re-pricing decision can move the FY ${year + 1} P&L by ₹${r2(worstD.revAct * 0.05).toFixed(1)} Cr.`
          : `Drive lagging departments to median margin via productivity programmes (~200 bps target).`,
    })
  }

  return out
}

// ─── 06 · Driver Waterfall ───────────────────────────────────────────────────
function waterfallInsights(Y, year, rawCost) {
  const { costByType, kpis } = Y
  const causal = CAUSAL_NOTES[year]
  const out = []

  const costVarF2 = r2(kpis.totalCost - kpis.costFc2)
  const overrun = biggestMonthlyOverrun(rawCost, year, null)

  out.push({
    severity: costVarF2 > 2 ? 'warn' : costVarF2 < -2 ? 'good' : 'info',
    tag:   'Cost Bridge · FY Total',
    title: costVarF2 > 0
      ? `Total cost overran FC2 by ₹${costVarF2.toFixed(1)} Cr`
      : `Total cost saved ₹${Math.abs(costVarF2).toFixed(1)} Cr vs FC2`,
    reason: overrun
      ? `Concentrated in ${overrun.month}: ₹${overrun.actual.toFixed(1)} Cr actual vs ₹${overrun.fc2.toFixed(1)} Cr FC2 (+₹${overrun.diff.toFixed(1)} Cr — that one month is ${r1((overrun.diff / Math.max(Math.abs(costVarF2), 0.01)) * 100)}% of the full-year variance). Strip out one-offs from FY ${year + 1} baseline; permanent items only.`
      : `Actual ₹${kpis.totalCost.toFixed(1)} Cr vs FC2 ₹${kpis.costFc2.toFixed(1)} Cr. Variance within tolerance — controls functioning.`,
  })

  const sorted = [...costByType].sort((a, b) => (b.actual - b.fc2) - (a.actual - a.fc2))
  const topOver  = sorted[0]
  const topSave  = sorted[sorted.length - 1]

  if (topOver && topOver.actual - topOver.fc2 > 0.3) {
    const overNote = causal?.cost ? Object.values(causal.cost).find((v) => v.type === topOver.type)?.note : null
    const diff = r2(topOver.actual - topOver.fc2)
    out.push({
      severity: 'warn',
      tag:   `Biggest Overrun · ${topOver.type}`,
      title: `${topOver.type} overran FC2 by ₹${diff.toFixed(1)} Cr — primary cost driver`,
      reason: overNote
        ? overNote
        : topOver.type === 'PEX'
          ? `Headcount additions or salary revisions exceeded plan. Pause net hiring until revenue per FTE returns to plan.`
          : topOver.type === 'OPEX'
            ? `Variable spend exceeded plan — tighten discretionary approval thresholds (consulting, IT, travel) and demand business-case sign-off above ₹50 lakh.`
            : `Capital spend exceeded plan — review project approvals and procurement controls before FY ${year + 1} budget lock.`,
    })
  }

  if (topSave && topSave.actual - topSave.fc2 < -0.3) {
    const saveDiff = r2(topSave.fc2 - topSave.actual)
    out.push({
      severity: 'good',
      tag:   `Cost Saving · ${topSave.type}`,
      title: `${topSave.type} delivered ₹${saveDiff.toFixed(1)} Cr below FC2`,
      reason: topSave.type === 'CAPEX'
        ? `Equipment refresh deferred — model the depreciation and cash-flow impact into FY ${year + 1} Q1.`
        : `Confirm if savings are structural (process efficiency, volume leverage) or timing — only structural savings should lower the FY ${year + 1} baseline.`,
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
    const topPct = r1((top.total / Math.max(Math.abs(allEBIT), 0.01)) * 100)
    out.push({
      severity: topPct > 40 ? 'info' : 'good',
      tag:   `Top Customer · ${top.department}`,
      title: `${top.department} delivers ${topPct}% of customer EBIT (₹${top.total.toFixed(1)} Cr)`,
      reason: topPct > 40
        ? `Concentration risk — losing or repricing this account hits the P&L disproportionately. Lock multi-year terms; build a relationship-risk scorecard.`
        : `Customer base is well distributed — resilient to single-account churn.`,
    })
  }

  const lossCust = ebitCustomerMatrix.filter((d) => d.total < 0)
  if (lossCust.length > 0) {
    out.push({
      severity: 'warn',
      tag:   'Loss-Making Customers',
      title: `${lossCust.length} customer${lossCust.length > 1 ? 's' : ''} negative EBIT: ${lossCust.map((d) => d.department).join(', ')}`,
      reason: `These accounts consume margin from profitable ones. Run cost-to-serve audit, re-rate or initiate managed exit before FY ${year + 1}.`,
    })
  } else {
    out.push({
      severity: 'good',
      tag:   'Customer Profitability · Clean',
      title: `All ${ebitCustomerMatrix.length} customers contributed positive EBIT in FY ${year}`,
      reason: `Strong base. Build customer-level EBIT targets into FY ${year + 1} scorecards and run quarterly account-profitability reviews.`,
    })
  }

  return out
}

// ─── 08 · Cost Analysis ──────────────────────────────────────────────────────
function costAnalysisInsights(Y, year, rawCost) {
  const { monthly, costByType } = Y
  const causal = CAUSAL_NOTES[year]
  const out = []

  const validMonths = monthly.filter((m) => m.costAct > 0)

  // Biggest single-month OPEX overrun
  const opexOverrun = biggestMonthlyOverrun(rawCost, year, 'OPEX')
  if (opexOverrun && opexOverrun.diff > 0.2) {
    const note = causal?.cost?.[opexOverrun.month]?.note
    out.push({
      severity: opexOverrun.diff > 1.5 ? 'warn' : 'info',
      tag:   `OPEX Spike · ${opexOverrun.month}`,
      title: `${opexOverrun.month} OPEX overran FC2 by ₹${opexOverrun.diff.toFixed(1)} Cr — biggest single-month spike`,
      reason: note
        ? note + ` Strip the one-time portion from the FY ${year + 1} baseline.`
        : `Actual ₹${opexOverrun.actual.toFixed(1)} Cr vs FC2 ₹${opexOverrun.fc2.toFixed(1)} Cr. Identify the sub-category driver (consulting / IT / facility) and classify as one-time vs recurring.`,
    })
  } else if (validMonths.length >= 6) {
    const midpoint = Math.floor(validMonths.length / 2)
    const h1Avg = r2(validMonths.slice(0, midpoint).reduce((s, m) => s + m.costAct, 0) / midpoint)
    const h2Avg = r2(validMonths.slice(midpoint).reduce((s, m) => s + m.costAct, 0) / (validMonths.length - midpoint))
    const trend = r1(((h2Avg - h1Avg) / Math.max(h1Avg, 0.01)) * 100)
    out.push({
      severity: trend > 10 ? 'warn' : trend < -5 ? 'good' : 'info',
      tag:   'H1 → H2 Cost Trend',
      title: trend > 0
        ? `H2 cost run-rate is ${trend}% higher than H1 — accelerating spend`
        : `H2 cost run-rate fell ${Math.abs(trend)}% vs H1 — discipline tightening`,
      reason: `H1 avg ₹${h1Avg.toFixed(1)} Cr/month → H2 ₹${h2Avg.toFixed(1)} Cr/month. ${trend > 10 ? `Investigate before FY ${year + 1} budget lock — separate headcount, discretionary, and one-offs.` : `Use the H2 run-rate as the FY ${year + 1} starting baseline.`}`,
    })
  }

  // OPEX annual variance with causal note
  const opex = costByType.find((c) => c.type === 'OPEX')
  if (opex) {
    const varF2 = r2(opex.actual - opex.fc2)
    const note  = causal?.cost ? Object.values(causal.cost).find((v) => v.type === 'OPEX')?.note : null
    out.push({
      severity: varF2 > 0.5 ? 'warn' : varF2 < -0.5 ? 'good' : 'info',
      tag:   'OPEX · FY Variance',
      title: varF2 > 0
        ? `OPEX overran FC2 by ₹${varF2.toFixed(1)} Cr for the full year`
        : `OPEX came in ₹${Math.abs(varF2).toFixed(1)} Cr below FC2 — full-year saving`,
      reason: note
        ? note
        : `OPEX ₹${opex.actual.toFixed(1)} Cr (FC1 ₹${opex.fc1.toFixed(1)} / FC2 ₹${opex.fc2.toFixed(1)}). ${varF2 > 0 ? 'Tighten discretionary cost approval flow; demand business case above ₹50 lakh.' : 'Verify service quality is intact before treating savings as structural.'}`,
    })
  }

  // Peak cost month
  if (validMonths.length > 0) {
    const peak    = validMonths.reduce((p, m) => m.costAct > p.costAct ? m : p, validMonths[0])
    const peakVar = r2(peak.costAct - peak.costFc2)
    const note    = causal?.cost?.[peak.month]?.note
    out.push({
      severity: peak.costAct > peak.costFc2 ? 'warn' : 'info',
      tag:   `Peak Cost · ${peak.month}`,
      title: `${peak.month} was the most expensive month at ₹${peak.costAct.toFixed(1)} Cr — ${peak.costAct > peak.costFc2 ? '₹' + peakVar.toFixed(1) + ' Cr above FC2' : 'within FC2'}`,
      reason: note
        ? note
        : `FC1 ₹${peak.costFc1.toFixed(1)} Cr · FC2 ₹${peak.costFc2.toFixed(1)} Cr · Actual ₹${peak.costAct.toFixed(1)} Cr. ${peak.costAct > peak.costFc2 ? `Both forecasts underestimated this month — revise the FY ${year + 1} seasonality profile.` : `Peak within forecast — planning accuracy on track for seasonal patterns.`}`,
    })
  }

  return out
}
