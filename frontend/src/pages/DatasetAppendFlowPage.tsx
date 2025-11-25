import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, getDataset, previewAppend, appendDatasetDataTop, validateEditedJSONTop, listMembers, myProjectRole, currentUser } from '../api'
import Alert from '../components/Alert'
import AgGridDialog from '../components/AgGridDialog'
import { ChevronLeft, Upload, FileCheck, Edit3, Eye, Send, X, AlertCircle, Users, File as FileIcon } from 'lucide-react'

export default function DatasetAppendFlowPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [cols, setCols] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [openMode, setOpenMode] = useState<'edit' | 'preview' | null>(null)
  const [members, setMembers] = useState<{ id: number; email: string; role: string }[]>([])
  const [submitDialog, setSubmitDialog] = useState(false)
  const [title, setTitle] = useState('Append data')
  const [comment, setComment] = useState('')
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([])
  const [meUser, setMeUser] = useState<{ id: number; email: string } | null>(null)
  const [validationDetails, setValidationDetails] = useState<any | null>(null)
  const [invalidRows, setInvalidRows] = useState<number[]>([])
  const [invalidCells, setInvalidCells] = useState<Array<{ row: number; column: string }>>([])
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [editedCells, setEditedCells] = useState<Array<{ rowIndex: number; column: string; oldValue: any; newValue: any }>>([])


  const typeMap = useMemo(() => {
    try {
      const raw = dataset?.schema
      const schema = typeof raw === 'string' ? JSON.parse(raw) : raw
      const props = schema?.properties || {}
      const m: Record<string, string> = {}
      for (const key of Object.keys(props)) {
        const t = (props[key]?.type) as any
        if (Array.isArray(t)) {
          if (t.includes('integer')) m[key] = 'integer'
          else if (t.includes('number')) m[key] = 'number'
          else if (t.includes('boolean')) m[key] = 'boolean'
          else if (t.includes('string')) m[key] = 'string'
          else if (t.length) m[key] = String(t[0])
        } else if (typeof t === 'string') {
          m[key] = t
        }
      }
      return m
    } catch { return {} as Record<string, string> }
  }, [dataset])

  function coerceValue(expected: string, val: any) {
    if (val === null || val === undefined) return val
    if (typeof val === 'string') {
      const s = val.trim()
      switch (expected) {
        case 'integer':
          return /^-?\d+$/.test(s) ? Number(s) : val
        case 'number':
          return /^-?(\d+|\d*\.\d+)$/.test(s) ? Number(s) : val
        case 'boolean':
          if (/^(true|false)$/i.test(s)) return /^true$/i.test(s)
          if (s === '1' || s === '0') return s === '1'
          return val
        default:
          return val
      }
    }
    if (typeof val === 'number') {
      if (expected === 'integer') return Math.trunc(val)
      if (expected === 'boolean') return val !== 0
      return val
    }
    if (typeof val === 'boolean') {
      if (expected === 'integer' || expected === 'number') return val ? 1 : 0
      return val
    }
    return val
  }

  function normalizeRowsBySchema(input: any[]): any[] {
    if (!input || !Array.isArray(input) || !typeMap) return input
    return input.map((row: any) => {
      const copy: any = { ...row }
      for (const k of Object.keys(typeMap)) {
        if (Object.prototype.hasOwnProperty.call(copy, k)) {
          copy[k] = coerceValue(typeMap[k], copy[k])
        }
      }
      return copy
    })
  }

  function resetValidationMarks() {
    setInvalidRows([])
    setInvalidCells([])
  }

  function resetAppendState() {
    setTitle('Append data')
    setComment('')
    setSelectedReviewerIds([])
    setRows([])
    setCols([])
    setFile(null)
    setOpen(false)
    setValidationDetails(null)
    resetValidationMarks()
  }

  function extractValidationMarks(v: any) {
    try {
      const badRows = new Set<number>()
      const badCells: Array<{ row: number; column: string }> = []
      const se = (v?.schema?.errors || []) as Array<any>
      if (Array.isArray(se)) {
        for (const e of se) {
          const r = (typeof e?.row === 'number') ? e.row : (typeof e?.instanceIndex === 'number' ? e.instanceIndex : undefined)
          const col = Array.isArray(e?.path) && e.path.length ? String(e.path[0]) : undefined
          if (typeof r === 'number') {
            badRows.add(r)
            if (col) badCells.push({ row: r, column: col })
          }
        }
      }
      const re = (v?.rules?.errors || []) as Array<any>
      if (Array.isArray(re)) {
        for (const e of re) {
          const col = e?.column ? String(e.column) : undefined
          const rows: number[] = Array.isArray(e?.rows) ? e.rows : []
          for (const r of rows) { if (typeof r === 'number') { badRows.add(r); if (col) badCells.push({ row: r, column: col }) } }
        }
      }
      setInvalidRows(Array.from(badRows))
      setInvalidCells(badCells)
    } catch { /* noop */ }
  }

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
        const mem = await listMembers(projectId).catch(() => [])
        setMembers(mem as any[])
        try { const me = await currentUser(); setMeUser({ id: me.id, email: me.email }) } catch { }
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { setRole(null) }
      } catch (e: any) { setError(e.message) }
    })()
  }, [projectId, dsId])

  const approverOptions = useMemo(() => {
    if (!members?.length) return [] as { id: number; email: string; role: string }[]
    const meId = meUser?.id
    const meEmail = meUser?.email?.trim().toLowerCase()
    return members.filter(m => {
      const mEmail = m?.email?.trim?.().toLowerCase?.() || ''
      const notSelfById = typeof meId === 'number' ? (m.id !== meId) : true
      const notSelfByEmail = meEmail ? (mEmail !== meEmail) : true
      return notSelfById && notSelfByEmail
    })
  }, [members, meUser])

  useEffect(() => {
    if (!meUser) return
    setSelectedReviewerIds(prev => prev.filter(id => id !== meUser.id))
  }, [meUser])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      setFile(droppedFile)
      setRows([])
      setCols([])
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dataset
          </Link>

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Append Data</h1>
              <p className="text-slate-300 text-sm mt-1">{dataset?.name || `Dataset #${dsId}`}</p>
            </div>
          </div>

          {role === 'viewer' && (
            <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-200">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">You have viewer permissions and cannot append data</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {validationDetails && (
          <Alert
            type="warning"
            message={formatValidationDetails(validationDetails)}
            onClose={() => setValidationDetails(null)}
          />
        )}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

        {!file ? (
          /* Drag and Drop Area */
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer ${isDragging
                ? 'border-blue-500 bg-blue-500/5 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-append')?.click()}
            >
              <div className="flex flex-col items-center gap-6">
                <div className={`h-20 w-20 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                  <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-blue-500' : 'text-slate-400'
                    }`} />
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">Drag and drop your file here</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Supports CSV, Excel, JSON</p>
                </div>
              </div>
              <input
                id="file-append"
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,.json"
                onChange={e => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0])
                    setRows([])
                    setCols([])
                  }
                }}
                disabled={role === 'viewer'}
              />
            </div>
          </div>
        ) : (
          /* File Selected View */
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{file.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={role === 'viewer' || !file}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!file) return
                    try {
                      if (rows && rows.length > 0) {
                        setOpenMode('edit')
                        setOpen(true)
                        return
                      }
                      const pv = await previewAppend(projectId, dsId, file, 500, 0)
                      setRows(pv.data || []); setCols(pv.columns || [])
                      setOpenMode('edit')
                      setOpen(true)
                    } catch (e: any) { setError(e.message || 'Preview failed') }
                  }}
                >
                  <Edit3 className="w-5 h-5" />
                  Live Edit
                </button>

                <button
                  disabled={!rows.length}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { setOpenMode('preview'); setOpen(true) }}
                >
                  <Eye className="w-5 h-5" />
                  Preview Edited
                </button>

                <button
                  disabled={role === 'viewer' || !file}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setSubmitDialog(true)}
                >
                  <Send className="w-5 h-5" />
                  Submit Change
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`${openMode === 'edit' ? 'Edit' : 'Preview'}: ${file?.name || ''}`}
        rows={rows}
        columns={cols}
        pageSize={100}
        allowEdit={role !== 'viewer' && openMode === 'edit'}
        compact={openMode === 'preview' || openMode === 'edit'}
        invalidRows={invalidRows}
        invalidCells={invalidCells}
        editedCells={editedCells}
        onSave={openMode === 'edit' ? async (updated, edits) => {
          const normalized = normalizeRowsBySchema(updated);
          setRows(normalized);
          setEditedCells(edits || []);
          setToast('Edits saved locally. They will be validated on Submit.');
          resetValidationMarks();
          setOpen(false)
        } : undefined}
      />

      {submitDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/20">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Submit Change Request</h3>
                  <p className="text-sm text-blue-100">Create a change request for review</p>
                </div>
              </div>
              <button onClick={() => setSubmitDialog(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Title</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Change request title"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Comment (Optional)</label>
                <textarea
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Add an initial comment to provide context..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Approvers *</label>
                </div>
                <div className="border-2 border-slate-200 dark:border-slate-600 rounded-xl p-4 max-h-60 overflow-auto bg-slate-50 dark:bg-slate-900">
                  {!meUser && <div className="text-sm text-slate-500 dark:text-slate-400">Loading approvers…</div>}
                  {meUser && approverOptions.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">No other project members available</div>}
                  {meUser && approverOptions.map(a => (
                    <label key={a.id} className="flex items-center gap-3 py-2 px-3 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        checked={selectedReviewerIds.includes(a.id)}
                        onChange={(e) => setSelectedReviewerIds(prev => {
                          if (meUser && a.id === meUser.id) return prev.filter(x => x !== a.id)
                          return e.target.checked ? Array.from(new Set([...prev, a.id])) : prev.filter(x => x !== a.id)
                        })}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.email}</span>
                      <span className="ml-auto text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full">{a.role}</span>
                    </label>
                  ))}
                </div>
                {selectedReviewerIds.length === 0 && (
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please select at least one approver
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 flex gap-3 justify-end border-t border-slate-200 dark:border-slate-700">
              <button
                className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-semibold rounded-xl transition-all"
                onClick={() => setSubmitDialog(false)}
              >
                Cancel
              </button>
              <button
                disabled={!file || selectedReviewerIds.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={async () => {
                  if (!file) return
                  setError('')
                  setValidationDetails(null)
                  resetValidationMarks()
                  try {
                    if (rows.length) {
                      const normalized = normalizeRowsBySchema(rows)
                      setRows(normalized)
                      const v = await validateEditedJSONTop(dsId, normalized, (file?.name?.replace(/\.[^.]+$/, '') || 'edited') + '.json')
                      if (!v?.ok) {
                        setSubmitDialog(false)
                        // Check for schema mismatch (column structure issues)
                        if (v?.schema_mismatch || v?.error === 'schema_mismatch') {
                          setError(v?.message || 'The data you are trying to upload does not match the destination schema. Please contact your admin to review.')
                          setValidationDetails({ schema_mismatch: true, ...v?.details })
                          return
                        }
                        setError('Validation failed. See details below.')
                        const details = { schema: v?.schema, rules: v?.rules }
                        setValidationDetails(details)
                        extractValidationMarks(details)
                        setOpen(true)
                        return
                      }
                      const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE || '/api'}/datasets/${dsId}/data/append/open`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
                        body: JSON.stringify({ upload_id: v.upload_id, reviewer_ids: selectedReviewerIds, title, comment, edited_cells: editedCells })
                      })
                      if (res.ok) { setSubmitDialog(false); resetAppendState(); setToast('Change Request submitted') } else { setSubmitDialog(false); setError('Submit failed') }
                    } else {
                      const v = await appendDatasetDataTop(dsId, file)
                      if (!v?.ok) {
                        setSubmitDialog(false)
                        // Check for schema mismatch (column structure issues)
                        if (v?.schema_mismatch || v?.error === 'schema_mismatch') {
                          setError(v?.message || 'The data you are trying to upload does not match the destination schema. Please contact your admin to review.')
                          setValidationDetails({ schema_mismatch: true, ...v?.details })
                          return
                        }
                        setError('Validation failed. See details below.')
                        const details = { schema: v?.schema, rules: v?.rules }
                        setValidationDetails(details)
                        extractValidationMarks(details)
                        setOpen(true)
                        return
                      }
                      const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE || '/api'}/datasets/${dsId}/data/append/open`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) },
                        body: JSON.stringify({ upload_id: v.upload_id, reviewer_ids: selectedReviewerIds, title, comment, edited_cells: editedCells })
                      })
                      if (res.ok) { setSubmitDialog(false); resetAppendState(); setToast('Change Request submitted') } else { setSubmitDialog(false); setError('Submit failed') }
                    }
                  } catch (e: any) { setSubmitDialog(false); setError(e?.message || 'Validation failed') }
                }}
              >
                <Send className="w-5 h-5" />
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatValidationDetails(v: any): string {
  if (!v) return ''
  const parts: string[] = []
  
  // Handle schema mismatch (column structure issues)
  if (v.schema_mismatch) {
    if (v.missing_columns?.length) {
      parts.push(`Missing columns: ${v.missing_columns.join(', ')}`)
    }
    if (v.extra_columns?.length) {
      parts.push(`Extra columns (will be ignored): ${v.extra_columns.join(', ')}`)
    }
    if (v.type_mismatches?.length) {
      const lines = v.type_mismatches.map((tm: any) => tm.message || `Column '${tm.column}' type mismatch`)
      parts.push(lines.join('\n'))
    }
    if (v.messages?.length) {
      parts.push(v.messages.join('\n'))
    }
    if (parts.length) return parts.join('\n')
    return 'Schema mismatch detected. Please contact your admin to review.'
  }
  
  if (v.schema && typeof v.schema === 'object') {
    const se = (v.schema.errors || []) as Array<any>
    if (Array.isArray(se) && se.length) {
      const lines = se.slice(0, 50).map((e) => {
        const col = Array.isArray(e?.path) && e.path.length ? String(e.path[0]) : '(root)'
        const row = (typeof e?.row === 'number') ? `row ${e.row + 1}` : 'row ?'
        return `Schema: ${row}, column '${col}': ${e?.message || 'invalid'}`
      })
      parts.push(lines.join('\n'))
      if (se.length > 50) parts.push(`…and ${se.length - 50} more schema issues`)
    }
  }
  if (v.rules && typeof v.rules === 'object') {
    const re = (v.rules.errors || []) as Array<any>
    if (Array.isArray(re) && re.length) {
      const lines = re.slice(0, 50).map((e) => {
        const col = e?.column || '(unknown)'
        const rows = Array.isArray(e?.rows) ? e.rows.slice(0, 5).map((r: any) => (Number.isInteger(r) ? (r + 1) : r)).join(',') + (e.rows.length > 5 ? '…' : '') : '?'
        return `Rule '${e?.rule || ''}': column '${col}', rows ${rows}: ${e?.message || 'violated'}`
      })
      parts.push(lines.join('\n'))
      if (re.length > 50) parts.push(`…and ${re.length - 50} more rule issues`)
    }
  }
  if (!parts.length) return 'Validation failed.'
  return parts.join('\n')
}
