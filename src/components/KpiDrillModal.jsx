import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useDashStore } from '../store/useDashStore'
import { getAvailMonths, getActivePeriodMonths, getPeriodLabel } from '../utils/periodUtils'

const CR = 1e7

const fmtRupee = (v) => {
  if (v == null || Number.isNaN(v)) return '–'
  const n = Number(v)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100) return `${sign}₹${abs.toFixed(0)} Cr`
  if (abs >= 1)   return `${sign}₹${abs.toFixed(2)} Cr`
  return `${sign}₹${abs.toFixed(2)} Cr`
}

const STATUS_STYLE = {
  Released:  { bg: '#DCFCE7', fg: '#166534' },
  Started:   { bg: '#DBEAFE', fg: '#1E40AF' },
  Completed: { bg: '#EDE9FE', fg: '#5B21B6' },
  Closed:    { bg: '#E5E7EB', fg: '#374151' },
}

export default function KpiDrillModal({ metric, onClose }) {
  const { rawRevenue, rawCost, year, fromMonth, toMonth } = useDashStore()

  const availMonths  = useMemo(() => getAvailMonths(rawRevenue, year), [rawRevenue, year])
  const activeMonths = useMemo(
    () => getActivePeriodMonths(fromMonth, toMonth, availMonths),
    [fromMonth, toMonth, availMonths]
  )
  const periodLabel = getPeriodLabel(fromMonth, toMonth, year)

  const rows = useMemo(() => {
    const map = new Map()
    for (const r of rawRevenue) {
      if (r.year !== year || !activeMonths.includes(r.month)) continue
      const key = `${r.customer}||${r.department}`
      if (!map.has(key)) {
        map.set(key, {
          customer:   r.customer || '–',
          department: r.department || '–',
          status:     r.projectStatus || '–',
          revenue:    0,
          cost:       0,
        })
      }
      const e = map.get(key)
      e.revenue += (r.actServiceFees || 0) + (r.actOtherIncome || 0)
      // Prefer the latest non-empty status seen
      if (r.projectStatus) e.status = r.projectStatus
    }
    for (const c of rawCost) {
      if (c.year !== year || !activeMonths.includes(c.month)) continue
      const key = `${c.customer}||${c.department}`
      if (!map.has(key)) {
        map.set(key, {
          customer:   c.customer || '–',
          department: c.department || '–',
          status:     c.projectStatus || '–',
          revenue:    0,
          cost:       0,
        })
      }
      const e = map.get(key)
      e.cost += (c.actual || 0)
    }
    return [...map.values()].map((e) => {
      const revenue = e.revenue / CR
      const cost    = e.cost / CR
      const margin  = revenue - cost
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
      return {
        customer: e.customer,
        department: e.department,
        status: e.status,
        revenue: +revenue.toFixed(2),
        cost:    +cost.toFixed(2),
        margin:  +margin.toFixed(2),
        marginPct: +marginPct.toFixed(1),
      }
    })
  }, [rawRevenue, rawCost, year, activeMonths])

  // Default sort by the clicked metric's primary value
  const defaultSortKey = useMemo(() => {
    switch (metric?.key) {
      case 'cost':      return 'cost'
      case 'margin':    return 'margin'
      case 'marginPct': return 'marginPct'
      default:          return 'revenue'
    }
  }, [metric])

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => { setSortKey(defaultSortKey); setSortDir('desc') }, [defaultSortKey])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let arr = rows
    if (q) {
      arr = arr.filter((r) =>
        r.customer.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    }
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av || ''), bs = String(bv || '')
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return arr
  }, [rows, query, sortKey, sortDir])

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const setSort = (key, numeric) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(numeric ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ active, dir }) =>
    !active ? <ChevronsUpDown size={12} className="opacity-40" />
    : dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />

  const cols = [
    { key: 'customer',   label: 'Customer',   numeric: false, align: 'left'  },
    { key: 'department', label: 'Department', numeric: false, align: 'left'  },
    { key: 'status',     label: 'Status',     numeric: false, align: 'left'  },
    { key: 'revenue',    label: 'Revenue',    numeric: true,  align: 'right' },
    { key: 'cost',       label: 'Cost',       numeric: true,  align: 'right' },
    { key: 'margin',     label: 'Margin',     numeric: true,  align: 'right' },
    { key: 'marginPct',  label: 'Margin %',   numeric: true,  align: 'right' },
  ]

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="kpi-drill-backdrop"
        className="fixed inset-0 z-[100] flex items-start justify-center p-4 md:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[1100px] mt-6 md:mt-12 bg-white rounded-[18px] shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100vh - 96px)' }}
        >
          {/* Header */}
          <div
            className="relative px-6 md:px-8 pt-6 pb-5 text-white"
            style={{ background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 60%, #8B5CF6 100%)' }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 md:top-5 md:right-5 w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-white/15 transition"
            >
              <X size={18} />
            </button>
            <h2 className="font-display font-bold text-[20px] md:text-[22px] tracking-tight">
              {metric?.label ?? 'Project Breakdown'} — Project Breakdown
            </h2>
            <p className="text-[12px] md:text-[13px] mt-1 text-white/80">
              {periodLabel} · {rows.length} project{rows.length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Search */}
          <div className="px-6 md:px-8 py-4 border-b border-[var(--line)] bg-white">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any column..."
                className="w-full pl-10 pr-4 py-2.5 text-[13px] md:text-[14px] rounded-[10px] border border-transparent bg-[#F1F5F9] focus:bg-white focus:border-[#C4B5FD] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[12.5px] md:text-[13px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[var(--line)]">
                  <th className="px-3 md:px-4 py-3 text-left text-[10.5px] uppercase tracking-[.14em] font-bold text-[var(--muted)] w-12">#</th>
                  {cols.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => setSort(c.key, c.numeric)}
                      className={`px-3 md:px-4 py-3 text-[10.5px] uppercase tracking-[.14em] font-bold text-[var(--muted)] cursor-pointer select-none hover:text-[var(--ink)] transition ${
                        c.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <span className={`inline-flex items-center gap-1.5 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {c.label}
                        <SortIcon active={sortKey === c.key} dir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length + 1} className="px-6 py-12 text-center text-[var(--muted)]">
                      No matching projects.
                    </td>
                  </tr>
                ) : filtered.map((r, i) => {
                  const s = STATUS_STYLE[r.status] || { bg: '#F1F5F9', fg: '#475569' }
                  return (
                    <tr key={`${r.customer}-${r.department}-${i}`} className="border-b border-[var(--line)] hover:bg-[#F8FAFC] transition">
                      <td className="px-3 md:px-4 py-3 text-[var(--muted)] font-mono">{i + 1}</td>
                      <td className="px-3 md:px-4 py-3 text-[var(--ink)] font-medium">{r.customer}</td>
                      <td className="px-3 md:px-4 py-3 text-[var(--ink-soft)]">{r.department}</td>
                      <td className="px-3 md:px-4 py-3">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: s.bg, color: s.fg }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-3 text-right font-mono text-[var(--ink)]">{fmtRupee(r.revenue)}</td>
                      <td className="px-3 md:px-4 py-3 text-right font-mono text-[var(--ink)]">{fmtRupee(r.cost)}</td>
                      <td className={`px-3 md:px-4 py-3 text-right font-mono font-semibold ${r.margin < 0 ? 'text-brand-red' : 'text-brand-green'}`}>
                        {fmtRupee(r.margin)}
                      </td>
                      <td className={`px-3 md:px-4 py-3 text-right font-mono ${r.marginPct < 0 ? 'text-brand-red' : 'text-[var(--ink)]'}`}>
                        {r.marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 md:px-8 py-3 border-t border-[var(--line)] bg-[#FAFAFC] flex items-center justify-between text-[11.5px] md:text-[12px] text-[var(--muted)]">
            <span>
              Showing <span className="font-semibold text-[var(--ink)]">{filtered.length}</span> of <span className="font-semibold text-[var(--ink)]">{rows.length}</span> records
            </span>
            <span>Click any column header to sort · ESC to close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
