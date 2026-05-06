import { useRef, useState } from 'react'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { useDashStore } from '../store/useDashStore'
import { parseExcel } from '../utils/parseExcel'

export default function FileUploader() {
  const setData = useDashStore((s) => s.setData)
  const inputRef = useRef(null)
  const [status, setStatus] = useState({ kind: 'idle', msg: '' })

  const handleFile = async (file) => {
    if (!file) return
    setStatus({ kind: 'loading', msg: 'Parsing…' })
    try {
      const { revenue, cost } = await parseExcel(file)
      if (!revenue.length || !cost.length) throw new Error('Empty sheets')
      setData(revenue, cost)
      setStatus({ kind: 'ok', msg: `${revenue.length + cost.length} rows loaded` })
      setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 3500)
    } catch (e) {
      setStatus({ kind: 'err', msg: e.message || 'Parse error' })
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status.kind === 'ok' && (
        <span className="text-xs font-mono text-brand-green inline-flex items-center gap-1.5">
          <CheckCircle2 size={14} /> {status.msg}
        </span>
      )}
      {status.kind === 'err' && (
        <span className="text-xs font-mono text-brand-red inline-flex items-center gap-1.5">
          <AlertCircle size={14} /> {status.msg}
        </span>
      )}
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 bg-ink text-bg-light px-4 py-2 rounded-full text-[13px] font-semibold hover:bg-black transition"
      >
        <Upload size={14} />
        {status.kind === 'loading' ? 'Loading…' : 'Upload Excel'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
