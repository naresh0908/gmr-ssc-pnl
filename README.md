# GMR SSC · Financial Decision Intelligence Dashboard

A React-based decision intelligence dashboard for GMR SSC Finance. Not just reporting — every metric answers _what happened, why, what changed vs plan, where to act_.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## What's inside

```
src/
├── App.jsx                      # Layout shell — section ordering
├── main.jsx
├── index.css                    # Tailwind + CSS variables for theming
│
├── store/
│   └── useDashStore.js          # Zustand store — single source of truth
│
├── utils/
│   ├── parseExcel.js            # XLSX → normalized rows
│   ├── computeDerived.js        # KPIs, monthly, dept, EBIT matrix, cost types
│   └── generateInsights.js      # Rule-based insight engine (LLM-swappable)
│
├── data/
│   └── sampleData.js            # Bundled GMR Excel data for first render
│
└── components/
    ├── TopBar.jsx
    ├── FileUploader.jsx         # Excel upload → state refresh
    ├── HeroSummary.jsx          # Executive verdict
    ├── KPISection.jsx           # 5 KPI cards
    ├── EBITMatrix.jsx           # ⬅ Month × Department EBIT heatmap (above Monthly)
    ├── MonthlyPerformance.jsx   # Horizontal bar table + NP Ratio legend
    ├── CostStructure.jsx        # PEX / OPEX / CAPEX
    ├── DeptEBITPanel.jsx        # Department EBIT ranking
    ├── DeptWaterfall.jsx        # ⬅ Per-department FC1 → FC2 → Actual waterfall
    ├── InsightsPanel.jsx        # AI insights
    └── SectionHead.jsx
```

## Section order (top → bottom)

1. TopBar — year toggle, dept filter, theme toggle, Excel upload
2. Hero Summary — narrative + executive verdict
3. KPI Row — Revenue / Cost / Net Profit / Margin / YoY
4. **EBIT Matrix** (Month × Department) — heatmap, FY total per dept
5. **Monthly Performance** — horizontal Above/Below Target bars + Net Profit Ratio legend
6. Cost Structure + Dept EBIT (side by side)
7. **Department-wise Cost Waterfall** — switch dept via chip selector
8. AI Insights Panel — rule-based, LLM-ready

## Excel format expected

Two sheets:

**Revenue_2024_2025**
| Year | Month | Department | FC1_ServiceFees | FC2_ServiceFees | Actual_ServiceFees | FC1_OtherIncome | FC2_OtherIncome | Actual_OtherIncome | FC1_Interest | FC2_Interest | Actual_Interest | FC1_Tax | FC2_Tax | Actual_Tax | Comments |

**Cost_2024_2025**
| Year | Month | Department | Cost_Type | Sub_Category | FC1 | FC2 | Actual | Comments |

`Cost_Type` ∈ { PEX, OPEX, CAPEX }
`Comments` is optional but powers the insight engine when present.

## Swapping the rule engine for an LLM

`src/utils/generateInsights.js` is a single pure function:

```js
export function generateInsights(derived, year) { /* rules → insights */ }
```

Replace the body with an API call. Same return shape, no other file changes needed.

## Theming

CSS variables in `index.css` driven by a `.dark` class on `<html>`. Theme toggle is in TopBar (Sun/Moon icon).

## Known constraints

- All money values are converted to **crores (₹ Cr)** at the derive layer for display readability.
- Monthly Performance uses fixed axis caps (`REV_AXIS=22 Cr`, `NP_AXIS=2.5 Cr`) — adjust in `MonthlyPerformance.jsx` if your data scales differ.
- `Comments` field is parsed but not yet surfaced — wire it into `generateInsights` when populated.
