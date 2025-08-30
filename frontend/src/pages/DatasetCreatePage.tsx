import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createDatasetTop, getProject } from '../api'
import Alert from '../components/Alert'

function slugifyDbName(name: string){
  return (name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 63) || 'project'
}

export default function DatasetCreatePage(){
  const { id } = useParams()
  const projectId = Number(id)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [name, setName] = useState('')
  const [source, setSource] = useState<'local'|'s3'|'azure'|'gcs'>('local')
  const [db, setDb] = useState('')
  const [schema, setSchema] = useState('public')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(()=>{ (async()=>{
    try{
      const p = await getProject(projectId); setProject(p)
      const d = slugifyDbName(p?.name || '')
      setDb(d)
    }catch(e:any){ setError(e.message) }
  })() }, [projectId])

  const targetPreview = useMemo(()=>{
    const t = table.trim().replace(/\s+/g, '_')
    const s = schema.trim() || 'public'
    const database = db.trim() || slugifyDbName(project?.name || '')
    return `${database}.${s}.${t || 'table'}`
  }, [db, schema, table, project?.name])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">New dataset in {project?.name || `Project #${projectId}`}</h2>
        <Link to={`/projects/${projectId}`} className="text-sm text-primary hover:underline">Back</Link>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  <div className="border border-gray-200 bg-white p-4 grid gap-3">
        <div>
          <label className="text-sm text-gray-700">Dataset name</label>
          <input className="w-full border border-gray-300 px-3 py-2 mt-1" placeholder="e.g. users" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-700">Source</label>
          <select className="w-full border border-gray-300 px-3 py-2 mt-1" value={source} onChange={e=>setSource(e.target.value as any)}>
            <option value="local">Local uploads</option>
            <option value="s3">Amazon S3</option>
            <option value="azure">Azure Blob</option>
            <option value="gcs">Google Cloud Storage</option>
          </select>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Database</label>
              <button className="text-xs text-primary hover:underline" onClick={()=>{
                if(!db){ setDb(slugifyDbName(project?.name || '')) }
              }}>Reset to project</button>
            </div>
            <input className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1" value={db} onChange={e=>setDb(e.target.value)} placeholder={slugifyDbName(project?.name || '')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Schema</label>
            <input className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1" value={schema} onChange={e=>setSchema(e.target.value)} placeholder="public" />
          </div>
          <div>
            <label className="text-sm text-gray-700">Table</label>
            <input className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1" value={table} onChange={e=>setTable(e.target.value)} placeholder="users" />
          </div>
        </div>
        <div className="text-xs text-gray-600">Target table will be <span className="font-mono">{targetPreview}</span></div>
        <div className="flex gap-2">
          <button
            disabled={!name || !table || creating}
            className="rounded-md bg-primary text-white px-4 py-2 text-sm hover:bg-indigo-600 disabled:opacity-60"
            onClick={async()=>{
              if(!name || !table) return
              setError(''); setCreating(true)
              const database = db.trim() || slugifyDbName(project?.name || '')
              const dsn = `${database}.${(schema||'public').trim()}.${table.trim()}`
              try{
                const resp = await createDatasetTop(projectId, { name, source, target: { type: 'table', dsn } })
                // Navigate to schema page next
                nav(`/projects/${projectId}/datasets/${resp.id}/schema`)
              }catch(e:any){ setError(e.message) } finally { setCreating(false) }
            }}
          >Create dataset</button>
          <button className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" onClick={()=>nav(-1)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
