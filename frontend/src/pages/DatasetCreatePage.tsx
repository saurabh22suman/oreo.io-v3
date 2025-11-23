import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { checkTableExists, createDatasetTop, getProject, myProjectRole, prepareDataset, inferSchemaFromFile, setDatasetSchemaTop, getDatasetSchemaTop } from '../api'
import Alert from '../components/Alert'
import { Upload, File as FileIcon, X, Database, Cloud, Server, HardDrive, ArrowRight } from 'lucide-react'

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
        setCreatingStage(localFile ? 'uploading' : 'creating')
        resp = await prepareDataset(projectId, { name, schema: s, table: tClean, source }, localFile || undefined)
        const datasetId = resp?.id

        if (datasetId && localFile) {
          try {
            setCreatingStage('inferring')
            const inf = await inferSchemaFromFile(localFile)
            const schemaObj = inf?.schema ?? inf
            if (schemaObj) {
              setCreatingStage('finalizing')
              await setDatasetSchemaTop(datasetId, schemaObj)
            }
          } catch (e) {
            // Ignore inference errors, proceed
          }
        }
        try { window.dispatchEvent(new CustomEvent('dataset:created', { detail: { projectId, datasetId } })) } catch (e) { }
        nav(`/projects/${projectId}/datasets/${resp.id}/schema`)
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8 text-[var(--text)]">New Dataset</h1>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {role === 'viewer' && (
        <Alert type="warning" message="You have read-only access to this project." onClose={() => { }} />
      )}

      {/* Main Upload Area */}
      {!localFile ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-all duration-300 ease-in-out cursor-pointer group
              ${isDragging
                ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.01]'
                : 'border-[var(--text-muted)] hover:border-[var(--primary)] hover:bg-[var(--bg-surface)]'}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="flex flex-col items-center gap-6 pointer-events-none">
              <div className={`h-20 w-20 rounded-full flex items-center justify-center transition-colors duration-300
                ${isDragging ? 'bg-[var(--primary)]/10' : 'bg-[var(--bg-page)] group-hover:bg-[var(--primary)]/5'}`}>
                <Upload className={`h-10 w-10 transition-colors duration-300 ${isDragging ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--primary)]'}`} />
              </div>
              <div>
                <p className="text-xl font-semibold text-[var(--text)]">Drag and drop your file here</p>
                <p className="text-sm text-[var(--text-secondary)] mt-2">Supports CSV, Excel, JSON, Parquet</p>
              </div>
            </div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.json,.parquet"
              onChange={e => {
                if (e.target.files?.[0]) {
                  setLocalFile(e.target.files[0])
                  setSource('local')
                  if (!name) setName(e.target.files[0].name.split('.').slice(0, -1).join('.'))
                }
              }}
            />
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowConnectorModal(true)}
              className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium text-base hover:underline inline-flex items-center gap-2 transition-colors"
            >
              <span>+ Add from other sources</span>
            </button>
          </div>
        </div>
      ) : (
        /* File Selected View */
        <div className="card p-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-[var(--primary)]/10 rounded-lg flex items-center justify-center">
                <FileIcon className="h-6 w-6 text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text)] text-lg">{localFile.name}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{(localFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={() => setLocalFile(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Dataset Name</label>
              <input
                className="input-std"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sales Data 2024"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Schema</label>
                <input
                  className="input-std"
                  value={schema}
                  onChange={e => setSchema(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Table</label>
                <input
                  className={`input-std ${tableError ? 'border-red-500' : ''}`}
                  value={table}
                  onChange={e => { setTable(e.target.value); setTableTouched(true) }}
                />
                {tableError && <p className="text-xs text-red-500 mt-1">{tableError}</p>}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary"
              >
                {creating ? 'Creating...' : 'Create Dataset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connector Modal */}
      {showConnectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-[var(--divider)]">
            <div className="p-6 border-b border-[var(--divider)] flex justify-between items-center bg-[var(--bg-surface)] sticky top-0 z-10">
              <h2 className="text-xl font-bold text-[var(--text)]">Add from other sources</h2>
              <button onClick={() => setShowConnectorModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Dataset Name</label>
                <input
                  className="input-std"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter dataset name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Source</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 's3', label: 'Amazon S3', icon: Cloud },
                    { id: 'azure', label: 'Azure Blob', icon: HardDrive },
                    { id: 'gcs', label: 'Google Cloud', icon: Cloud },
                    { id: 'mssql', label: 'SQL Server', icon: Database },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSource(opt.id as any)}
                      className={`flex flex-col items-center gap-3 p-4 rounded-lg border transition-all duration-200
                        ${source === opt.id
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]'
                          : 'border-[var(--divider)] hover:border-[var(--text-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-page)]'}`}
                    >
                      <opt.icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Config Fields */}
              <div className="bg-[var(--bg-page)] rounded-lg p-5 border border-[var(--divider)] space-y-4">
                {source === 's3' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Access Key ID" className="input-std" value={s3Cfg.accessKeyId} onChange={e => setS3Cfg({ ...s3Cfg, accessKeyId: e.target.value })} />
                      <input type="password" placeholder="Secret Access Key" className="input-std" value={s3Cfg.secretAccessKey} onChange={e => setS3Cfg({ ...s3Cfg, secretAccessKey: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Region" className="input-std" value={s3Cfg.region} onChange={e => setS3Cfg({ ...s3Cfg, region: e.target.value })} />
                      <input placeholder="Bucket Name" className="input-std" value={s3Cfg.bucket} onChange={e => setS3Cfg({ ...s3Cfg, bucket: e.target.value })} />
                    </div>
                    <input placeholder="File Path" className="input-std" value={s3Cfg.path} onChange={e => setS3Cfg({ ...s3Cfg, path: e.target.value })} />
                  </>
                )}
                {source === 'azure' && (
                  <>
                    <input placeholder="Storage Account Name" className="input-std" value={azureCfg.accountName} onChange={e => setAzureCfg({ ...azureCfg, accountName: e.target.value })} />
                    <input type="password" placeholder="Access Key" className="input-std" value={azureCfg.accessKey} onChange={e => setAzureCfg({ ...azureCfg, accessKey: e.target.value })} />
                    <input placeholder="Container Name" className="input-std" value={azureCfg.container} onChange={e => setAzureCfg({ ...azureCfg, container: e.target.value })} />
                    <input placeholder="Blob Path" className="input-std" value={azureCfg.path} onChange={e => setAzureCfg({ ...azureCfg, path: e.target.value })} />
                  </>
                )}
                {source === 'gcs' && (
                  <>
                    <div className="relative">
                      <input type="file" accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setGcsCfg({ ...gcsCfg, keyFile: e.target.files?.[0] })} />
                      <div className="input-std flex items-center justify-between text-[var(--text-secondary)]">
                        <span>{gcsCfg.keyFile ? gcsCfg.keyFile.name : 'Select Service Account JSON'}</span>
                        <Upload className="h-4 w-4" />
                      </div>
                    </div>
                    <input placeholder="Bucket Name" className="input-std" value={gcsCfg.bucket} onChange={e => setGcsCfg({ ...gcsCfg, bucket: e.target.value })} />
                    <input placeholder="File Path" className="input-std" value={gcsCfg.path} onChange={e => setGcsCfg({ ...gcsCfg, path: e.target.value })} />
                  </>
                )}
                {source === 'mssql' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Host" className="input-std" value={mssqlCfg.host} onChange={e => setMssqlCfg({ ...mssqlCfg, host: e.target.value })} />
                      <input type="number" placeholder="Port" className="input-std" value={mssqlCfg.port} onChange={e => setMssqlCfg({ ...mssqlCfg, port: Number(e.target.value) })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Database" className="input-std" value={mssqlCfg.database} onChange={e => setMssqlCfg({ ...mssqlCfg, database: e.target.value })} />
                      <input placeholder="Schema" className="input-std" value={mssqlCfg.schema} onChange={e => setMssqlCfg({ ...mssqlCfg, schema: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder="Username" className="input-std" value={mssqlCfg.username} onChange={e => setMssqlCfg({ ...mssqlCfg, username: e.target.value })} />
                      <input type="password" placeholder="Password" className="input-std" value={mssqlCfg.password} onChange={e => setMssqlCfg({ ...mssqlCfg, password: e.target.value })} />
                    </div>
                    <input placeholder="Table Name" className="input-std" value={mssqlCfg.table} onChange={e => setMssqlCfg({ ...mssqlCfg, table: e.target.value })} />
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Schema</label>
                  <input className="input-std" value={schema} onChange={e => setSchema(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Table</label>
                  <input className="input-std" value={table} onChange={e => setTable(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-[var(--divider)]">
                <button onClick={() => setShowConnectorModal(false)} className="px-5 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-page)] rounded-lg transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="btn-primary">
                  {creating ? 'Creating...' : 'Create Dataset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {creating && (
        <div className="fixed inset-0 bg-[var(--bg-surface)]/80 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--divider)] border-t-[var(--primary)]"></div>
            <p className="text-[var(--text)] font-medium text-lg">
              {creatingStage === 'uploading' ? 'Uploading file...' :
                creatingStage === 'inferring' ? 'Analyzing data...' :
                  creatingStage === 'finalizing' ? 'Finalizing...' : 'Creating dataset...'}
            </p>
          </div>
        </div>
      )}

      <style>{`
        .input-std {
          width: 100%;
          background-color: var(--bg-surface);
          border: 1px solid var(--text-muted);
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 14px;
          color: var(--text);
          outline: none;
          transition: all 0.2s;
        }
        .input-std:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
        }
        .input-std::placeholder {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}
