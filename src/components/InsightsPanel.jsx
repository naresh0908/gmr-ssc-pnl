import { useDashStore } from '../store/useDashStore'
import SectionHead from './SectionHead'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, CheckCircle2, RotateCw, AlertTriangle, Info } from 'lucide-react'

const styles = {
  warn: { wrap: 'border-[var(--line)]', icon: 'bg-brand-red-soft text-brand-red',   Icon: TrendingDown },
  good: { wrap: 'border-[var(--line)]', icon: 'bg-brand-green-soft text-brand-green', Icon: CheckCircle2 },
  info: { wrap: 'border-[var(--line)]', icon: 'bg-brand-amber-soft text-brand-amber', Icon: Info },
  plan: { wrap: 'border-[var(--line)]', icon: 'bg-blue-100 text-brand-blue',         Icon: RotateCw }
}

export default function InsightsPanel() {
  const insights = useDashStore((s) => s.insights)

  return (
    <div className="mt-7">
      <SectionHead num="05" title="AI Insights · Why the numbers moved">
        Variance rules combined with comments produce action-grade signals. This module is swappable with an LLM endpoint.
      </SectionHead>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const s = styles[ins.severity] || styles.info
          const Icon = s.Icon
          return (
            <motion.div
              key={ins.kind + i}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className={`bg-[var(--card)] border ${s.wrap} rounded-[14px] p-4 px-5 flex gap-3.5 hover:-translate-y-0.5 hover:border-[var(--ink-soft)] transition`}
            >
              <div className={`w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 ${s.icon}`}>
                <Icon size={16} strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <div className="text-[10.5px] tracking-[.14em] uppercase text-[var(--muted)] font-semibold mb-1">
                  {ins.tag}
                </div>
                <div className="text-[14px] font-semibold text-[var(--ink)] leading-[1.4]">
                  {ins.title}
                </div>
                <div className="text-[12.5px] text-[var(--ink-soft)] mt-1.5 leading-[1.5]">
                  {ins.reason}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {ins.chips.map((c) => (
                    <span key={c} className="text-[11px] px-2 py-1 rounded-md bg-[var(--bg)] text-[var(--ink-soft)] font-medium border border-[var(--line)]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
