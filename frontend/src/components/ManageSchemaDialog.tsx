import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from './ui/dialog'
import Alert from './Alert'

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
            <button className="rounded bg-primary text-white px-2 py-1 text-xs">Close</button>
          </DialogClose>
        </DialogHeader>
        {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
        <div className="grid gap-4 md:grid-cols-2 h-[calc(80vh-64px)]">
          <div className="border border-gray-200 bg-white rounded p-3 overflow-auto">
            <div className="text-sm font-medium mb-2">Columns & Types</div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-2 py-1 border-b">Column</th>
                  <th className="text-left px-2 py-1 border-b">Type</th>
                  <th className="text-left px-2 py-1 border-b">Sample</th>
                  <th className="text-left px-2 py-1 border-b">Required</th>
                </tr>
              </thead>
              <tbody>
                {columns.map(col => (
                  <tr key={col} className="odd:bg-gray-50">
                    <td className="px-2 py-1 border-b font-mono">{col}</td>
                    <td className="px-2 py-1 border-b">
                      <select className="border border-gray-300 rounded px-2 py-1" value={(properties[col]?.type) || 'string'} onChange={e=> updateType(col, e.target.value)}>
                        {typeOptions.map(t=> <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1 border-b text-gray-600">{String(sampleRow?.[col] ?? '')}</td>
                    <td className="px-2 py-1 border-b">
                      <input type="checkbox" checked={required.includes(col)} onChange={()=> toggleRequired(col)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-gray-200 bg-white rounded p-3 flex flex-col">
            <div className="text-sm font-medium mb-2">Business Rules</div>
            <textarea className="w-full border border-gray-300 rounded px-2 py-1 font-mono text-xs flex-1" value={rulesText} onChange={e=> setRulesText(e.target.value)} />
            <div className="text-xs text-gray-500 mt-2">Examples: [{`{ "type": "required", "columns": ["id","name"] }`}] or [{`{ "type": "unique", "column": "id" }`}]</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" disabled={saving} onClick={onSaveClick}>Save</button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=> onOpenChange(false)}>Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
