import { useEffect, useMemo, useState } from 'react'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import { orderColumnsBySchema } from '../utils/columnOrder'
import { NavLink, useParams, Link, useNavigate } from 'react-router-dom'
import { createDataset, deleteDataset, getProject, listDatasets, updateDataset, uploadDatasetFile, validateData, transformData, exportData, getDatasetSample, listMembers, appendDatasetDataTop, openAppendChangeTop } from '../api'
import { myProjectRole } from '../api'

type Dataset = { id:number; name:string; schema?: string; rules?: string; last_upload_at?: string; last_upload_path?: string }

export default function DatasetsPage(){
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Dataset[]>([])
  const nav = useNavigate()
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)
  const [sortBy, setSortBy] = useState<'name'|'type'|'modified'>('name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
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
  // Append state: track per-dataset to avoid bleed across items
  const [appendFiles, setAppendFiles] = useState<Record<number, File|null>>({})
  const [appendResult, setAppendResult] = useState<any>(null)
  // Reviewer selection state for append flow
  // reviewers list (any project member) for append flow
  const [approvers, setApprovers] = useState<{id:number; email:string; role:string}[]>([])
  const [reviewerDialog, setReviewerDialog] = useState(false)
  const [selectedReviewer, setSelectedReviewer] = useState<number|undefined>(undefined)
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<number|null>(null)
  const [pendingUploadIds, setPendingUploadIds] = useState<Record<number, number|undefined>>({})
  // Data ops panel state
  const [opsOpen, setOpsOpen] = useState(true) // beta panel hidden by default below
  const [dataInput, setDataInput] = useState('[\n  {"id": 1, "name": "Alice", "score": 91},\n  {"id": 2, "name": "Bob", "score": 82},\n  {"id": 3, "name": "Cara", "score": 88}\n]')
  const [opsInput, setOpsInput] = useState('[\n  { "op": "select", "columns": ["id", "name", "score"] },\n  { "op": "limit", "n": 2 }\n]')
  const [result, setResult] = useState<{data:any[]; columns:string[]}|null>(null)
  // Small op builder state
  const [builder, setBuilder] = useState<{type:'select'|'limit'|'filter_equals', columns:string, column:string, value:string, n:number}>({type:'select', columns:'', column:'', value:'', n:10})
  // Preview modal state (page-level)
  const [previews, setPreviews] = useState<Record<number, {data:any[]; columns:string[]}|null>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalRows, setModalRows] = useState<any[]>([])
  const [modalCols, setModalCols] = useState<string[]>([])
  // Upload progress modal
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Uploading...')

  function uploadWithProgress(url: string, file: File): Promise<any>{
    return new Promise((resolve, reject)=>{
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      const token = localStorage.getItem('token')
      if(token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e)=>{
        if(e.lengthComputable){
          // Don't jump to 100% until the server responds; keep at most 99%
          const raw = Math.round((e.loaded / e.total) * 100)
          const pct = Math.min(raw, 99)
          setProgressPct(pct)
        }
      }
      xhr.onload = ()=>{
        try{
          if(xhr.status >= 200 && xhr.status < 300){
            // Only mark 100% when server confirms
            setProgressPct(100)
            setProgressLabel('Processing completed')
            resolve(JSON.parse(xhr.responseText||'{}'))
          }else if(xhr.status === 413){
            reject(new Error('File too large. Max allowed size is 100 MB.'))
          }else{
            reject(new Error(xhr.responseText || 'Upload failed'))
          }
        }catch(err){ reject(err) }
      }
      xhr.onerror = ()=> reject(new Error('Network error'))
      const form = new FormData(); form.append('file', file)
      setProgressPct(0); setProgressLabel('Uploading…'); setProgressOpen(true)
      xhr.send(form)
    })
  }

  useEffect(()=>{ (async()=>{
    try{ setProject(await getProject(projectId)); setItems(await listDatasets(projectId)) } catch(e:any){ setError(e.message) }
    try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{ setRole(null) }
  try{ const members = await listMembers(projectId); setApprovers(members as any[]) }catch{}
  })() }, [projectId])

  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
            </div>

            <div className="mb-4 border-b border-gray-200">
              <nav className="flex gap-2">
                <NavLink end to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
                <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
                {role === 'owner' && (
                  <NavLink to={`/projects/${projectId}/settings`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Settings</NavLink>
                )}
              </nav>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Dataset card: clickable for owner/contributor; visible but disabled for viewer */}
              {role && role !== 'viewer' ? (
                <Link to={`/projects/${projectId}/datasets/new`} aria-label="Create dataset" className="project-card hover-shadow p-3 flex flex-col items-center justify-center text-center min-h-[120px]">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                    <rect x="3" y="3" width="18" height="14" rx="2" stroke="#3B82F6" strokeWidth="1.5" fill="rgba(59,130,246,0.06)" />
                    <path d="M7 17v2h10v-2" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="text-base font-semibold text-brand-blue">Dataset</div>
                </Link>
              ) : role === 'viewer' ? (
                <div aria-disabled="true" title="View-only role: ask the owner for edit access" className="project-card p-3 flex flex-col items-center justify-center text-center min-h-[120px] opacity-50 cursor-not-allowed select-none">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                    <rect x="3" y="3" width="18" height="14" rx="2" stroke="#94a3b8" strokeWidth="1.5" fill="rgba(148,163,184,0.12)" />
                    <path d="M7 17v2h10v-2" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div className="text-base font-semibold text-slate-500">Dataset</div>
                </div>
              ) : null}

              <Link to={`/projects/${projectId}/query`} aria-label="Open query" className="project-card hover-shadow p-3 flex flex-col items-center justify-center text-center min-h-[120px]">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                  <circle cx="12" cy="8" r="3" stroke="#3B82F6" strokeWidth="1.5" fill="rgba(59,130,246,0.06)" />
                  <path d="M5 20c1.5-2 4-3 7-3s5.5 1 7 3" stroke="#3B82F6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-base font-semibold text-brand-blue">Query</div>
              </Link>

              <Link to={`/projects/${projectId}/dashboard`} aria-label="Open dashboard" className="project-card hover-shadow p-3 flex flex-col items-center justify-center text-center min-h-[120px]">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                  <rect x="4" y="6" width="6" height="12" rx="1" stroke="#3B82F6" strokeWidth="1.4" fill="rgba(59,130,246,0.06)" />
                  <rect x="10" y="9" width="4" height="9" rx="1" stroke="#3B82F6" strokeWidth="1.4" fill="rgba(59,130,246,0.06)" />
                  <rect x="14" y="12" width="6" height="6" rx="1" stroke="#3B82F6" strokeWidth="1.4" fill="rgba(59,130,246,0.06)" />
                </svg>
                <div className="text-base font-semibold text-brand-blue">Dashboard</div>
              </Link>

              {/* Audit card: clickable for non-viewers; visible but disabled for viewer */}
              {role && role !== 'viewer' ? (
                <Link to={`/projects/${projectId}/audit`} aria-label="Open audit" className="project-card hover-shadow p-3 flex flex-col items-center justify-center text-center min-h-[120px]">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                    <path d="M12 3v6" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round"/>
                    <circle cx="12" cy="15" r="4" stroke="#3B82F6" strokeWidth="1.5" fill="rgba(59,130,246,0.06)" />
                  </svg>
                  <div className="text-base font-semibold text-brand-blue">Audit</div>
                </Link>
              ) : role === 'viewer' ? (
                <div aria-disabled="true" title="View-only role: ask the owner for audit access" className="project-card p-3 flex flex-col items-center justify-center text-center min-h-[120px] opacity-50 cursor-not-allowed select-none">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 opacity-80">
                    <path d="M12 3v6" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round"/>
                    <circle cx="12" cy="15" r="4" stroke="#94a3b8" strokeWidth="1.5" fill="rgba(148,163,184,0.12)" />
                  </svg>
                  <div className="text-base font-semibold text-slate-500">Audit</div>
                </div>
              ) : null}
            </div>

            {/* Quick links table */}
            <div className="border border-gray-200 bg-white rounded-md p-3 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Quick links</div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-sm text-slate-600">
                      <th className="p-3">
                        <button className="sort-btn" onClick={() => { setSortBy('name'); setSortDir(sortBy==='name' && sortDir==='asc' ? 'desc' : 'asc') }}>Name</button>
                      </th>
                      <th className="p-3 text-right">
                        <button className="sort-btn" onClick={() => { setSortBy('type'); setSortDir(sortBy==='type' && sortDir==='asc' ? 'desc' : 'asc') }}>Type</button>
                      </th>
                      <th className="p-3 text-right">
                        <button className="sort-btn" onClick={() => { setSortBy('modified'); setSortDir(sortBy==='modified' && sortDir==='asc' ? 'desc' : 'asc') }}>Last modified</button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const copy = [...items]
                      copy.sort((a,b) => {
                        if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                        if (sortBy === 'type') return sortDir === 'asc' ? ((a.schema||'').localeCompare(b.schema||'')) : ((b.schema||'').localeCompare(a.schema||''))
                        if (sortBy === 'modified') return sortDir === 'asc' ? (new Date(a.last_upload_at||0).getTime() - new Date(b.last_upload_at||0).getTime()) : (new Date(b.last_upload_at||0).getTime() - new Date(a.last_upload_at||0).getTime())
                        return 0
                      })
                      return copy.map(d => (
                        <tr key={d.id} className="border-t row-clickable" onClick={() => nav(`/projects/${projectId}/datasets/${d.id}`)} tabIndex={0} role="button">
                          <td className="p-2"> <div className="font-semibold text-slate-800 name-cell truncate" title={d.name}>{d.name}</div></td>
                          <td className="p-2 text-right">{d.schema ? 'Dataset' : 'File'}</td>
                          <td className="p-2 text-right">{d.last_upload_at ? new Date(d.last_upload_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data operations panel (beta) temporarily disabled */}
            {false && (
              <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
                {/* ...existing ops UI... */}
              </div>
            )}

            {/* Result table and actions area */}
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

            {/* Create dataset CTA for owners */}
            {(role === 'owner') && (
              <div className="hidden">{/* owner-only CTA removed to avoid empty block */}</div>
            )}

            {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
            {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}

            {/* Older inline dataset list removed — quick links table above replaces it */}
  </>
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
