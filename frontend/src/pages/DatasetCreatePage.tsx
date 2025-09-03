import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { checkTableExists, createDatasetTop, getProject, uploadDatasetFile, myProjectRole, deleteDataset, prepareDataset } from '../api'
import Alert from '../components/Alert'

// Reserved words (extendable)
const PG_RESERVED = new Set([
  'select','table','user','order','group','where','from','join','insert','update','delete','create','drop','alter'
])

// Postgres-safe slug: lowercases, spaces->_, drops invalid, collapses _, trims _,
// prefixes '_' if starts with digit, appends '_' if reserved, truncates to 63.
function postgresSlugify(name: string){
  let s = (name || '').toLowerCase()
  s = s.replace(/\s+/g, '_')
  s = s.replace(/[^a-z0-9_]/g, '')
  s = s.replace(/_+/g, '_')
  s = s.replace(/^_+|_+$/g, '')
  if(/^\d/.test(s)) s = '_' + s
  if(PG_RESERVED.has(s)) s = s + '_'
  if(s.length > 63) s = s.slice(0, 63)
  return s || 'project'
}

// Backwards-compatible name for schema placeholder generation
const slugifyDbName = postgresSlugify

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
  const [schema, setSchema] = useState('')
  const [table, setTable] = useState('')
  const [tableTouched, setTableTouched] = useState(false)
  const [autoValue, setAutoValue] = useState('')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [tableError, setTableError] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingStage, setCreatingStage] = useState<'idle'|'creating'|'uploading'>('idle')
  const [existsInfo, setExistsInfo] = useState<{ checking: boolean; exists: boolean; message?: string }>({ checking: false, exists: false })
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)
  const existsTimer = useRef<number | null>(null)

  useEffect(()=>{ (async()=>{
    try{
      const p = await getProject(projectId); setProject(p)
  const s = slugifyDbName(p?.name || '')
  setSchema(s || 'public')
  try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{ setRole(null) }
    }catch(e:any){ setError(e.message) }
  })() }, [projectId])

  // Auto-fill and live-sync table from dataset name using Postgres-safe rules.
  useEffect(()=>{
    const s = postgresSlugify(name)
    // If user never touched table OR current table equals the last auto value, keep syncing.
    if(!tableTouched || table === autoValue){
      setTable(s)
      setAutoValue(s)
    }
  }, [name])

  // Validate dataset and table inputs inline
  useEffect(()=>{
    if(!name || name.trim()==='') setNameError('Dataset name is required')
    else setNameError('')
  }, [name])
  function isValidTableName(v: string){
    if(!v) return false
    // Must be lowercase letters, digits, underscores; cannot start with a digit; <=63; not reserved
    if(!/^[a-z0-9_]+$/.test(v)) return false
    if(/^\d/.test(v)) return false
    if(v.length > 63) return false
    if(PG_RESERVED.has(v)) return false
    return true
  }
  useEffect(()=>{
    const v = (table || '').trim()
    if(!v){ setTableError('Enter a valid table name (lowercase letters, numbers, underscores)') }
    else if(!isValidTableName(v)){ setTableError('Enter a valid table name (lowercase letters, numbers, underscores)') }
    else setTableError('')
  }, [table])

  // Duplicate table check when schema+table look valid
  useEffect(()=>{
    const s = (schema || slugifyDbName(project?.name || '')).trim()
    const t = (table || '').trim()
    // Clear any pending timer
    if(existsTimer.current){ clearTimeout(existsTimer.current); existsTimer.current = null }
    // Only check when both present and table name valid
    if(!s || !t || tableError){ setExistsInfo({ checking:false, exists:false }); return }
    setExistsInfo({ checking:true, exists:false })
    existsTimer.current = window.setTimeout(()=>{
      let cancelled = false
      checkTableExists(s, t).then(res=>{
        if(cancelled) return
        setExistsInfo({ checking:false, exists: !!res.exists, message: res.message })
      }).catch(()=>{ if(!cancelled) setExistsInfo({ checking:false, exists:false }) })
      return ()=>{ cancelled = true }
    }, 300)
  }, [schema, table, project?.name, tableError])

  const targetPreview = useMemo(()=>{
    const t = (table || '').trim().replace(/\s+/g, '_')
    const s = (schema || '').trim() || slugifyDbName(project?.name || '') || 'public'
    return `${s}.${t || 'table'}`
  }, [schema, table, project?.name])

  return (
  <div className="max-w-3xl mx-auto relative">
      {role === 'viewer' && (
        <Alert type="warning" message="You have read-only access to this project. Dataset creation is disabled." onClose={()=>{}} />
      )}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">New dataset in {project?.name || `Project #${projectId}`}</h2>
        <Link to={`/projects/${projectId}`} className="text-sm text-primary hover:underline">Back</Link>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  <div className="border border-gray-200 bg-white p-4 grid gap-3 opacity-100">
        <div>
          <label className="text-sm text-gray-700">Dataset name</label>
          <input className="w-full border border-gray-300 px-3 py-2 mt-1" placeholder="e.g. users" value={name} onChange={e=>setName(e.target.value)} />
          {nameError && <div className="text-xs text-red-600 mt-1">{nameError}</div>}
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
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-700">Schema</label>
            <input className="w-full border border-gray-300 px-3 py-2 mt-1" value={schema} onChange={e=>setSchema(e.target.value)} placeholder={slugifyDbName(project?.name || '')} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Table</label>
              {tableTouched && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={()=>{
                  const s = postgresSlugify(name)
                  setTable(s); setAutoValue(s); setTableTouched(false)
                }}>Reset to name</button>
              )}
            </div>
            <input
              className="w-full border border-gray-300 px-3 py-2 mt-1"
              value={table}
              onChange={e=>{ const v = e.target.value; setTable(v); setTableTouched(v.trim() !== ''); if(v.trim()===''){ setAutoValue(postgresSlugify(name)); /* allow re-sync */ setTableTouched(false) } }}
              placeholder="users"
            />
            {tableError && <div className="text-xs text-red-600 mt-1">{tableError}</div>}
            {!tableError && existsInfo.checking && <div className="text-xs text-gray-500 mt-1">Checking availability…</div>}
            {!tableError && !existsInfo.checking && existsInfo.exists && (
              <div className="text-xs text-red-600 mt-1">Table already exists, please choose a different name.</div>
            )}
          </div>
        </div>
  <div className="text-xs text-gray-600">Target table will be <span className="font-mono">{targetPreview}</span></div>
        <div className="flex gap-2">
          <button
            disabled={role === 'viewer' || creating || !!nameError || !!tableError || existsInfo.exists || existsInfo.checking}
            className="btn-primary bold px-4 py-2 text-sm disabled:opacity-60"
            onClick={async()=>{
              if(role === 'viewer'){ setError('You do not have permission to create datasets'); return }
              // basic validation
              if(!name){ setError('Dataset name is required'); return }
              if(nameError){ setError(nameError); return }
              if(tableError){ setError(tableError); return }
              if(existsInfo.exists){ setError('Table already exists, please choose a different name'); return }
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
              setError(''); setCreating(true); setCreatingStage('creating')
              const s = (schema || slugifyDbName(project?.name || '')).trim() || 'public'
              const tClean = (table || '').trim().toLowerCase()
              const dsn = `${s}.${tClean}`
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
                // For local file source, use atomic prepare endpoint
                let resp: any
                if(source === 'local'){
                  setCreatingStage(localFile ? 'uploading' : 'creating')
                  resp = await prepareDataset(projectId, { name, schema: s, table: tClean, source }, localFile || undefined)
                } else {
                  // Send both legacy target.dsn and explicit schema/table for newer backend
                  resp = await createDatasetTop(projectId, ({ name, dataset_name: name, schema: s, table: tClean, source: source, sourceConfig, target: { type: 'table', dsn } } as any))
                }
                // Notify other pages a dataset was created so they can refresh
                try{ window.dispatchEvent(new CustomEvent('dataset:created', { detail: { projectId, datasetId: resp.id } })) }catch(e){}
                // Navigate to schema page next
                nav(`/projects/${projectId}/datasets/${resp.id}/schema`)
              }catch(e:any){ setError(e.message) } finally { setCreating(false); setCreatingStage('idle') }
            }}
          >
            {creating ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary"></span>
                {creatingStage === 'creating' ? 'Creating…' : creatingStage === 'uploading' ? 'Uploading file…' : 'Working…'}
              </span>
            ) : 'Create dataset'}
          </button>
          <button className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" onClick={()=>nav(-1)}>Cancel</button>
        </div>
      </div>
      {creating && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-sm text-gray-700">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
            <div>{creatingStage === 'creating' ? 'Creating dataset…' : creatingStage === 'uploading' ? 'Uploading file…' : 'Working…'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
