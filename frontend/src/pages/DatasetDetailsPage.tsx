import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { appendUpload, approveChange, getDataset, getDatasetSample, getProject, listChanges, rejectChange } from '../api'

type Dataset = { id:number; name:string; schema?: string; rules?: string; last_upload_path?: string; last_upload_at?: string }

type Change = { id:number; type:string; status:string; title?:string; created_at?:string }

export default function DatasetDetailsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset|null>(null)
  const [stats, setStats] = useState<{rows:number; columns:string[]} | null>(null)
  const [sample, setSample] = useState<{data:any[]; columns:string[]} | null>(null)
  const [appendFile, setAppendFile] = useState<File|null>(null)
  const [changes, setChanges] = useState<Change[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      const ds = await getDataset(projectId, dsId); setDataset(ds)
      try{
        const s = await getDatasetSample(projectId, dsId)
        setSample({ data: s.data||[], columns: s.columns||[] }); setStats({ rows: s.rows|| (s.data?.length||0), columns: s.columns||[]})
      }catch(e:any){ setError(e.message) }
      setChanges(await listChanges(projectId))
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  const owner = useMemo(()=> project?.owner_email || project?.owner || '', [project])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
          <div>
            <Link className="text-sm text-primary hover:underline" to={`/projects/${projectId}`}>Back to datasets</Link>
          </div>
        </div>
        <nav className="flex gap-2 mt-2">
          <NavLink to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
          <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
        </nav>
      </div>

      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {toast && <div className="text-sm text-green-700 mb-2">{toast}</div>}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Left: Dataset summary */}
        <div className="lg:col-span-2 border border-gray-200 bg-white rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{dataset?.name || `Dataset #${dsId}`}</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-100 rounded-md p-3">
              <div className="text-gray-600">File name</div>
              <div className="font-medium break-words">{dataset?.last_upload_path ? dataset.last_upload_path.split(/[/\\]/).pop() : 'Not uploaded yet'}</div>
            </div>
            <div className="border border-gray-100 rounded-md p-3">
              <div className="text-gray-600">Owner</div>
              <div className="font-medium">{owner || '—'}</div>
            </div>
            <div className="border border-gray-100 rounded-md p-3">
              <div className="text-gray-600">Rows</div>
              <div className="font-medium">{stats?.rows ?? (sample?.data?.length || 0)}</div>
            </div>
            <div className="border border-gray-100 rounded-md p-3">
              <div className="text-gray-600">Columns</div>
              <div className="font-medium">{stats?.columns?.length ?? (sample?.columns?.length || 0)}</div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Preview</div>
              <button className="text-xs text-primary hover:underline" onClick={async()=>{
                try{
                  const s = await getDatasetSample(projectId, dsId)
                  setSample({ data: s.data||[], columns: s.columns||[] })
                  setStats({ rows: s.rows|| (s.data?.length||0), columns: s.columns||[]})
                  setToast('Refreshed preview')
                }catch(e:any){ setError(e.message) }
              }}>Refresh</button>
            </div>
            {sample ? (
              <div className="overflow-auto border border-gray-200 rounded-md">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {sample.columns.map(c => <th key={c} className="text-left px-3 py-2 border-b border-gray-200">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sample.data.slice(0,200).map((row, i) => (
                      <tr key={i} className={i%2? 'bg-white':'bg-gray-50'}>
                        {sample.columns.map(c => <td key={c} className="px-3 py-2 border-b border-gray-100">{String(row[c] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ): (
              <div className="text-xs text-gray-600">No preview available.</div>
            )}
          </div>
        </div>

        {/* Right: Append + Workflow */}
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Append new data</div>
          <div className="flex items-center gap-2 mb-2">
            <input id="append-ds" type="file" className="hidden" accept=".csv,.xlsx,.xls,.json" onChange={e=> setAppendFile(e.target.files?.[0]||null)} />
            <label htmlFor="append-ds" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">Choose file</label>
            <span className="text-xs text-gray-600 max-w-[16rem] truncate">{appendFile? appendFile.name : 'No file selected'}</span>
          </div>
          <button disabled={!appendFile} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
            if(!appendFile) return
            setError('')
            try{
              const res = await appendUpload(projectId, dsId, appendFile)
              if(res?.ok){ setToast('Validation passed. Change Request opened.'); setAppendFile(null); setChanges(await listChanges(projectId)) }
              else {
                setError('Validation found issues. Please review rules/schema on the dataset page and retry.')
              }
            }catch(e:any){ setError(e.message) }
          }}>Validate & open change</button>

          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Change workflow</div>
            {changes.length ? (
              <ul className="space-y-2">
                {changes.map(ch => (
                  <li key={ch.id} className="border border-gray-200 rounded-md p-2 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{ch.title || ch.type} <span className="text-xs text-gray-500">#{ch.id}</span></div>
                      <div className="text-xs text-gray-600">{ch.status}</div>
                    </div>
                    <div className="flex gap-2">
                      {ch.status === 'pending' && (
                        <>
                          <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await approveChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change approved'); }catch(e:any){ setError(e.message) } }}>Approve</button>
                          <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await rejectChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change rejected'); }catch(e:any){ setError(e.message) } }}>Reject</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-gray-600">No changes yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
