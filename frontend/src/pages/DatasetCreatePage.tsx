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
  const [source, setSource] = useState<'local'|'s3'|'azure'|'gcs'|'mssql'>('local')
  // dynamic source-specific fields
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [s3Cfg, setS3Cfg] = useState({ accessKeyId: '', secretAccessKey: '', region: '', bucket: '', path: '' })
  const [azureCfg, setAzureCfg] = useState({ accountName: '', accessKey: '', container: '', path: '' })
  const [gcsCfg, setGcsCfg] = useState<{ keyFile?: File | null; bucket?: string; path?: string }>({ keyFile: null, bucket: '', path: '' })
  const [mssqlCfg, setMssqlCfg] = useState({ host: '', port: 1433, database: '', username: '', password: '', schema: 'dbo', table: '' })
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
            <option value="local">Local file</option>
            <option value="s3">Amazon S3</option>
            <option value="azure">Azure Blob Storage</option>
            <option value="gcs">Google Cloud Storage</option>
            <option value="mssql">SQL Server</option>
          </select>
        </div>

        {/* dynamic fields depending on source */}
        {source === 'local' && (
          <div>
            <label className="text-sm text-gray-700">Upload file</label>
            <input type="file" accept=".csv,.xlsx,.json,.parquet" onChange={e=>setLocalFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="w-full mt-1" />
            <div className="text-xs text-gray-500 mt-1">Accepted: .csv, .xlsx, .json, .parquet</div>
          </div>
        )}
        {source === 's3' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Access Key ID</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={s3Cfg.accessKeyId} onChange={e=>setS3Cfg({...s3Cfg, accessKeyId: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Secret Access Key</label>
              <input type="password" className="w-full border border-gray-300 px-3 py-2 mt-1" value={s3Cfg.secretAccessKey} onChange={e=>setS3Cfg({...s3Cfg, secretAccessKey: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Region</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={s3Cfg.region} onChange={e=>setS3Cfg({...s3Cfg, region: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Bucket Name</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={s3Cfg.bucket} onChange={e=>setS3Cfg({...s3Cfg, bucket: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-gray-700">File Path</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={s3Cfg.path} onChange={e=>setS3Cfg({...s3Cfg, path: e.target.value})} />
            </div>
          </div>
        )}
        {source === 'azure' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Storage Account Name</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={azureCfg.accountName} onChange={e=>setAzureCfg({...azureCfg, accountName: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Access Key</label>
              <input type="password" className="w-full border border-gray-300 px-3 py-2 mt-1" value={azureCfg.accessKey} onChange={e=>setAzureCfg({...azureCfg, accessKey: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Container Name</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={azureCfg.container} onChange={e=>setAzureCfg({...azureCfg, container: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-gray-700">Blob Path</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={azureCfg.path} onChange={e=>setAzureCfg({...azureCfg, path: e.target.value})} />
            </div>
          </div>
        )}
        {source === 'gcs' && (
          <div>
            <label className="text-sm text-gray-700">Service Account JSON</label>
            <input type="file" accept=".json" onChange={e=>setGcsCfg({ ...gcsCfg, keyFile: e.target.files && e.target.files[0] ? e.target.files[0] : null })} className="w-full mt-1" />
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-sm text-gray-700">Bucket Name</label>
                <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={gcsCfg.bucket} onChange={e=>setGcsCfg({...gcsCfg, bucket: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-700">File Path</label>
                <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={gcsCfg.path} onChange={e=>setGcsCfg({...gcsCfg, path: e.target.value})} />
              </div>
            </div>
          </div>
        )}
        {source === 'mssql' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-700">Host</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.host} onChange={e=>setMssqlCfg({...mssqlCfg, host: e.target.value})} placeholder="e.g. localhost or db.example.com" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Port</label>
              <input type="number" className="w-full border border-gray-300 px-3 py-2 mt-1" value={String(mssqlCfg.port)} onChange={e=>setMssqlCfg({...mssqlCfg, port: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Database Name</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.database} onChange={e=>setMssqlCfg({...mssqlCfg, database: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Username</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.username} onChange={e=>setMssqlCfg({...mssqlCfg, username: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Password</label>
              <input type="password" className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.password} onChange={e=>setMssqlCfg({...mssqlCfg, password: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-700">Schema (optional)</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.schema} onChange={e=>setMssqlCfg({...mssqlCfg, schema: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-gray-700">Table</label>
              <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={mssqlCfg.table} onChange={e=>setMssqlCfg({...mssqlCfg, table: e.target.value})} />
            </div>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Database</label>
              <button className="text-xs text-primary hover:underline" onClick={()=>{
                if(!db){ setDb(slugifyDbName(project?.name || '')) }
              }}>Reset to project</button>
            </div>
            <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={db} onChange={e=>setDb(e.target.value)} placeholder={slugifyDbName(project?.name || '')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Schema</label>
            <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={schema} onChange={e=>setSchema(e.target.value)} placeholder="public" />
          </div>
          <div>
            <label className="text-sm text-gray-700">Table</label>
            <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={table} onChange={e=>setTable(e.target.value)} placeholder="users" />
          </div>
        </div>
        <div className="text-xs text-gray-600">Target table will be <span className="font-mono">{targetPreview}</span></div>
        <div className="flex gap-2">
          <button
            disabled={creating}
            className="btn-primary bold px-4 py-2 text-sm disabled:opacity-60"
            onClick={async()=>{
              // basic validation
              if(!name){ setError('Dataset name is required'); return }
              if(!source){ setError('Source is required'); return }
              // source-specific validation
              if(source === 'local' && !localFile){ setError('Please upload a file for Local file source'); return }
              if(source === 's3'){
                if(!s3Cfg.accessKeyId || !s3Cfg.secretAccessKey || !s3Cfg.region || !s3Cfg.bucket || !s3Cfg.path){ setError('All S3 fields are required'); return }
              }
              if(source === 'azure'){
                if(!azureCfg.accountName || !azureCfg.accessKey || !azureCfg.container || !azureCfg.path){ setError('All Azure Blob fields are required'); return }
              }
              if(source === 'gcs'){
                if(!gcsCfg.keyFile || !gcsCfg.bucket || !gcsCfg.path){ setError('GCS service account JSON, bucket and path are required'); return }
              }
              if(source === 'mssql'){
                if(!mssqlCfg.host || !mssqlCfg.port || !mssqlCfg.database || !mssqlCfg.username || !mssqlCfg.password || !mssqlCfg.table){ setError('Host, port, database, username, password, and table are required for SQL Server'); return }
              }

              setError(''); setCreating(true)
              const database = db.trim() || slugifyDbName(project?.name || '')
              const dsn = `${database}.${(schema||'public').trim()}.${table.trim()}`
              const sourceConfig: any = { type: source }
              if(source === 'local'){
                // note: local file upload handled separately by upload endpoint; we'll send placeholder metadata here
                sourceConfig.fileName = localFile?.name || null
              } else if(source === 's3'){
                sourceConfig.s3 = { ...s3Cfg }
              } else if(source === 'azure'){
                sourceConfig.azure = { ...azureCfg }
              } else if(source === 'gcs'){
                sourceConfig.gcs = { bucket: gcsCfg.bucket, path: gcsCfg.path }
                // keyFile should be uploaded to server if needed; here we only indicate presence
              } else if(source === 'mssql'){
                sourceConfig.mssql = { ...mssqlCfg }
              }

              try{
                const resp = await createDatasetTop(projectId, ({ name, source: source, sourceConfig, target: { type: 'table', dsn } } as any))
                // Navigate to schema page next
                nav(`/projects/${projectId}/datasets/${resp.id}/schema`)
              }catch(e:any){ setError(e.message) } finally { setCreating(false) }
            }}
          >Create dataset</button>
          <button className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" onClick={()=>nav(-1)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
