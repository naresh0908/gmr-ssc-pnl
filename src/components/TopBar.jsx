import { Sun, Moon } from 'lucide-react'
import { useDashStore } from '../store/useDashStore'
import GMRLogo from '../GMR_Group_(logo).svg'

export default function TopBar() {
  const { year, setYear, theme, toggleTheme, derived } = useDashStore()

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6 pb-3 md:pb-5 border-b border-[var(--line)]">
      <div className="flex items-center gap-2 md:gap-3.5 min-w-0">
        <img src={GMRLogo} alt="GMR Group" className="hidden md:block h-12 w-auto flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="m-0 font-display font-bold text-[16px] md:text-[20px] tracking-tight truncate" style={{ color: '#003974' }}>
            Shared Services Center
          </h1>
          <p className="m-0 mt-0.5 text-[10px] md:text-[12.5px] text-[var(--muted)] tracking-wider uppercase">
            Decision Cockpit · CEO View
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
        {derived.years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-full text-[11px] md:text-[12.5px] font-medium border transition ${
              y === year
                ? 'bg-ink text-bg-light border-ink'
                : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'
            }`}
          >
            FY {y}
          </button>
        ))}

        <button
          onClick={toggleTheme}
          className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[var(--card)] border border-[var(--line)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition flex-shrink-0"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={14} className="md:w-4 md:h-4" /> : <Sun size={14} className="md:w-4 md:h-4" />}
        </button>
      </div>
    </div>
  )
}
