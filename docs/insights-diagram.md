# Section Insights — structure and display conditions

This file contains a Mermaid diagram of the section insights and an ASCII fallback if your viewer doesn't render Mermaid.

## Mermaid diagram

```mermaid
flowchart LR
  Inputs[[Inputs: derived, rawRevenue, rawCost, serviceRevenue, period selection]]
  GS[getSectionInsights(section, ctx)]
  Inputs --> GS

  GS --> PL["section = pl"]
  GS --> M["section = monthly"]
  GS --> SR["section = service-revenue"]
  GS --> ED["section = ebit-dept"]
  GS --> CP["section = cost-prof"]
  GS --> WF["section = waterfall"]
  GS --> EC["section = ebit-customer"]n  
  GS --> CA["section = cost-analysis"]

  subgraph PL_block [PL insights (plInsights)]
    PL_NP["Net Result vs FC2 — (always)"]
    PL_REV["Revenue vs FC2 — (always)"]
    PL_COST["Total Cost vs FC2 — (always)"]
  end
  PL --> PL_block

  subgraph M_block [Monthly insights (monthlyInsights)]
    M_best["Strongest month — needs >=1 month"]
    M_worst["Softest month — needs >=1 month"]
    M_avg["Average month — needs >=2 months; counts months where npAct >= npFc2"]
  end
  M --> M_block

  subgraph SR_block [Service revenue (serviceRevenueInsights)]
    SR_total["Total service revenue + top dept — requires SRY.byDept"]
    SR_mix["FTE vs Transaction mix — requires SRY"]
    SR_momentum["H1 vs H2 momentum — requires monthly.length >= 4"]
  end
  SR --> SR_block

  subgraph ED_block [Dept EBIT (ebitDeptInsights)]
    ED_top["Top EBIT contributor — requires ebitMatrix.length>0"]
    ED_marginRange["Margin spread — requires byDept.length>=2"]
    ED_lossCells["Loss-cell summary — returns warn/good based on losses"]
  end
  ED --> ED_block

  subgraph CP_block [Cost & Profit (costProfInsights)]
    CP_pex["PEX card — if PEX exists"]
    CP_opex["OPEX card — if OPEX exists"]
    CP_capex["CAPEX card — if CAPEX exists"]
    CP_deptMargins["Dept margins — if byDept.length>=2"]
  end
  CP --> CP_block

  subgraph WF_block [Waterfall (waterfallInsights)]
    WF_total["Total cost vs FC2 — (always)"]
    WF_over["Largest Overrun — if topOver.actual - topOver.fc2 > 0.3"]
    WF_save["Largest Saving — if topSave.actual - topSave.fc2 < -0.3"]
  end
  WF --> WF_block

  subgraph EC_block [Customer EBIT (ebitCustomerInsights)]
    EC_top["Top customer — requires ebitCustomerMatrix.length>0"]
    EC_lossCust["Loss-making customers — if any total<0"]
    EC_marginSpread["Customer margin spread — if enough customers and gap>5ppt"]
  end
  EC --> EC_block

  subgraph CA_block [Cost Analysis (costAnalysisInsights)]
    CA_peak["Peak cost month — requires monthly.length>0"]
    CA_h1h2["H1 vs H2 trajectory — requires monthly.length>=6"]
    CA_opex["OPEX vs forecast — if opex exists"]
  end
  CA --> CA_block

  classDef cond fill:#f8f9fa,stroke:#666,stroke-width:1px
  class PL_block,M_block,SR_block,ED_block,CP_block,WF_block,EC_block,CA_block cond
```

## ASCII fallback

Inputs -> getSectionInsights(section, ctx)
  - section: 'pl' -> plInsights
    - Net Result vs FC2 (always)
    - Revenue vs FC2 (always)
    - Total Cost vs FC2 (always)
  - section: 'monthly' -> monthlyInsights
    - Strongest month (≥1 month)
    - Softest month (≥1 month)
    - Average month (≥2 months) — counts months where `npAct >= npFc2` (note: for negative NP this means "smaller loss")
  - section: 'service-revenue' -> serviceRevenueInsights
    - Total service revenue + top dept (if SRY.byDept)
    - FTE vs Transaction mix
    - H1 vs H2 momentum (if >=4 months)
  - section: 'ebit-dept' -> ebitDeptInsights
    - Top EBIT contributor
    - Margin spread (if >=2 depts)
    - Loss-cell summary
  - section: 'cost-prof' -> costProfInsights
    - PEX/OPEX/CAPEX cards (if data present)
    - Dept margins
  - section: 'waterfall' -> waterfallInsights
    - Total cost vs FC2
    - Largest Overrun / Largest Saving (thresholds)
  - section: 'ebit-customer' -> ebitCustomerInsights
    - Top customer / Loss-making customers / Margin spread
  - section: 'cost-analysis' -> costAnalysisInsights
    - Peak cost month / H1 vs H2 / OPEX vs forecast

## Where the logic lives

- Main router: `src/utils/sectionInsights.js` — functions for each section (plInsights, monthlyInsights, etc.)
- Data inputs: `derived` (from `computeDerived`), `rawRevenue`, `rawCost`, `serviceRevenue`

## How to view the Mermaid diagram

- In VS Code: open this file and use Markdown Preview (Ctrl+Shift+V). If Mermaid doesn't render, install an extension such as "Markdown Preview Enhanced" or "Markdown Preview Mermaid Support".
- If you want, I can also export a PNG/SVG of the diagram into `docs/` and add it to the repo.

---

File created by the diagnostics assistant. Let me know if you want the diagram exported to PNG/SVG or if you'd like per-card details expanded into a table.