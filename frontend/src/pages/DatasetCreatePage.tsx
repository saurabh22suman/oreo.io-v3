import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { checkTableExists, createDatasetTop, getProject, myProjectRole, stageUpload, inferSchemaFromFile } from '../api'
import Alert from '../components/Alert'
import { Upload, Database, FileText, CheckCircle, AlertCircle, X, ChevronRight, Loader2, Cloud, HardDrive, Info, File as FileIcon, ArrowRight, ArrowLeft } from 'lucide-react'

// Reserved words (extendable)
const PG_RESERVED = new Set([
  'select', 'table', 'user', 'order', 'group', 'where', 'from', 'join', 'insert', 'update', 'delete', 'create', 'drop', 'alter'
])

function postgresSlugify(name: string) {
  let s = (name || '').toLowerCase()
  s = s.replace(/\s+/g, '_')
  s = s.replace(/[^a-z0-9_]/g, '')
  s = s.replace(/_+/g, '_')
  s = s.replace(/^_+|_+$/g, '')
  if (/^\d/.test(s)) s = '_' + s
  if (PG_RESERVED.has(s)) s = s + '_'
  if (s.length > 63) s = s.slice(0, 63)
  return s || 'project'
}

const slugifyDbName = postgresSlugify

export default function DatasetCreatePage() {
  const { id } = useParams()
  const projectId = Number(id)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [source, setSource] = useState<'local' | 's3' | 'azure' | 'gcs' | 'mssql'>('local')
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [s3Cfg, setS3Cfg] = useState({ accessKeyId: '', secretAccessKey: '', region: '', bucket: '', path: '' })
  const [azureCfg, setAzureCfg] = useState({ accountName: '', accessKey: '', container: '', path: '' })
  const [gcsCfg, setGcsCfg] = useState<{ keyFile?: File | null; bucket?: string; path?: string }>({ keyFile: null, bucket: '', path: '' })
  const [mssqlCfg, setMssqlCfg] = useState({ host: '', port: 1433, database: '', username: '', password: '', schema: 'dbo', table: '' })
  const [schema, setSchema] = useState('')
  const [table, setTable] = useState('')
  const [tableTouched, setTableTouched] = useState(false)
  const [autoValue, setAutoValue] = useState('')

  // UI State
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [tableError, setTableError] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingStage, setCreatingStage] = useState<'idle' | 'creating' | 'uploading' | 'inferring' | 'finalizing'>('idle')
  const [existsInfo, setExistsInfo] = useState<{ checking: boolean; exists: boolean; message?: string }>({ checking: false, exists: false })
  const [showConnectorModal, setShowConnectorModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const existsTimer = useRef<number | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const p = await getProject(projectId); setProject(p)
        const s = slugifyDbName(p?.name || '')
        setSchema(s || 'public')
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { setRole(null) }
      } catch (e: any) { setError(e.message) }
    })()
  }, [projectId])

  // Auto-fill table from name
  useEffect(() => {
    const s = postgresSlugify(name)
    if (!tableTouched || table === autoValue) {
      setTable(s)
      setAutoValue(s)
    }
  }, [name])

  // Validation
  useEffect(() => {
    if (!name || name.trim() === '') setNameError('Dataset name is required')
    else setNameError('')
  }, [name])

  function isValidTableName(v: string) {
    if (!v) return false
    if (!/^[a-z0-9_]+$/.test(v)) return false
    if (/^\d/.test(v)) return false
    if (v.length > 63) return false
    if (PG_RESERVED.has(v)) return false
    return true
  }

  useEffect(() => {
    const v = (table || '').trim()
    if (!v) { setTableError('Enter a valid table name') }
    else if (!isValidTableName(v)) { setTableError('Invalid table name (lowercase, numbers, underscores)') }
    else setTableError('')
  }, [table])

  useEffect(() => {
    const s = (schema || slugifyDbName(project?.name || '')).trim()
    const t = (table || '').trim()
    if (existsTimer.current) { clearTimeout(existsTimer.current); existsTimer.current = null }
    if (!s || !t || tableError) { setExistsInfo({ checking: false, exists: false }); return }
    setExistsInfo({ checking: true, exists: false })
    existsTimer.current = window.setTimeout(() => {
      let cancelled = false
      checkTableExists(s, t).then(res => {
        if (cancelled) return
        setExistsInfo({ checking: false, exists: !!res.exists, message: res.message })
      }).catch(() => { if (!cancelled) setExistsInfo({ checking: false, exists: false }) })
      return () => { cancelled = true }
    }, 300)
  }, [schema, table, project?.name, tableError])

  const targetPreview = useMemo(() => {
    const t = (table || '').trim().replace(/\s+/g, '_')
    const s = (schema || '').trim() || slugifyDbName(project?.name || '') || 'public'
    return `${s}.${t || 'table'}`
  }, [schema, table, project?.name])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setLocalFile(file)
      setSource('local')
      // Auto-populate name if empty
      if (!name) {
        const n = file.name.split('.').slice(0, -1).join('.')
        setName(n)
      }
    }
  }, [name])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setLocalFile(file)
      setSource('local')
      // Auto-populate name if empty
      if (!name) {
        const n = file.name.split('.').slice(0, -1).join('.')
        setName(n)
      }
    }
  }, [name])

  const handleCreate = async () => {
    if (role === 'viewer') { setError('You do not have permission to create datasets'); return }
    if (!name) { setError('Dataset name is required'); return }
    if (nameError) { setError(nameError); return }
    if (tableError) { setError(tableError); return }
    if (existsInfo.exists) { setError('Table already exists, please choose a different name'); return }
    if (!source) { setError('Source is required'); return }

    if (source === 'local' && !localFile) { setError('Please upload a file'); return }
    if (source === 's3' && (!s3Cfg.accessKeyId || !s3Cfg.secretAccessKey || !s3Cfg.region || !s3Cfg.bucket || !s3Cfg.path)) { setError('All S3 fields are required'); return }
    if (source === 'azure' && (!azureCfg.accountName || !azureCfg.accessKey || !azureCfg.container || !azureCfg.path)) { setError('All Azure fields are required'); return }
    if (source === 'gcs' && (!gcsCfg.keyFile || !gcsCfg.bucket || !gcsCfg.path)) { setError('All GCS fields are required'); return }
    if (source === 'mssql' && (!mssqlCfg.host || !mssqlCfg.port || !mssqlCfg.database || !mssqlCfg.username || !mssqlCfg.password || !mssqlCfg.table)) { setError('All SQL Server fields are required'); return }

    setError(''); setCreating(true); setCreatingStage('creating')
    const s = (schema || slugifyDbName(project?.name || '')).trim() || 'public'
    const tClean = (table || '').trim().toLowerCase()
    const dsn = `${s}.${tClean}`

    try {
      let resp: any
      if (source === 'local') {
        // Stage upload - don't create dataset yet, just upload to staging
        setCreatingStage('uploading')
        const stagingResp = await stageUpload(projectId, localFile!)
        
        // Infer schema from file
        let schemaObj = stagingResp.schema
        if (!schemaObj && localFile) {
          try {
            setCreatingStage('inferring')
            const inf = await inferSchemaFromFile(localFile)
            schemaObj = inf?.schema ?? inf
          } catch (e) {
            // Ignore inference errors
          }
        }
        
        // Navigate to schema page with staging info
        nav(`/projects/${projectId}/datasets/new/schema`, { 
          state: { 
            stagingId: stagingResp.staging_id,
            filename: stagingResp.filename,
            rowCount: stagingResp.row_count,
            schema: schemaObj,
            name,
            targetSchema: s,
            table: tClean,
            source
          } 
        })
      } else {
        const sourceConfig: any = { type: source }
        if (source === 's3') sourceConfig.s3 = { ...s3Cfg }
        else if (source === 'azure') sourceConfig.azure = { ...azureCfg }
        else if (source === 'gcs') sourceConfig.gcs = { bucket: gcsCfg.bucket, path: gcsCfg.path }
        else if (source === 'mssql') sourceConfig.mssql = { ...mssqlCfg }

        resp = await createDatasetTop(projectId, ({ name, dataset_name: name, schema: s, table: tClean, source, sourceConfig, target: { type: 'table', dsn } } as any))
        try { window.dispatchEvent(new CustomEvent('dataset:created', { detail: { projectId, datasetId: resp.id } })) } catch (e) { }
        nav(`/projects/${projectId}/datasets/${resp.id}/schema`)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false); setCreatingStage('idle')
    }
  }

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-6 w-px bg-divider" />
            <h1 className="text-xl font-bold text-text font-display">Create New Dataset</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!localFile && (
          <div className="grid md:grid-cols-2 gap-6">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".csv,.json,.parquet"
              onChange={handleFileUpload}
            />
            
            <button
              onClick={() => document.getElementById('file-upload')?.click()}
              className="bg-surface-1 p-8 rounded-3xl border border-divider hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Upload className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2 font-display">Upload File</h3>
                <p className="text-text-secondary text-sm mb-6">
                  Drag and drop or select a local file to upload. Supports CSV, JSON, and Parquet formats.
                </p>
                <div className="flex items-center text-primary font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Select File <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </div>
            </button>

            <button
              onClick={() => setShowConnectorModal(true)}
              className="bg-surface-1 p-8 rounded-3xl border border-divider hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Database className="h-24 w-24 -mr-8 -mt-8 rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2 font-display">Connect Source</h3>
                <p className="text-text-secondary text-sm mb-6">
                  Connect to external data sources like S3, Azure Blob, Google Cloud Storage, or SQL databases.
                </p>
                <div className="flex items-center text-primary font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Add Connection <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </div>
            </button>
          </div>
        )}

        {localFile && (
          /* File Selected View */
          <div className="bg-surface-1 rounded-3xl shadow-lg shadow-black/5 border border-divider overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-divider bg-surface-2/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center shadow-inner border border-primary/10">
                  <FileIcon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-text text-xl mb-1 font-display">{localFile.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <span className="bg-surface-2 px-2 py-0.5 rounded border border-divider font-mono text-xs">
                      {(localFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <span>Local Upload</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setLocalFile(null)} 
                className="p-2 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-danger transition-colors"
                title="Remove file"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid gap-6">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Dataset Name</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sales Data 2024"
                    autoFocus
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
                      Schema <Info className="w-3.5 h-3.5 text-text-muted" />
                    </label>
                    <input
                      className="w-full px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-mono text-sm"
                      value={schema}
                      onChange={e => setSchema(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider flex items-center gap-2">
                      Table Name <Info className="w-3.5 h-3.5 text-text-muted" />
                    </label>
                    <div className="relative">
                      <input
                        className={`w-full px-4 py-3 rounded-xl border bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm font-mono text-sm ${tableError ? 'border-danger focus:border-danger' : 'border-divider focus:border-primary'}`}
                        value={table}
                        onChange={e => { setTable(e.target.value); setTableTouched(true) }}
                      />
                      {existsInfo.checking && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        </div>
                      )}
                      {existsInfo.exists && !existsInfo.checking && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" title="Table already exists">
                          <X className="w-4 h-4" />
                        </div>
                      )}
                      {!existsInfo.exists && !existsInfo.checking && table && !tableError && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    {tableError && <p className="text-xs text-danger mt-2 font-medium flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-danger"></div>{tableError}</p>}
                    {existsInfo.exists && <p className="text-xs text-danger mt-2 font-medium flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-danger"></div>Table already exists</p>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-divider">
                <div className="text-sm text-text-secondary">
                  Target: <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{targetPreview}</span>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating || !!tableError || existsInfo.exists}
                  className="px-8 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  {creating ? 'Processing...' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connector Modal */}
        {showConnectorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-surface-1 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-divider">
              <div className="p-6 border-b border-divider flex justify-between items-center bg-surface-1/95 backdrop-blur sticky top-0 z-10">
                <h2 className="text-2xl font-bold text-text font-display">Add from other sources</h2>
                <button onClick={() => setShowConnectorModal(false)} className="p-2 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Dataset Name</label>
                  <input
                    className="w-full px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter dataset name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Source Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { id: 's3', label: 'Amazon S3', icon: Cloud },
                      { id: 'azure', label: 'Azure Blob', icon: HardDrive },
                      { id: 'gcs', label: 'Google Cloud', icon: Cloud },
                      { id: 'mssql', label: 'SQL Server', icon: Database },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSource(opt.id as any)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-200
                          ${source === opt.id
                            ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary ring-offset-2 ring-offset-surface-1 shadow-lg shadow-primary/10'
                            : 'border-divider hover:border-primary/50 text-text-secondary hover:bg-surface-2 hover:text-text'}`}
                      >
                        <opt.icon className="h-6 w-6" />
                        <span className="text-sm font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Config Fields */}
                <div className="bg-surface-2/50 rounded-2xl p-6 border border-divider space-y-5">
                  <h3 className="font-bold text-text flex items-center gap-2">
                    <div className="w-1.5 h-4 rounded-full bg-primary"></div>
                    Connection Details
                  </h3>
                  
                  {source === 's3' && (
                    <>
                      <div className="grid grid-cols-2 gap-5">
                        <input placeholder="Access Key ID" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={s3Cfg.accessKeyId} onChange={e => setS3Cfg({ ...s3Cfg, accessKeyId: e.target.value })} />
                        <input type="password" placeholder="Secret Access Key" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={s3Cfg.secretAccessKey} onChange={e => setS3Cfg({ ...s3Cfg, secretAccessKey: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <input placeholder="Region" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={s3Cfg.region} onChange={e => setS3Cfg({ ...s3Cfg, region: e.target.value })} />
                        <input placeholder="Bucket Name" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={s3Cfg.bucket} onChange={e => setS3Cfg({ ...s3Cfg, bucket: e.target.value })} />
                      </div>
                      <input placeholder="File Path" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={s3Cfg.path} onChange={e => setS3Cfg({ ...s3Cfg, path: e.target.value })} />
                    </>
                  )}
                  {source === 'azure' && (
                    <>
                      <input placeholder="Storage Account Name" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={azureCfg.accountName} onChange={e => setAzureCfg({ ...azureCfg, accountName: e.target.value })} />
                      <input type="password" placeholder="Access Key" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={azureCfg.accessKey} onChange={e => setAzureCfg({ ...azureCfg, accessKey: e.target.value })} />
                      <input placeholder="Container Name" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={azureCfg.container} onChange={e => setAzureCfg({ ...azureCfg, container: e.target.value })} />
                      <input placeholder="Blob Path" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={azureCfg.path} onChange={e => setAzureCfg({ ...azureCfg, path: e.target.value })} />
                    </>
                  )}
                  {source === 'gcs' && (
                    <>
                      <div className="relative group">
                        <input type="file" accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={e => setGcsCfg({ ...gcsCfg, keyFile: e.target.files?.[0] })} />
                        <div className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text-secondary flex items-center justify-between group-hover:border-primary/50 transition-colors">
                          <span className={gcsCfg.keyFile ? 'text-text font-medium' : ''}>{gcsCfg.keyFile ? gcsCfg.keyFile.name : 'Select Service Account JSON'}</span>
                          <Upload className="h-4 w-4" />
                        </div>
                      </div>
                      <input placeholder="Bucket Name" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={gcsCfg.bucket} onChange={e => setGcsCfg({ ...gcsCfg, bucket: e.target.value })} />
                      <input placeholder="File Path" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={gcsCfg.path} onChange={e => setGcsCfg({ ...gcsCfg, path: e.target.value })} />
                    </>
                  )}
                  {source === 'mssql' && (
                    <>
                      <div className="grid grid-cols-2 gap-5">
                        <input placeholder="Host" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.host} onChange={e => setMssqlCfg({ ...mssqlCfg, host: e.target.value })} />
                        <input type="number" placeholder="Port" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.port} onChange={e => setMssqlCfg({ ...mssqlCfg, port: Number(e.target.value) })} />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <input placeholder="Database" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.database} onChange={e => setMssqlCfg({ ...mssqlCfg, database: e.target.value })} />
                        <input placeholder="Schema" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.schema} onChange={e => setMssqlCfg({ ...mssqlCfg, schema: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <input placeholder="Username" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.username} onChange={e => setMssqlCfg({ ...mssqlCfg, username: e.target.value })} />
                        <input type="password" placeholder="Password" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.password} onChange={e => setMssqlCfg({ ...mssqlCfg, password: e.target.value })} />
                      </div>
                      <input placeholder="Table Name" className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" value={mssqlCfg.table} onChange={e => setMssqlCfg({ ...mssqlCfg, table: e.target.value })} />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Schema</label>
                    <input className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm" value={schema} onChange={e => setSchema(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Table</label>
                    <input className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-sm" value={table} onChange={e => setTable(e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-divider">
                  <button onClick={() => setShowConnectorModal(false)} className="px-6 py-2.5 text-sm font-bold text-text hover:bg-surface-2 rounded-xl transition-colors">Cancel</button>
                  <button onClick={handleCreate} disabled={creating} className="px-8 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {creating ? 'Processing...' : 'Connect & Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {creating && (
          <div className="fixed inset-0 bg-surface-1/90 backdrop-blur-md z-[60] flex items-center justify-center animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-surface-1 border border-divider shadow-2xl max-w-sm w-full text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-surface-2 border-t-primary animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Database className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-text mb-2">
                  {creatingStage === 'uploading' ? 'Uploading File' :
                    creatingStage === 'inferring' ? 'Analyzing Data' :
                      creatingStage === 'finalizing' ? 'Finalizing' : 'Creating Dataset'}
                </h3>
                <p className="text-text-secondary text-sm">
                  {creatingStage === 'uploading' ? 'Please wait while we upload your file securely.' :
                    creatingStage === 'inferring' ? 'We are detecting the schema and data types.' :
                      'Setting up your new dataset environment.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
