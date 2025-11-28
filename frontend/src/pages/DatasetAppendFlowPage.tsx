import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { getProject, getDataset, previewAppend, appendDatasetDataTop, validateEditedJSONTop, validateBatchRules, getDatasetSchemaTop, listMembers, myProjectRole, currentUser } from '../api'
import Alert from '../components/Alert'
import AgGridDialog from '../components/AgGridDialog'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { 
  ChevronLeft, Upload, FileCheck, Edit3, Eye, Send, X, AlertCircle, Users, 
  File as FileIcon, Loader2, AlertTriangle, CheckCircle, Type, Hash, Calendar,
  ToggleLeft, Table2, Trash2, RotateCcw, Save, ArrowRight, Download, FileText, FileSpreadsheet
} from 'lucide-react'

export default function DatasetAppendFlowPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const gridRef = useRef<AgGridReact>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
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
  const [invalidCells, setInvalidCells] = useState<Array<{ row: number; column: string; message?: string }>>([])
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [editedCells, setEditedCells] = useState<Array<{ rowIndex: number; column: string; oldValue: any; newValue: any }>>([])
  const [submitting, setSubmitting] = useState(false)
  
  // Business rules validation state
  const [businessRules, setBusinessRules] = useState<any[]>([])
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; column: string; message: string }>>([])
  const [validationErrorsMap, setValidationErrorsMap] = useState<Map<string, { message: string }>>(new Map())
  const [isValidating, setIsValidating] = useState(false)
  const [hasValidated, setHasValidated] = useState(false)
  const [hasValidationErrors, setHasValidationErrors] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  // Preview mode state (like Data Viewer)
  const [deletedRowIds, setDeletedRowIds] = useState<Set<number>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const originalRowsRef = useRef<any[]>([])

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
    setValidationErrors([])
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
    setHasValidated(false)
    setValidationErrors([])
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

  // Validate data against business rules using Great Expectations
  async function validateDataAgainstRules(dataRows: any[]) {
    if (!businessRules || businessRules.length === 0) {
      setHasValidationErrors(false)
      setValidationErrorsMap(new Map())
      return
    }
    
    try {
      const result = await validateBatchRules(dataRows, businessRules, true)
      const errors: Array<{ row: number; column: string; message: string }> = []
      const errorsMap = new Map<string, { message: string }>()
      
      // Handle the actual API response format which returns 'errors' array
      if (result?.errors && Array.isArray(result.errors)) {
        for (const err of result.errors) {
          const rowIdx = err.row_index ?? err.row ?? -1
          const column = err.column
          const message = err.message || `Validation failed for '${column}'`
          if (typeof rowIdx === 'number' && rowIdx >= 0 && column) {
            errors.push({ row: rowIdx, column, message })
            errorsMap.set(`${rowIdx}|${column}`, { message })
          }
        }
      }
      
      // Also handle legacy format with 'results' array
      if (result?.results && Array.isArray(result.results)) {
        for (const ruleResult of result.results) {
          if (!ruleResult.success && ruleResult.failing_rows) {
            const column = ruleResult.column
            const message = ruleResult.message || `Validation failed for '${column}'`
            for (const rowIdx of ruleResult.failing_rows) {
              errors.push({ row: rowIdx, column, message })
              errorsMap.set(`${rowIdx}|${column}`, { message })
            }
          }
        }
      }
      
      setValidationErrors(errors)
      setValidationErrorsMap(errorsMap)
      setHasValidationErrors(errors.length > 0)
      setHasValidated(true)
      
      // Also update invalidCells for backward compatibility
      const badCells = errors.map(e => ({ row: e.row, column: e.column }))
      setInvalidCells(badCells)
    } catch (e: any) {
      console.error('Business rules validation failed:', e)
      // Don't block if validation fails
      setHasValidationErrors(false)
      setValidationErrorsMap(new Map())
    }
  }

  // Detect column types from data
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {}
    if (rows.length > 0) {
      cols.forEach(col => {
        const val = rows[0][col]
        if (typeof val === 'number') types[col] = 'number'
        else if (typeof val === 'boolean') types[col] = 'boolean'
        else if (val instanceof Date) types[col] = 'date'
        else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') types[col] = 'number'
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) types[col] = 'date'
        else types[col] = 'text'
      })
    }
    return types
  }, [rows, cols])

  // Map for quick lookup of edited cells
  const editedCellMap = useMemo(() => {
    const map = new Map<string, { rowIndex: number; column: string; oldValue: any; newValue: any }>()
    for (const edit of editedCells) {
      map.set(`${edit.rowIndex}|${edit.column}`, edit)
    }
    return map
  }, [editedCells])

  // Cell renderer for validation errors with tooltips
  const ValidationCellRenderer = useCallback((params: any) => {
    const { value, node, colDef } = params
    const rowIndex = node?.rowIndex ?? -1
    const column = colDef?.field
    const key = `${rowIndex}|${column}`
    const validationError = validationErrorsMap?.get(key)
    const editInfo = editedCellMap?.get(key)
    const isDeleted = deletedRowIds?.has(rowIndex)
    const cellRef = useRef<HTMLDivElement>(null)
    const [showTooltip, setShowTooltip] = useState(false)
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

    const handleMouseEnter = () => {
      if (cellRef.current && (validationError || editInfo)) {
        const rect = cellRef.current.getBoundingClientRect()
        setTooltipPos({
          x: rect.left + rect.width / 2,
          y: rect.top - 8
        })
        setShowTooltip(true)
      }
    }

    const handleMouseLeave = () => {
      setShowTooltip(false)
    }

    // Deleted row styling
    if (isDeleted) {
      return (
        <div className="w-full h-full flex items-center">
          <span className="line-through text-red-400 opacity-60">{value}</span>
        </div>
      )
    }

    // Validation error styling with tooltip
    if (validationError) {
      return (
        <div
          ref={cellRef}
          className="w-full h-full flex items-center cursor-help"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span className="text-red-300">{value}</span>
          <AlertCircle className="w-3 h-3 ml-1 text-red-500 flex-shrink-0" />
          {showTooltip && createPortal(
            <div
              style={{
                position: 'fixed',
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="z-[9999] px-3 py-2 bg-red-950 border border-red-700 rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none max-w-xs"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">{validationError.message}</p>
                  {editInfo && (
                    <p className="text-red-400/70 text-[10px] mt-1">
                      Original: {String(editInfo.oldValue ?? '(empty)')}
                    </p>
                  )}
                </div>
              </div>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-red-950 border-r border-b border-red-700"></div>
            </div>,
            document.body
          )}
        </div>
      )
    }

    // Edited cell without error - show change tooltip
    if (editInfo) {
      return (
        <div
          ref={cellRef}
          className="w-full h-full flex items-center cursor-help"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <span>{value}</span>
          {showTooltip && createPortal(
            <div
              style={{
                position: 'fixed',
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="z-[9999] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-400 line-through">{String(editInfo.oldValue ?? '')}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="text-green-400 font-semibold">{String(editInfo.newValue ?? '')}</span>
              </div>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700"></div>
            </div>,
            document.body
          )}
        </div>
      )
    }

    return <span>{value}</span>
  }, [validationErrorsMap, editedCellMap, deletedRowIds])

  // Custom Header Component with type icons
  const CustomHeader = useCallback((props: any) => {
    const { displayName, columnType } = props
    const Icon = {
      text: Type,
      number: Hash,
      date: Calendar,
      boolean: ToggleLeft
    }[columnType] || Type

    return (
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
        <Icon className="w-3.5 h-3.5 opacity-50" />
        <span>{displayName}</span>
      </div>
    )
  }, [])

  // Column definitions for preview grid
  const previewColDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = [
      {
        headerName: '',
        valueGetter: 'node.rowIndex + 1',
        width: 50,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        editable: false,
        cellClass: 'bg-[#0f172a] text-slate-500 text-xs font-mono flex items-center justify-center border-r border-slate-800',
        headerClass: 'bg-[#0f172a] border-r border-slate-800',
      }
    ]

    return [...defs, ...cols.map((c) => ({
      headerName: c,
      field: c,
      colId: c,
      valueGetter: (p: any) => p?.data?.[c],
      valueSetter: (p: any) => { if (!p?.data) return false; p.data[c] = p.newValue; return true },
      editable: editMode && role !== 'viewer',
      resizable: true,
      sortable: true,
      filter: true,
      headerComponent: CustomHeader,
      headerComponentParams: { columnType: columnTypes[c] },
      cellRenderer: ValidationCellRenderer,
      cellStyle: (p: any) => {
        const ri = p?.rowIndex
        const key = `${typeof ri === 'number' ? ri : -1}|${c}`
        
        // Deleted row
        if (typeof ri === 'number' && deletedRowIds.has(ri)) {
          return { backgroundColor: '#450a0a', color: '#f87171', opacity: 0.6 }
        }
        
        // Validation error
        if (validationErrorsMap.has(key)) {
          return { backgroundColor: '#7F1D1D', color: '#FCA5A5' }
        }
        
        // Edited cell
        if (editedCellMap.has(key)) {
          return { backgroundColor: '#1e3a5f', color: '#93c5fd', fontWeight: '600' }
        }
        
        return undefined
      },
      cellClass: 'text-sm text-slate-300 font-mono border-r border-slate-800',
    }))]
  }, [cols, columnTypes, editMode, role, deletedRowIds, validationErrorsMap, editedCellMap, ValidationCellRenderer, CustomHeader])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    headerClass: 'bg-[#0f172a] border-r border-slate-800',
  }), [])

  // Handle cell value changes
  const onCellValueChanged = useCallback((e: CellValueChangedEvent) => {
    const rowIndex = e.rowIndex ?? -1
    const column = e.colDef.field!
    const originalRow = originalRowsRef.current[rowIndex]
    const originalValue = originalRow?.[column]
    
    // Track the edit
    setEditedCells(prev => {
      const existing = prev.findIndex(edit => edit.rowIndex === rowIndex && edit.column === column)
      if (existing >= 0) {
        const updated = [...prev]
        if (e.newValue === originalValue) {
          // Value reverted to original, remove from edited
          updated.splice(existing, 1)
        } else {
          updated[existing] = { rowIndex, column, oldValue: originalValue, newValue: e.newValue }
        }
        return updated
      }
      if (e.newValue !== originalValue) {
        return [...prev, { rowIndex, column, oldValue: originalValue, newValue: e.newValue }]
      }
      return prev
    })
    
    // Update rows
    setRows(prev => {
      const updated = [...prev]
      if (updated[rowIndex]) {
        updated[rowIndex] = { ...updated[rowIndex], [column]: e.newValue }
      }
      return updated
    })
  }, [])

  // Delete row handler
  const handleDeleteRow = useCallback((rowIndex: number) => {
    setDeletedRowIds(prev => new Set(prev).add(rowIndex))
  }, [])

  // Undo all changes
  const handleUndoAll = useCallback(() => {
    setRows([...originalRowsRef.current])
    setEditedCells([])
    setDeletedRowIds(new Set())
  }, [])

  // Save changes and re-validate
  const handleSaveChanges = useCallback(async () => {
    // Remove deleted rows from the data
    const filteredRows = rows.filter((_, idx) => !deletedRowIds.has(idx))
    const normalized = normalizeRowsBySchema(filteredRows)
    setRows(normalized)
    originalRowsRef.current = JSON.parse(JSON.stringify(normalized))
    setEditedCells([])
    setDeletedRowIds(new Set())
    setToast('Changes saved locally.')
    
    // Re-validate
    await validateDataAgainstRules(normalized)
    setEditMode(false)
  }, [rows, deletedRowIds, normalizeRowsBySchema, validateDataAgainstRules])

  // Grid ready handler
  const onGridReady = useCallback((params: { api: GridApi }) => {
    setGridApi(params.api)
    setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
        const mem = await listMembers(projectId).catch(() => [])
        setMembers(mem as any[])
        try { const me = await currentUser(); setMeUser({ id: me.id, email: me.email }) } catch { }
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { setRole(null) }
        // Load business rules for validation
        try {
          const schemaData = await getDatasetSchemaTop(dsId)
          if (schemaData?.rules) {
            // Parse rules if they're a JSON string
            let parsedRules = schemaData.rules
            if (typeof parsedRules === 'string') {
              try {
                parsedRules = JSON.parse(parsedRules)
              } catch { /* keep as is */ }
            }
            // Ensure rules is an array
            if (Array.isArray(parsedRules)) {
              setBusinessRules(parsedRules)
            }
          }
        } catch { /* no rules */ }
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
                    setHasValidationErrors(false)
                    setValidationErrors([])
                    setValidationErrorsMap(new Map())
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

              {/* Validation Error Banner */}
              {hasValidationErrors && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Data Violation found, please review and edit the data then proceed.</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={role === 'viewer' || !file || isValidating}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!file) return
                    try {
                      setIsValidating(true)
                      // Load preview data if not already loaded
                      let previewRows = rows
                      let previewCols = cols
                      if (!rows || rows.length === 0) {
                        const pv = await previewAppend(projectId, dsId, file, 500, 0)
                        previewRows = pv.data || []
                        previewCols = pv.columns || []
                        setRows(previewRows)
                        setCols(previewCols)
                        // Store original rows for undo functionality
                        originalRowsRef.current = JSON.parse(JSON.stringify(previewRows))
                      }
                      // Validate against business rules
                      await validateDataAgainstRules(previewRows)
                      setPreviewOpen(true)
                      setEditMode(false)
                    } catch (e: any) { 
                      setError(e.message || 'Preview failed') 
                    } finally {
                      setIsValidating(false)
                    }
                  }}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5" />
                      Preview Data
                    </>
                  )}
                </button>

                <button
                  disabled={role === 'viewer' || !file || hasValidationErrors || isValidating}
                  className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    hasValidationErrors 
                      ? 'bg-slate-400 text-white cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/20'
                  }`}
                  onClick={() => setSubmitDialog(true)}
                  title={hasValidationErrors ? 'Fix validation errors before submitting' : ''}
                >
                  <Send className="w-5 h-5" />
                  Submit Change
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen Preview Mode (like Data Viewer) */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]">
          {/* Preview Header */}
          <div className="bg-[#0f172a] border-b border-slate-800">
            <div className="max-w-full px-6 py-4">
              <button
                onClick={() => {
                  setPreviewOpen(false)
                  setEditMode(false)
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-4 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Upload
              </button>

              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Table2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white leading-tight">Data Preview</h1>
                    <p className="text-slate-400 text-sm">{file?.name}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  {editMode ? (
                    <>
                      <button
                        onClick={handleUndoAll}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Undo All
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/50 hover:bg-amber-800/50 border border-amber-700/50 text-amber-200 text-sm font-medium rounded-lg transition-colors"
                      title="Live Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                      Live Edit
                      <span className="text-[10px] bg-amber-800 text-amber-200 px-1.5 py-0.5 rounded">Beta</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Error Banner */}
              {hasValidationErrors && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Data Violation found, please review and edit the data then proceed.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Grid */}
          <div className="max-w-full px-6 py-4">
            <div className="bg-[#0f172a] rounded-lg border border-slate-800 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
              <div className="flex-1 ag-theme-databricks-dark w-full">
                <AgGridReact
                  ref={gridRef as any}
                  columnDefs={previewColDefs}
                  defaultColDef={defaultColDef}
                  rowData={rows}
                  animateRows
                  onGridReady={onGridReady as any}
                  onCellValueChanged={onCellValueChanged}
                  enableCellTextSelection
                  suppressPaginationPanel={true}
                  domLayout="normal"
                  rowHeight={32}
                  headerHeight={36}
                  rowSelection={editMode ? { mode: 'multiRow' } as any : undefined}
                />
              </div>

              {/* Footer with stats and actions */}
              <div className="px-4 py-2 border-t border-slate-800 bg-[#0f172a] flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-4">
                  {editMode && (
                    <button
                      onClick={() => {
                        // Delete selected rows
                        if (gridApi) {
                          const selectedNodes = gridApi.getSelectedNodes()
                          selectedNodes.forEach(node => {
                            if (node.rowIndex !== null) {
                              handleDeleteRow(node.rowIndex)
                            }
                          })
                        }
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-red-900/50 hover:bg-red-800/50 border border-red-700/50 text-red-300 text-xs rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <span>{rows.length - deletedRowIds.size} rows</span>
                  {deletedRowIds.size > 0 && (
                    <span className="text-red-400">{deletedRowIds.size} deleted</span>
                  )}
                  {editedCells.length > 0 && (
                    <span className="text-blue-400">{editedCells.length} edits</span>
                  )}
                  {validationErrors.length > 0 && (
                    <span className="text-red-400">{validationErrors.length} errors</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog - kept for compatibility */}
      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Edit: ${file?.name || ''}`}
        rows={rows}
        columns={cols}
        pageSize={100}
        allowEdit={role !== 'viewer' && openMode === 'edit'}
        compact={openMode === 'preview' || openMode === 'edit'}
        invalidRows={invalidRows}
        invalidCells={invalidCells}
        editedCells={editedCells}
        validationErrors={validationErrorsMap}
        onSave={openMode === 'edit' ? async (updated, edits) => {
          const normalized = normalizeRowsBySchema(updated);
          setRows(normalized);
          setEditedCells(edits || []);
          setToast('Edits saved locally. They will be validated on Submit.');
          resetValidationMarks();
          // Re-validate after edit
          await validateDataAgainstRules(normalized);
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
                className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                onClick={() => setSubmitDialog(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                disabled={!file || selectedReviewerIds.length === 0 || submitting}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={async () => {
                  if (!file) return
                  setError('')
                  setValidationDetails(null)
                  resetValidationMarks()
                  setSubmitting(true)
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
                  finally { setSubmitting(false) }
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validating records...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Request
                  </>
                )}
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
