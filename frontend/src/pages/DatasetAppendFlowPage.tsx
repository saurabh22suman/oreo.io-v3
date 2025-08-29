import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, getDataset, previewAppend, appendDatasetDataTop, validateEditedJSONTop, openAppendChangeTop, listMembers } from '../api'
import Alert from '../components/Alert'
import AgGridDialog from '../components/AgGridDialog'

export default function DatasetAppendFlowPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [file, setFile] = useState<File|null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<{id:number; email:string; role:string}[]>([])
  const [submitDialog, setSubmitDialog] = useState(false)
  const [title, setTitle] = useState('Append data')
  const [comment, setComment] = useState('')
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([])
  // detailed validation errors surfaced from backend validate endpoints
  const [validationDetails, setValidationDetails] = useState<any|null>(null)
  // highlight support
  const [invalidRows, setInvalidRows] = useState<number[]>([])
  const [invalidCells, setInvalidCells] = useState<Array<{row:number; column:string}>>([])

  // Build simple type hints from dataset schema to coerce edited values before validation
  const typeMap = useMemo(()=>{
    try{
      const raw = dataset?.schema
      const schema = typeof raw === 'string' ? JSON.parse(raw) : raw
      const props = schema?.properties || {}
      const m: Record<string, string> = {}
      for(const key of Object.keys(props)){
        const t = (props[key]?.type) as any
        if(Array.isArray(t)){
          if(t.includes('integer')) m[key] = 'integer'
          else if(t.includes('number')) m[key] = 'number'
          else if(t.includes('boolean')) m[key] = 'boolean'
          else if(t.includes('string')) m[key] = 'string'
          else if(t.length) m[key] = String(t[0])
        } else if (typeof t === 'string') {
          m[key] = t
        }
      }
      return m
    }catch{ return {} as Record<string,string> }
  }, [dataset])

  function coerceValue(expected: string, val: any){
    if(val === null || val === undefined) return val
    if(typeof val === 'string'){
      const s = val.trim()
      switch(expected){
        case 'integer':
          return /^-?\d+$/.test(s) ? Number(s) : val
        case 'number':
          return /^-?(\d+|\d*\.\d+)$/.test(s) ? Number(s) : val
        case 'boolean':
          if(/^(true|false)$/i.test(s)) return /^true$/i.test(s)
          if(s==='1' || s==='0') return s==='1'
          return val
        default:
          return val
      }
    }
    if(typeof val === 'number'){
      if(expected === 'integer') return Math.trunc(val)
      if(expected === 'boolean') return val !== 0
      return val
    }
    if(typeof val === 'boolean'){
      if(expected === 'integer' || expected === 'number') return val ? 1 : 0
      return val
    }
    return val
  }

  function normalizeRowsBySchema(input: any[]): any[]{
    if(!input || !Array.isArray(input) || !typeMap) return input
    return input.map((row:any)=>{
      const copy: any = { ...row }
      for(const k of Object.keys(typeMap)){
        if(Object.prototype.hasOwnProperty.call(copy, k)){
          copy[k] = coerceValue(typeMap[k], copy[k])
        }
      }
      return copy
    })
  }

  function resetValidationMarks(){
    setInvalidRows([])
    setInvalidCells([])
  }

  function extractValidationMarks(v: any){
    try{
      const badRows = new Set<number>()
      const badCells: Array<{row:number; column:string}> = []
      const se = (v?.schema?.errors || []) as Array<any>
      if(Array.isArray(se)){
        for(const e of se){
          const r = (typeof e?.row === 'number') ? e.row : (typeof e?.instanceIndex === 'number' ? e.instanceIndex : undefined)
          const col = Array.isArray(e?.path) && e.path.length ? String(e.path[0]) : undefined
          if(typeof r === 'number'){
            badRows.add(r)
            if(col) badCells.push({ row: r, column: col })
          }
        }
      }
      const re = (v?.rules?.errors || []) as Array<any>
      if(Array.isArray(re)){
        for(const e of re){
          const col = e?.column ? String(e.column) : undefined
          const rows: number[] = Array.isArray(e?.rows) ? e.rows : []
          for(const r of rows){ if(typeof r === 'number'){ badRows.add(r); if(col) badCells.push({ row: r, column: col }) } }
        }
      }
      setInvalidRows(Array.from(badRows))
      setInvalidCells(badCells)
    }catch{ /* noop */ }
  }

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      setDataset(await getDataset(projectId, dsId))
      const mem = await listMembers(projectId).catch(()=>[])
      setMembers(mem as any[])
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Append new data</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}`} className="text-primary hover:underline">Back: Dataset</Link>
        </div>
      </div>
      {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
      {validationDetails && (
        <Alert
          type="warning"
          message={formatValidationDetails(validationDetails)}
          onClose={()=> setValidationDetails(null)}
        />
      )}
      {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}

      <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
        <div className="flex items-center gap-2">
          <input id="file-app" type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={e=> { setFile(e.target.files?.[0] || null); setRows([]); setCols([]) }} />
          <label htmlFor="file-app" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">Choose file</label>
          <span className="text-xs text-gray-600 max-w-[16rem] truncate">{file? file.name : 'No file selected'}</span>
          <button disabled={!file} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60" onClick={async()=>{
            if(!file) return
            try{
              // If there are staged edits, reopen with them; otherwise fetch fresh preview
              if(rows && rows.length > 0){
                setOpen(true)
                return
              }
              const pv = await previewAppend(projectId, dsId, file, 500, 0)
              setRows(pv.data || []); setCols(pv.columns || [])
              setOpen(true)
            }catch(e:any){ setError(e.message || 'Preview failed') }
          }}>Live edit</button>
          <button disabled={!rows.length} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60" onClick={()=> setOpen(true)}>Preview edited</button>
          <button disabled={!file} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={()=> setSubmitDialog(true)}>Submit change</button>
        </div>
      </div>

      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Edit/Preview: ${file?.name || ''}`}
        rows={rows}
        columns={cols}
        pageSize={100}
        allowEdit
        compact
  invalidRows={invalidRows}
  invalidCells={invalidCells}
  onSave={async(updated)=>{ const normalized = normalizeRowsBySchema(updated); setRows(normalized); setToast('Edits saved locally. They will be validated on Submit.'); resetValidationMarks() }}
      />

      {submitDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-4 w-[520px] shadow">
            <div className="text-sm font-medium mb-2">Submit change</div>
            <div className="grid gap-2">
              <label className="text-xs text-gray-600">Title</label>
              <input className="border border-gray-300 rounded px-3 py-2 text-sm" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Change request title" />
              <label className="text-xs text-gray-600">Comment</label>
              <textarea className="border border-gray-300 rounded px-3 py-2 text-sm" rows={3} placeholder="Add an initial comment (optional)" value={comment} onChange={e=>setComment(e.target.value)} />
              <label className="text-xs text-gray-600">Approvers</label>
              <div className="border border-gray-300 rounded p-2 max-h-40 overflow-auto space-y-1">
                {members.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-primary" checked={selectedReviewerIds.includes(a.id)} onChange={(e)=> setSelectedReviewerIds(prev => e.target.checked ? Array.from(new Set([...prev, a.id])) : prev.filter(x=>x!==a.id))} />
                    <span>{a.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=> setSubmitDialog(false)}>Cancel</button>
              <button disabled={!file || selectedReviewerIds.length===0} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
                if(!file) return
                setError('')
                setValidationDetails(null)
                resetValidationMarks()
                try{
                  // If user edited rows, validate edited JSON; else, validate file upload to create upload_id
                  if(rows.length){
                    const normalized = normalizeRowsBySchema(rows)
                    setRows(normalized)
                    const v = await validateEditedJSONTop(dsId, normalized, (file?.name?.replace(/\.[^.]+$/, '')||'edited')+'.json')
                    if(!v?.ok){
                      setSubmitDialog(false)
                      setError('Validation failed. See details below.')
                      const details = { schema: v?.schema, rules: v?.rules }
                      setValidationDetails(details)
                      extractValidationMarks(details)
                      setOpen(true)
                      return
                    }
                    const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE || '/api'}/datasets/${dsId}/data/append/open`, {
                      method:'POST', headers:{ 'Content-Type':'application/json', ...(localStorage.getItem('token')? { Authorization: `Bearer ${localStorage.getItem('token')}` }: {}) },
                      body: JSON.stringify({ upload_id: v.upload_id, reviewer_ids: selectedReviewerIds, title, comment })
                    })
                    if(res.ok){ setSubmitDialog(false); setToast('Change Request submitted') } else { setSubmitDialog(false); setError('Submit failed') }
                  } else {
                    const v = await appendDatasetDataTop(dsId, file)
                    if(!v?.ok){
                      setSubmitDialog(false)
                      setError('Validation failed. See details below.')
                      const details = { schema: v?.schema, rules: v?.rules }
                      setValidationDetails(details)
                      extractValidationMarks(details)
                      setOpen(true)
                      return
                    }
                    const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE || '/api'}/datasets/${dsId}/data/append/open`, {
                      method:'POST', headers:{ 'Content-Type':'application/json', ...(localStorage.getItem('token')? { Authorization: `Bearer ${localStorage.getItem('token')}` }: {}) },
                      body: JSON.stringify({ upload_id: v.upload_id, reviewer_ids: selectedReviewerIds, title, comment })
                    })
                    if(res.ok){ setSubmitDialog(false); setToast('Change Request submitted') } else { setSubmitDialog(false); setError('Submit failed') }
                  }
                }catch(e:any){ setSubmitDialog(false); setError(e?.message || 'Validation failed') }
              }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Build a readable message from validation payloads returned by backend
function formatValidationDetails(v: any): string {
  if(!v) return ''
  const parts: string[] = []
  // Schema errors from /validate: { valid: false, errors: [{row, path, message, keyword}] }
  if (v.schema && typeof v.schema === 'object') {
    const se = (v.schema.errors || []) as Array<any>
    if (Array.isArray(se) && se.length) {
      const lines = se.slice(0, 50).map((e) => {
        const col = Array.isArray(e?.path) && e.path.length ? String(e.path[0]) : '(root)'
        const row = (typeof e?.row === 'number') ? `row ${e.row+1}` : 'row ?'
        return `Schema: ${row}, column '${col}': ${e?.message || 'invalid'}`
      })
      parts.push(lines.join('\n'))
      if (se.length > 50) parts.push(`…and ${se.length-50} more schema issues`)
    }
  }
  // Rules errors from /rules/validate: { valid: false, errors: [{rule, column, rows, message}] }
  if (v.rules && typeof v.rules === 'object') {
    const re = (v.rules.errors || []) as Array<any>
    if (Array.isArray(re) && re.length) {
      const lines = re.slice(0, 50).map((e) => {
        const col = e?.column || '(unknown)'
        const rows = Array.isArray(e?.rows) ? e.rows.slice(0,5).map((r:any)=> (Number.isInteger(r)? (r+1): r)).join(',') + (e.rows.length>5 ? '…' : '') : '?'
        return `Rule '${e?.rule || ''}': column '${col}', rows ${rows}: ${e?.message || 'violated'}`
      })
      parts.push(lines.join('\n'))
      if (re.length > 50) parts.push(`…and ${re.length-50} more rule issues`)
    }
  }
  if (!parts.length) return 'Validation failed.'
  return parts.join('\n')
}
