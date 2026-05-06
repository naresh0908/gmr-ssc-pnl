import { Sun, Moon } from 'lucide-react'
import { useDashStore } from '../store/useDashStore'
import FileUploader from './FileUploader'
import GMRLogo from '../GMR_Group_(logo).svg'

export default function TopBar() {
  const { year, setYear, theme, toggleTheme, derived, department, setDepartment } = useDashStore()

  return (
    <div className="flex items-center justify-between gap-6 pb-5 border-b border-[var(--line)]">
      <div className="flex items-center gap-3.5">
        <img src={GMRLogo} alt="GMR Group" className="h-12 w-auto" />
        <div>
          <h1 className="m-0 font-display font-bold text-[20px] tracking-tight" style={{ color: '#003974' }}>
            Shared Services Center
          </h1>
          <p className="m-0 mt-0.5 text-[12.5px] text-[var(--muted)] tracking-wider uppercase">
            Decision Cockpit · CEO View
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--card)] border border-[var(--line)] text-[12.5px] text-[var(--ink-soft)] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> Live
        </span>

        {derived.years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-3.5 py-2 rounded-full text-[12.5px] font-medium border transition ${
              y === year
                ? 'bg-ink text-bg-light border-ink'
                : 'bg-[var(--card)] text-[var(--ink-soft)] border-[var(--line)] hover:border-[var(--ink)]'
            }`}
          >
            FY {y}
          </button>
        ))}

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3.5 py-2 rounded-full text-[12.5px] font-medium bg-[var(--card)] border border-[var(--line)] text-[var(--ink-soft)] outline-none cursor-pointer"
        >
          <option value="All">All Departments</option>
          {derived.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-[var(--card)] border border-[var(--line)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <FileUploader />
      </div>
    </div>
  )
}
