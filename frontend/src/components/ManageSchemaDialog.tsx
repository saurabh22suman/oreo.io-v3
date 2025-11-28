import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from './ui/dialog'
import Alert from './Alert'
import { Loader2 } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  file?: File | null
  // Existing schema/rules (JSON strings or objects)
  initialSchema?: any
  initialRules?: any
  // Sample data to show one value per column
  sample?: { data: any[]; columns: string[] }
  onSave: (schema: any, rules: any) => Promise<void> | void
}

const typeOptions = ['string','integer','number','boolean','object','array'] as const

export default function ManageSchemaDialog({ open, onOpenChange, file, initialSchema, initialRules, sample, onSave }: Props){
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // build editable schema model
  const initProps = useMemo(()=>{
    try{
      const s = typeof initialSchema === 'string' ? JSON.parse(initialSchema) : (initialSchema || {})
      return s?.properties || {}
    }catch{ return {} }
  }, [initialSchema])
  const [properties, setProperties] = useState<Record<string, any>>(initProps)
  const [required, setRequired] = useState<string[]>(()=>{
    try{ const s = typeof initialSchema === 'string' ? JSON.parse(initialSchema) : (initialSchema || {}); return s?.required || [] }catch{ return [] }
  })
  const [rulesText, setRulesText] = useState(()=> typeof initialRules === 'string' ? initialRules : JSON.stringify(initialRules || [], null, 2))

  useEffect(()=>{ if(open){ setError('') } }, [open])

  const columns = useMemo(()=>{
    if(sample?.columns?.length) return sample.columns
    return Object.keys(properties)
  }, [sample?.columns, properties])

  const sampleRow = sample?.data?.[0] || {}

  const toggleRequired = (col: string)=>{
    setRequired(prev => prev.includes(col) ? prev.filter(c=>c!==col) : [...prev, col])
  }

  const updateType = (col: string, typ: string)=>{
    setProperties(prev => ({...prev, [col]: { ...(prev[col]||{}), type: typ }}))
  }

  const onSaveClick = async()=>{
    setError(''); setSaving(true)
    try{
      // Build schema object
      const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties, ...(required.length? { required } : {}) }
      let rules: any
      try{ rules = rulesText?.trim()? JSON.parse(rulesText) : [] }catch(e:any){ throw new Error('Invalid rules JSON') }
      await onSave(schema, rules)
      onOpenChange(false)
    }catch(e:any){ setError(e.message || 'Failed to save') } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-[92vw] h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage schema{file? ` for ${file.name}`: ''}</DialogTitle>
          <DialogDescription className="sr-only">Review column types, mark required, and define business rules</DialogDescription>
          <DialogClose asChild>
            <button className="btn btn-secondary btn-sm">Close</button>
          </DialogClose>
        </DialogHeader>
        {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
        <div className="grid gap-4 md:grid-cols-2 h-[calc(80vh-64px)]">
          <div className="border border-divider bg-surface-1 rounded-card p-4 overflow-auto">
            <div className="text-sm font-semibold mb-3 text-text">Columns & Types</div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-surface-2">
                  <th className="text-left px-3 py-2 border-b border-divider text-text-secondary font-semibold">Column</th>
                  <th className="text-left px-3 py-2 border-b border-divider text-text-secondary font-semibold">Type</th>
                  <th className="text-left px-3 py-2 border-b border-divider text-text-secondary font-semibold">Sample</th>
                  <th className="text-left px-3 py-2 border-b border-divider text-text-secondary font-semibold">Required</th>
                </tr>
              </thead>
              <tbody>
                {columns.map(col => (
                  <tr key={col} className="odd:bg-surface-2/50 hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-2 border-b border-divider font-mono text-text">{col}</td>
                    <td className="px-3 py-2 border-b border-divider">
                      <select className="select text-xs py-1.5" value={(properties[col]?.type) || 'string'} onChange={e=> updateType(col, e.target.value)}>
                        {typeOptions.map(t=> <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-b border-divider text-text-secondary">{String(sampleRow?.[col] ?? '')}</td>
                    <td className="px-3 py-2 border-b border-divider">
                      <input type="checkbox" className="w-4 h-4 rounded border-divider bg-surface-2 text-primary focus:ring-primary/50" checked={required.includes(col)} onChange={()=> toggleRequired(col)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-divider bg-surface-1 rounded-card p-4 flex flex-col">
            <div className="text-sm font-semibold mb-3 text-text">Business Rules</div>
            <textarea className="textarea font-mono text-xs flex-1" value={rulesText} onChange={e=> setRulesText(e.target.value)} />
            <div className="text-xs text-text-muted mt-2">Examples: [{`{ "type": "required", "columns": ["id","name"] }`}] or [{`{ "type": "unique", "column": "id" }`}]</div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="btn btn-primary" disabled={saving} onClick={onSaveClick}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save'}
          </button>
          <button className="btn btn-secondary" onClick={()=> onOpenChange(false)}>Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
