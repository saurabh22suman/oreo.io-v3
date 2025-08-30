import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import { orderColumnsBySchema } from '../utils/columnOrder'
import { NavLink, useParams, Link } from 'react-router-dom'
import { createDataset, deleteDataset, getProject, listDatasets, updateDataset, uploadDatasetFile, validateData, transformData, exportData, getDatasetSample, listMembers, appendDatasetDataTop, openAppendChangeTop } from '../api'
import { myProjectRole } from '../api'

type Dataset = { id:number; name:string; schema?: string; rules?: string; last_upload_at?: string; last_upload_path?: string }

export default function DatasetsPage(){
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Dataset[]>([])
  const [role, setRole] = useState<'owner'|'contributor'|'approver'|'viewer'|null>(null)
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
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className={`flex-1 layout-with-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-slot"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} /></div>
        <main className="main p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
              {(role === 'owner') && (
                <Link to={`/projects/${projectId}/datasets/new`} className="btn-primary bold px-3 py-1.5 text-sm">New dataset (flow)</Link>
              )}
            </div>

            <div className="mb-4 border-b border-gray-200">
              <nav className="flex gap-2">
                <NavLink to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
                <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
              </nav>
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
              <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
                {/* ...create dataset UI... */}
              </div>
            )}

            {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
            {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}

            <ul className="space-y-3">
              {items.map(d => (
                <li key={d.id} className="card p-3 min-h-[80px]">
                  {/* ...dataset list item... */}
                </li>
              ))}
            </ul>

          </div>
        </main>
      </div>
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
