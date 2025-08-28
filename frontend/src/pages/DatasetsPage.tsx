import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams, Link } from 'react-router-dom'
import { createDataset, deleteDataset, getProject, listDatasets, updateDataset, uploadDatasetFile, validateData, transformData, exportData, getDatasetSample, appendUpload } from '../api'

type Dataset = { id:number; name:string; schema?: string; rules?: string }

export default function DatasetsPage(){
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Dataset[]>([])
  const [name, setName] = useState('')
  const [createFile, setCreateFile] = useState<File|null>(null)
  const [error, setError] = useState('')
  const [schema, setSchema] = useState('')
  // Schema editor state
  const [editorForId, setEditorForId] = useState<number|null>(null)
  const [schemaEditor, setSchemaEditor] = useState('')
  const [validateOutput, setValidateOutput] = useState('')
  const [uploadingId, setUploadingId] = useState<number|null>(null)
  const [creating, setCreating] = useState(false)
  const [liveValid, setLiveValid] = useState<string>('')
  const [liveErr, setLiveErr] = useState<string>('')
  const [toast, setToast] = useState<string>('')
  const [rulesEditor, setRulesEditor] = useState('[\n  { "type": "required", "columns": ["id", "name"] },\n  { "type": "unique", "column": "id" },\n  { "type": "range", "column": "score", "min": 0, "max": 100 }\n]')
  const [appendFile, setAppendFile] = useState<File|null>(null)
  const [appendResult, setAppendResult] = useState<any>(null)
  // Data ops panel state
  const [opsOpen, setOpsOpen] = useState(true)
  const [dataInput, setDataInput] = useState('[\n  {"id": 1, "name": "Alice", "score": 91},\n  {"id": 2, "name": "Bob", "score": 82},\n  {"id": 3, "name": "Cara", "score": 88}\n]')
  const [opsInput, setOpsInput] = useState('[\n  { "op": "select", "columns": ["id", "name", "score"] },\n  { "op": "limit", "n": 2 }\n]')
  const [result, setResult] = useState<{data:any[]; columns:string[]}|null>(null)
  // Small op builder state
  const [builder, setBuilder] = useState<{type:'select'|'limit'|'filter_equals', columns:string, column:string, value:string, n:number}>({type:'select', columns:'', column:'', value:'', n:10})
  // Per-dataset preview state
  const [previews, setPreviews] = useState<Record<number, {data:any[]; columns:string[]}|null>>({})
  const [previewOpen, setPreviewOpen] = useState<Record<number, boolean>>({})

  useEffect(()=>{ (async()=>{
    try{ setProject(await getProject(projectId)); setItems(await listDatasets(projectId)) } catch(e:any){ setError(e.message) }
  })() }, [projectId])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
      </div>
      
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex gap-2">
          <NavLink to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
          <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
        </nav>
      </div>
      {/* Data operations panel (moved below tabs for visibility) */}
      <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Data operations (beta)</h3>
          <button className="text-sm text-primary hover:underline" onClick={()=>setOpsOpen(!opsOpen)}>{opsOpen? 'Hide' : 'Show'}</button>
        </div>
        {opsOpen && (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="text-xs text-gray-600">Input data (JSON array of objects)</label>
                <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={10} value={dataInput} onChange={e=>setDataInput(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Operations (JSON array)</label>
                <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={10} value={opsInput} onChange={e=>setOpsInput(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                if(!items.length){ setError('No datasets yet'); return }
                try{
                  const sample = await getDatasetSample(projectId, items[0].id)
                  setDataInput(JSON.stringify(sample.data || [], null, 2))
                  setToast('Loaded sample from last upload')
                }catch(e:any){ setError(e.message || 'Sample fetch failed') }
              }}>Load sample from first dataset</button>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=>{
                setOpsInput('[\n  { "op": "select", "columns": ["id", "name"] },\n  { "op": "limit", "n": 10 }\n]')
              }}>Preset: select+limit</button>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=>{
                setOpsInput('[\n  { "op": "filter_equals", "column": "status", "value": "active" }\n]')
              }}>Preset: filter active</button>
              <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{
                setError('')
                try{
                  const rows = JSON.parse(dataInput)
                  const ops = JSON.parse(opsInput)
                  const out = await transformData(rows, ops)
                  setResult({ data: out.data || [], columns: out.columns || [] })
                }catch(e:any){ setError(e.message || 'Invalid input'); }
              }}>Run transform</button>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                setError('')
                try{
                  const rows = result?.data ?? JSON.parse(dataInput)
                  const ex = await exportData(rows, 'csv')
                  const csv = ex.body || ''
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click(); URL.revokeObjectURL(url)
                }catch(e:any){ setError(e.message || 'Export failed') }
              }}>Download CSV</button>
            </div>
            {/* Tiny op-builder */}
            <div className="border border-gray-100 rounded-md p-2">
              <div className="text-xs text-gray-600 mb-2">Quick op builder</div>
              <div className="flex flex-wrap gap-2 items-center">
                <select className="border border-gray-300 rounded-md px-2 py-1 text-xs" value={builder.type} onChange={e=>setBuilder({...builder, type: e.target.value as any})}>
                  <option value="select">select</option>
                  <option value="limit">limit</option>
                  <option value="filter_equals">filter_equals</option>
                </select>
                {builder.type === 'select' && (
                  <input className="border border-gray-300 rounded-md px-2 py-1 text-xs w-64" placeholder="columns comma-separated e.g. id,name" value={builder.columns} onChange={e=>setBuilder({...builder, columns: e.target.value})} />
                )}
                {builder.type === 'limit' && (
                  <input type="number" className="border border-gray-300 rounded-md px-2 py-1 text-xs w-24" placeholder="n" value={builder.n} onChange={e=>setBuilder({...builder, n: Number(e.target.value)})} />
                )}
                {builder.type === 'filter_equals' && (
                  <>
                    <input className="border border-gray-300 rounded-md px-2 py-1 text-xs w-40" placeholder="column" value={builder.column} onChange={e=>setBuilder({...builder, column: e.target.value})} />
                    <input className="border border-gray-300 rounded-md px-2 py-1 text-xs w-40" placeholder="value" value={builder.value} onChange={e=>setBuilder({...builder, value: e.target.value})} />
                  </>
                )}
                <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=>{
                  try{
                    const ops = JSON.parse(opsInput)
                    if(builder.type === 'select') ops.push({ op:'select', columns: builder.columns.split(',').map(s=>s.trim()).filter(Boolean) })
                    if(builder.type === 'limit') ops.push({ op:'limit', n: builder.n })
                    if(builder.type === 'filter_equals') ops.push({ op:'filter_equals', column: builder.column, value: builder.value })
                    setOpsInput(JSON.stringify(ops, null, 2))
                  }catch{
                    setOpsInput('[\n]')
                  }
                }}>Add op</button>
              </div>
            </div>

            {result && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Rows: {result.data.length}</div>
                <div className="overflow-auto border border-gray-200 rounded-md">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {result.columns.map(col => <th key={col} className="text-left px-3 py-2 border-b border-gray-200">{col}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.slice(0,200).map((row, idx)=>(
                        <tr key={idx} className={idx%2? 'bg-white':'bg-gray-50'}>
                          {result.columns.map(col => <td key={col} className="px-3 py-2 border-b border-gray-100">{String(row[col] ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <input className="border border-gray-300 rounded-md px-3 py-2 flex-1" placeholder="New dataset name" value={name} onChange={e=>setName(e.target.value)} />
          <div className="flex items-center gap-2">
            <input id="create-file" type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={e=>{
              const f = e.target.files?.[0] || null; setCreateFile(f)
            }} />
            <label htmlFor="create-file" title="Select a CSV, Excel, or JSON file" className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{createFile ? 'Change file' : 'Choose file'}</label>
            <span className="text-xs text-gray-600 max-w-[16rem] truncate">{createFile ? createFile.name : 'Optional: attach data file'}</span>
            <button
              disabled={!name || creating}
              className="rounded-md bg-primary text-white px-3 py-2 text-sm hover:bg-indigo-600 disabled:opacity-60"
              onClick={async()=>{
                setError(''); if(!name) return; setCreating(true)
                try{
                  const d = await createDataset(projectId, name)
                  setItems([d, ...items]); setName('')
                  if(createFile){
                    setUploadingId(d.id)
                    try{
                      const res = await uploadDatasetFile(projectId, d.id, createFile)
                      setSchema(JSON.stringify(res.schema||res, null, 2))
                      setToast('File uploaded and schema inferred.')
                    } finally {
                      setUploadingId(null)
                    }
                    setCreateFile(null)
                  }
                  if(!createFile){ setToast('Dataset created.') }
                }catch(e:any){ setError(e.message) }
                finally{ setCreating(false) }
              }}>Create dataset</button>
          </div>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {toast && <div className="text-sm text-green-700 mb-2">{toast}</div>}
      <ul className="space-y-3">
        {items.map(d => (
          <li key={d.id} className="border border-gray-200 bg-white rounded-md p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <EditableName
                initial={d.name}
                onSave={async(newName)=>{
                  if(newName === d.name) return
                  try{
                    const resp = await updateDataset(projectId, d.id, { name: newName, schema: d.schema ?? undefined })
                    setItems(items.map(x=> x.id===d.id ? { ...x, name: resp.name } : x))
                    setToast('Dataset renamed.')
                  }catch(e:any){ setError(e.message) }
                }}
              />
              <div className="flex items-center gap-2">
                <Link className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" to={`/projects/${projectId}/datasets/${d.id}`}>Open</Link>
                <input id={`file-d-${d.id}`} className="hidden" type="file" accept=".csv,.xlsx,.xls,.json" onChange={async(e)=>{
                  const file = e.target.files?.[0]; if(!file) return
                  try{ setUploadingId(d.id); const res = await uploadDatasetFile(projectId, d.id, file); setSchema(JSON.stringify(res.schema||res, null, 2)); setToast('File uploaded and schema inferred.') }catch(err:any){ setError(err.message) } finally { setUploadingId(null) }
                  // reset input so same file can be selected again if desired
                  e.currentTarget.value = ''
                }} />
                <label htmlFor={`file-d-${d.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  {uploadingId === d.id ? 'Uploading…' : 'Upload data'}
                </label>
                <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                  try{
                    const sample = await getDatasetSample(projectId, d.id)
                    setPreviews(prev => ({...prev, [d.id]: { data: sample.data || [], columns: sample.columns || [] }}))
                    setPreviewOpen(prev => ({...prev, [d.id]: true}))
                    setToast('Loaded preview')
                  }catch(e:any){
                    // Show a concise, readable message from backend or fallback
                    setError(e?.message || 'Could not load preview. Please re-upload the dataset file or try again later.')
                  }
                }}>Preview data</button>
                <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                  if(!confirm('Delete this dataset? This cannot be undone.')) return
                  try{ await deleteDataset(projectId, d.id); setItems(items.filter(x=>x.id!==d.id)); setToast('Dataset deleted.') }catch(e:any){ setError(e.message) }
                }}>Delete</button>
                <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=>{
                setEditorForId(d.id)
                setValidateOutput('')
                setSchemaEditor(d.schema || '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "type": "object",\n  "properties": {}\n}')
              }}>Edit schema</button>
              </div>
            </div>

            {editorForId === d.id && (
              <div className="grid gap-2 mt-2 max-w-3xl">
                <label className="text-sm text-gray-700">Schema (JSON)</label>
                <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm" value={schemaEditor} onChange={e=>setSchemaEditor(e.target.value)} rows={12} />
                <LiveValidation schemaText={schemaEditor} onResult={(ok,msg)=>{ setLiveValid(ok? 'Schema OK' : ''); setLiveErr(ok? '' : msg) }} />
                <div className="flex gap-2">
          <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{
                    try {
                      const parsed = JSON.parse(schemaEditor)
                      const resp = await updateDataset(projectId, d.id, { name: d.name, schema: JSON.stringify(parsed) })
                      // Update local UI state for this dataset
                      setItems(items.map(x => x.id === d.id ? { ...x, schema: resp.schema } : x))
                      setSchema(resp.schema || '')
                      setEditorForId(null); setSchemaEditor(''); setValidateOutput('')
            setToast('Schema saved.')
                    } catch (e:any) {
                      setError(e.message)
                    }
                  }}>Save schema</button>
                  <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                    try {
                      const parsed = JSON.parse(schemaEditor)
                      const res = await validateData(parsed, []) // validate empty array
                      setValidateOutput(JSON.stringify(res, null, 2))
                    } catch (e:any) {
                      setError(e.message)
                    }
                  }}>Validate (empty data)</button>
                  <button className="rounded-md px-3 py-1.5 text-sm hover:bg-gray-50" onClick={()=>{ setEditorForId(null); setSchemaEditor(''); setValidateOutput('') }}>Cancel</button>
                </div>
                {validateOutput && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium mb-1">Validation result</h4>
                    <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto">{validateOutput}</pre>
                  </div>
                )}
                {(liveValid || liveErr) && (
                  <div className="mt-2 text-xs">
                    {liveValid && <div className="text-green-700">{liveValid}</div>}
                    {liveErr && <div className="text-red-600">{liveErr}</div>}
                  </div>
                )}
              </div>
            )}

            {/* Validation & Append */}
            <div className="mt-3 grid gap-2">
              {previewOpen[d.id] && previews[d.id] && (
                <div className="border border-gray-200 rounded-md">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <div className="text-sm text-gray-700">Preview rows: {previews[d.id]!.data.length}</div>
                    <button className="text-xs text-primary hover:underline" onClick={()=> setPreviewOpen(prev => ({...prev, [d.id]: false}))}>Hide</button>
                  </div>
                  <div className="overflow-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {previews[d.id]!.columns.map(col => (
                            <th key={col} className="text-left px-3 py-2 border-b border-gray-200">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previews[d.id]!.data.slice(0,200).map((row, idx)=> (
                          <tr key={idx} className={idx%2? 'bg-white':'bg-gray-50'}>
                            {previews[d.id]!.columns.map(col => (
                              <td key={col} className="px-3 py-2 border-b border-gray-100">{String(row[col] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <details className="rounded-md border border-gray-200 bg-white">
                <summary className="px-3 py-2 cursor-pointer text-sm font-medium">Business rules (JSON)</summary>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-600">Rules are stored with the dataset.</div>
                    <div className="flex gap-2">
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=>{
                        // load
                        try{
                          const txt = (d as any).rules || ''
                          setRulesEditor(txt || rulesEditor)
                        }catch{}
                      }}>Load</button>
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{
                        // save
                        try{
                          // quick validate JSON
                          const parsed = JSON.parse(rulesEditor || '[]')
                          const resp = await updateDataset(projectId, d.id, { name: d.name, schema: d.schema, rules: JSON.stringify(parsed) })
                          setItems(items.map(x=> x.id===d.id ? { ...x, rules: resp.rules } : x))
                          setToast('Rules saved.')
                        }catch(e:any){ setError(e.message || 'Invalid rules JSON') }
                      }}>Save</button>
                    </div>
                  </div>
                  <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={8} value={rulesEditor} onChange={e=>setRulesEditor(e.target.value)} />
                </div>
              </details>
              <div className="flex items-center gap-2">
                <input id={`append-${d.id}`} type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={e=> setAppendFile(e.target.files?.[0] || null)} />
                <label htmlFor={`append-${d.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">Choose append file</label>
                <span className="text-xs text-gray-600 max-w-[16rem] truncate">{appendFile? appendFile.name : 'No file selected'}</span>
                <button disabled={!appendFile} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
                  if(!appendFile) return
                  setError(''); setAppendResult(null)
                  try{
                    const res = await appendUpload(projectId, d.id, appendFile)
                    setAppendResult(res)
                    if(res?.ok){ setToast('Validation passed. Change Request opened.'); setAppendFile(null) }
                  }catch(e:any){ setError(e.message) }
                }}>Validate & open change</button>
              </div>
              {appendResult && (
                <div className="border border-gray-200 rounded-md bg-white p-3">
                  {appendResult.ok ? (
                    <div className="text-green-700 text-sm">Ready for approval. Change Request ID: {appendResult?.change_request?.id}</div>
                  ) : (
                    <div>
                      <div className="text-red-600 text-sm mb-2">Errors detected. Fix and retry.</div>
                      <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto">{JSON.stringify({schema: appendResult.schema, rules: appendResult.rules}, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {schema && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Inferred schema</h3>
          <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto">{schema}</pre>
        </div>
      )}
    </div>
  )
}

// Lightweight live schema validation helper
function LiveValidation({ schemaText, onResult }: { schemaText: string; onResult: (ok: boolean, msg: string) => void }){
  const text = schemaText
  useEffect(()=>{
    let cancelled = false
    const id = setTimeout(async()=>{
      try{
        const parsed = JSON.parse(text)
        // ping server validator with empty data; it's quick and catches schema structure issues
        await validateData(parsed, [])
        if(!cancelled) onResult(true, '')
      }catch(e:any){
        if(!cancelled) onResult(false, e.message || 'Invalid schema')
      }
    }, 400)
    return ()=>{ cancelled = true; clearTimeout(id) }
  }, [text])
  return null
}

// Small inline editable text component
function EditableName({ initial, onSave }: { initial: string; onSave: (name: string) => Promise<void> | void }){
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial)
  useEffect(()=>{ setValue(initial) }, [initial])
  if(!editing){
    return (
      <div className="flex-1 flex items-center gap-2">
        <strong className="text-sm">{initial}</strong>
        <button className="text-xs text-gray-600 hover:text-primary" onClick={()=>setEditing(true)}>Rename</button>
      </div>
    )
  }
  return (
    <div className="flex-1 flex items-center gap-2">
      <input className="border border-gray-300 rounded-md px-2 py-1 text-sm w-56" value={value} onChange={e=>setValue(e.target.value)} />
      <button className="rounded-md bg-primary text-white px-2 py-1 text-xs hover:bg-indigo-600" onClick={async()=>{ await onSave(value.trim()); setEditing(false) }}>Save</button>
      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=>{ setEditing(false); setValue(initial) }}>Cancel</button>
    </div>
  )
}
