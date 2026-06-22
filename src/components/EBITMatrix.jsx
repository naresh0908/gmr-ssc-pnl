import { useMemo } from 'react'
import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import SectionInsightBar from './SectionInsightBar'
import { motion } from 'framer-motion'
import { getSectionInsights } from '../utils/sectionInsights'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

export default function EBITMatrix({ type = 'department', num = '01' }) {
  const { derived, year, fromMonth, toMonth } = useDashStore()
  const rawRevenue = useDashStore((s) => s.rawRevenue)
  const Y = derived.byYear[year]
  const section = type === 'customer' ? 'ebit-customer' : 'ebit-dept'
  const insights = useMemo(() => getSectionInsights(section, { derived, year, fromMonth, toMonth }), [derived, year, section, fromMonth, toMonth])
  if (!Y) return null

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(fromMonth, toMonth, year)

  const fullMatrix = type === 'customer' ? (Y.ebitCustomerMatrix || []) : Y.ebitMatrix
  if (fullMatrix.length === 0) return null

  // Filter cells to active period months and recompute totals
  const matrix = useMemo(() => fullMatrix.map((row) => {
    const cells = row.cells.filter((c) => activeMonths.includes(c.month))
    const total = Math.round(cells.reduce((s, c) => s + c.ebit, 0) * 100) / 100
    return { ...row, cells, total }
  }).filter((row) => row.cells.length > 0).sort((a, b) => b.total - a.total), [fullMatrix, activeMonths])

  if (matrix.length === 0) return null

  const allCells = matrix.flatMap((r) => r.cells.map((c) => c.ebit))
  const max = Math.max(...allCells, 0.01)
  const min = Math.min(...allCells, 0)
  const months = matrix[0]?.cells.map((c) => c.month) || []

  // Column totals (one EBIT figure per month) + grand FY total
  const monthTotals = months.map((m) => ({
    month: m,
    ebit: Math.round(matrix.reduce((s, r) => s + (r.cells.find((c) => c.month === m)?.ebit ?? 0), 0) * 100) / 100,
  }))
  const grandTotal = Math.round(matrix.reduce((s, r) => s + r.total, 0) * 100) / 100

  // Color s cale: amber-soft (low) → green (high), red for negative
  const cellBg = (v) => {
    if (v < 0) {
      const t = Math.min(1, Math.abs(v) / Math.max(0.01, Math.abs(min)))
      return `rgba(192, 57, 43, ${0.15 + t * 0.55})`
    }
    const t = max > 0 ? v / max : 0
    return `rgba(31, 138, 76, ${0.10 + t * 0.55})`
  }
  const cellText = (v) => (v / max > 0.55 || v < 0 ? '#fff' : 'var(--ink)')

  return (
    <div className="mt-7">
      <SectionHead num={num} title={`${type === 'customer' ? 'Customer' : 'Department wise'} EBIT Matrix · ${periodLabel}`}>
        Per-month EBIT contribution (₹ Cr) by {type === 'customer' ? 'customer' : 'service line'}. Hover any cell to see contribution share.
      </SectionHead>

      <div className="flex items-center gap-4 mb-3 px-1 text-[12px] text-[var(--ink-soft)] flex-wrap">
        <span className="font-semibold uppercase tracking-wider text-[10.5px]">EBIT Heat</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ background: 'rgba(192,57,43,.55)' }} /> Loss
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ background: 'rgba(31,138,76,.18)' }} /> Low
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ background: 'rgba(31,138,76,.40)' }} /> Mid
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm" style={{ background: 'rgba(31,138,76,.65)' }} /> High
        </span>
        <span className="ml-auto font-mono text-[var(--muted)]">
          Range: ₹{min.toFixed(2)} → ₹{max.toFixed(2)} Cr
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--card)] border-b border-[var(--line)]">
                <th className="text-left p-3.5 px-4 text-[11px] tracking-[.16em] uppercase text-[var(--ink-soft)] font-semibold sticky left-0 bg-[var(--card)] border-r border-[var(--line)] min-w-[180px]">
                  {type === 'customer' ? 'Customer' : 'Department'}
                </th>
                {months.map((m) => (
                  <th key={m} className="p-3.5 px-3 text-[11px] tracking-[.12em] uppercase text-[var(--ink-soft)] font-semibold text-center border-r border-[var(--line)] last:border-r-0">
                    {m}
                  </th>
                ))}
                <th className="p-3.5 px-3 text-[11px] tracking-[.16em] uppercase text-[var(--ink-soft)] font-semibold text-right bg-[var(--card)] min-w-[90px]">
                  FY Total
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.department} className="border-b border-[var(--line)] last:border-b-0">
                  <td className="p-3 px-4 text-[13px] font-semibold text-[var(--ink)] sticky left-0 bg-[var(--card)] border-r border-[var(--line)]">
                    {row.department}
                  </td>
                  {row.cells.map((c) => (
                    <td
                      key={c.month}
                      className="p-0 border-r border-[var(--line)] last:border-r-0"
                      style={{ background: cellBg(c.ebit) }}
                      title={`${row.department} · ${c.month}: EBIT ₹${c.ebit} Cr (${c.revenue > 0 ? ((c.ebit/c.revenue)*100).toFixed(1) : 0}% margin)`}
                    >
                      <div className="px-2.5 py-3 text-center font-mono text-[12px] font-semibold" style={{ color: cellText(c.ebit) }}>
                        {c.ebit.toFixed(2)}
                      </div>
                    </td>
                  ))}
                  <td className="p-3 px-3 text-right font-mono text-[13px] font-bold text-[var(--ink)] bg-[var(--card)]">
                    ₹{row.total.toFixed(1)}
                  </td>
                </tr>
              ))}
              {/* Column totals row */}
              <tr className="border-t-2 border-[var(--line)] bg-[var(--card)]">
                <td className="p-3 px-4 text-[12px] font-bold uppercase tracking-[.08em] text-[var(--ink)] sticky left-0 bg-[var(--card)] border-r border-[var(--line)]">
                  Total · All {type === 'customer' ? 'Customers' : 'Departments'}
                </td>
                {monthTotals.map((c) => (
                  <td
                    key={c.month}
                    className="p-0 border-r border-[var(--line)] last:border-r-0"
                    style={{ background: cellBg(c.ebit) }}
                    title={`Total EBIT · ${c.month}: ₹${c.ebit} Cr`}
                  >
                    <div className="px-2.5 py-3 text-center font-mono text-[12.5px] font-bold" style={{ color: cellText(c.ebit) }}>
                      {c.ebit.toFixed(2)}
                    </div>
                  </td>
                ))}
                <td className="p-3 px-3 text-right font-mono text-[13.5px] font-bold bg-[var(--ink)] text-white">
                  ₹{grandTotal.toFixed(1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </motion.div>

      <SectionInsightBar insights={insights} />
    </div>
  )
}
