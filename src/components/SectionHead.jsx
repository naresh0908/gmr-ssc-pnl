export default function SectionHead({ num, title, children }) {
  return (
    <div className="flex items-end justify-between mb-3.5 gap-4 flex-wrap">
      <h3 className="m-0 font-display font-medium text-[24px] tracking-[-.4px]">
        <span className="font-mono text-[11px] text-[var(--muted)] font-medium mr-2.5 tracking-wider">{num}</span>
        {title}
      </h3>
      {children && <p className="m-0 text-[var(--muted)] text-[12.5px] max-w-[46ch]">{children}</p>}
    </div>
  )
}
