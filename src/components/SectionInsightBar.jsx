import { TrendingDown, CheckCircle2, Info, RotateCw } from 'lucide-react'

const SEV = {
  warn: { bar: 'border-l-[3px] border-l-brand-red',   icon: 'text-brand-red   bg-brand-red-soft',   Icon: TrendingDown },
  good: { bar: 'border-l-[3px] border-l-brand-green', icon: 'text-brand-green bg-brand-green-soft', Icon: CheckCircle2 },
  info: { bar: 'border-l-[3px] border-l-brand-amber', icon: 'text-brand-amber bg-brand-amber-soft', Icon: Info },
  plan: { bar: 'border-l-[3px] border-l-brand-blue',  icon: 'text-brand-blue  bg-blue-100',         Icon: RotateCw },
}

export default function SectionInsightBar({ insights }) {
  if (!insights?.length) return null
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {insights.map((ins, i) => {
        const s = SEV[ins.severity] || SEV.info
        const Icon = s.Icon
        return (
          <div
            key={i}
            className={`bg-[var(--card)] border border-[var(--line)] ${s.bar} rounded-[10px] p-3.5 flex gap-3 items-start hover:shadow-sm transition-shadow`}
          >
            <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 mt-0.5 ${s.icon}`}>
              <Icon size={13} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9.5px] tracking-[.16em] uppercase font-bold text-[var(--muted)] mb-0.5">{ins.tag}</div>
              <div className="text-[12.5px] font-semibold text-[var(--ink)] leading-[1.35]">{ins.title}</div>
              <div className="text-[11px] text-[var(--ink-soft)] mt-1 leading-[1.5]">{ins.reason}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
