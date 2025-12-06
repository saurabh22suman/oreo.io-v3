import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getProject, getDataset, previewAppend, validateEditedJSONTop, openAppendChangeTop, validateBatchRules, getDatasetSchemaTop, listMembers, myProjectRole, currentUser } from '../api'
import Alert from '../components/Alert'
import AgGridDialog from '../components/AgGridDialog'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { 
  ChevronLeft, Upload, FileCheck, Edit3, Eye, Send, X, AlertCircle, Users, 
  File as FileIcon, Loader2, AlertTriangle, CheckCircle, ALargeSmall, Binary, CalendarDays, ToggleRight, Clock4,
  Table2, Trash2, RotateCcw, Save, ArrowRight, Download, FileText, FileSpreadsheet, Info, Lock, Lightbulb, ArrowLeft
} from 'lucide-react'

// Data type definition
type DataType = 'text' | 'number' | 'date' | 'boolean' | 'timestamp'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog'

export default function DatasetAppendFlowPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
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
  const [readonlyColumns, setReadonlyColumns] = useState<Set<string>>(new Set())
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

  // Edit mode info dialog state
  const [showEditInfoDialog, setShowEditInfoDialog] = useState(false)
  const [showEditInfoTooltip, setShowEditInfoTooltip] = useState(false)

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

  function formatValidationDetails(details: any) {
    if (!details) return ''
    if (typeof details === 'string') return details
    if (details.message) return details.message
    return JSON.stringify(details)
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
              className="z-[9999] px-3 py-2 bg-surface-3 border border-divider rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-400 line-through">{String(editInfo.oldValue ?? '')}</span>
                <ArrowRight className="w-3 h-3 text-text-secondary" />
                <span className="text-success font-semibold">{String(editInfo.newValue ?? '')}</span>
              </div>
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-surface-3 border-r border-b border-divider"></div>
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
    const { displayName, columnType, isReadonly } = props
    const icons: Record<DataType, any> = {
      text: ALargeSmall,
      number: Binary,
      date: CalendarDays,
      boolean: ToggleRight,
      timestamp: Clock4
    }
    const Icon = icons[columnType as DataType] || ALargeSmall

    return (
      <div className={`flex items-center gap-1.5 text-xs font-bold ${isReadonly ? 'text-text-muted' : 'text-slate-400'}`}>
        <Icon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        <span>{displayName}</span>
        {isReadonly && (
          <span title="Read-only column">
            <Lock className="w-3 h-3 text-slate-500" />
          </span>
        )}
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
        cellClass: 'bg-surface-2 text-text-secondary text-xs font-mono flex items-center justify-center border-r border-divider',
        headerClass: 'bg-surface-2 border-r border-divider',
      }
    ]

    return [...defs, ...cols.map((c) => {
      const isReadonly = readonlyColumns.has(c)
      return {
        headerName: c,
        field: c,
        colId: c,
        valueGetter: (p: any) => p?.data?.[c],
        valueSetter: (p: any) => { if (!p?.data) return false; p.data[c] = p.newValue; return true },
        editable: editMode && role !== 'viewer' && !isReadonly,
        // Prevent cell focus/click on readonly columns in edit mode
        suppressNavigable: editMode && isReadonly,
        resizable: true,
        sortable: true,
        filter: true,
        headerComponent: CustomHeader,
        headerComponentParams: { columnType: columnTypes[c], isReadonly: editMode && isReadonly },
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
          
          // Non-editable column styling (more prominent in edit mode)
          if (editMode && isReadonly) {
            return { 
              backgroundColor: '#334155', 
              color: '#64748b', 
              cursor: 'not-allowed',
              opacity: 0.7
            }
          }
          
          return undefined
        },
        cellClass: (p: any) => {
          const base = 'text-sm text-text font-mono border-r border-divider'
          if (editMode && isReadonly) {
            return `${base} cursor-not-allowed select-none`
          }
          return base
        },
      }
    })]
  }, [cols, columnTypes, editMode, role, deletedRowIds, validationErrorsMap, editedCellMap, readonlyColumns, ValidationCellRenderer, CustomHeader])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    headerClass: 'bg-surface-2 border-r border-divider',
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

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!rows.length || !cols.length) return
    
    // Filter out deleted rows
    const activeRows = rows.filter((_, idx) => !deletedRowIds.has(idx))
    
    // Build CSV content  
    const headers = cols.join(',')
    const csvRows = activeRows.map(row => 
      cols.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    )
    
    const csvContent = [headers, ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file?.name?.replace(/\.[^/.]+$/, '') || 'preview'}_export.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [rows, cols, deletedRowIds, file])

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
              // Extract readonly columns from business rules
              const readonlyCols = new Set<string>()
              parsedRules.forEach((rule: any) => {
                if (rule.type === 'readonly' && Array.isArray(rule.columns)) {
                  rule.columns.forEach((col: string) => readonlyCols.add(col))
                }
              })
              setReadonlyColumns(readonlyCols)
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
    <div className="min-h-screen bg-surface-1 text-text animate-fade-in">
      {/* Header */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/projects/${projectId}/datasets/${dsId}`}
              className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text leading-tight font-display tracking-tight">Append Data</h1>
                <p className="text-text-secondary text-sm mt-1 font-medium">{dataset?.name || `Dataset #${dsId}`}</p>
              </div>
            </div>
          </div>

          {role === 'viewer' && (
            <div className="mt-6 bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-warning/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm font-medium text-warning">You have viewer permissions and cannot append data</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full px-6 py-8">
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
          <div className="max-w-3xl mx-auto mt-12">
            <div
              className={`relative group border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 cursor-pointer overflow-hidden ${isDragging
                ? 'border-primary bg-primary/5 scale-[1.01] shadow-2xl shadow-primary/10'
                : 'border-divider hover:border-primary/50 hover:bg-surface-2 hover:shadow-xl hover:shadow-primary/5'
                }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-append')?.click()}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative flex flex-col items-center gap-6 z-10">
                <div className={`h-24 w-24 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-primary/20 scale-110' : 'bg-surface-2 group-hover:bg-primary/10 group-hover:scale-105 shadow-lg'
                  }`}>
                  <Upload className={`h-10 w-10 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-text-secondary group-hover:text-primary'
                    }`} />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-text group-hover:text-primary transition-colors">Drag and drop your file here</p>
                  <p className="text-base text-text-secondary">Supports CSV, Excel, JSON</p>
                </div>
                <button className="mt-4 px-6 py-2.5 bg-surface-1 border border-divider rounded-xl text-sm font-medium text-text hover:border-primary/50 hover:text-primary transition-all shadow-sm group-hover:shadow-md">
                  Or browse files
                </button>
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
          <div className="max-w-4xl mx-auto mt-8 space-y-6">
            <div className="bg-surface-1/50 backdrop-blur-sm rounded-3xl shadow-lg shadow-black/5 border border-divider p-8">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-5">
                  <div className="h-16 w-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/10 shadow-inner">
                    <FileIcon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text text-xl tracking-tight">{file.name}</h3>
                    <p className="text-sm text-text-secondary font-medium mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-xl transition-all"
                  title="Remove file"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Validation Error Banner */}
              {hasValidationErrors && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-error">Data Violations Found</h4>
                    <p className="text-sm text-error/80 mt-1">Please review and correct the data before proceeding.</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <button
                  disabled={role === 'viewer' || !file || isValidating}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-surface-2 hover:bg-surface-3 text-text font-semibold rounded-xl border border-divider hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
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
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-primary">Validating...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      Preview & Edit Data
                    </>
                  )}
                </button>

                <button
                  disabled={role === 'viewer' || !file || hasValidationErrors || isValidating}
                  className={`flex-[2] flex items-center justify-center gap-2 px-6 py-4 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                    hasValidationErrors 
                      ? 'bg-surface-3 text-text-muted cursor-not-allowed shadow-none' 
                      : 'bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover text-white shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5'
                  }`}
                  onClick={() => setSubmitDialog(true)}
                  title={hasValidationErrors ? 'Fix validation errors before submitting' : ''}
                >
                  <Send className="w-5 h-5" />
                  Submit Change Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen Preview Mode (like Data Viewer) */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-surface-1 animate-in fade-in duration-200">
          {/* Preview Header */}
          <div className="bg-surface-1/95 backdrop-blur border-b border-divider">
            <div className="max-w-full px-6 py-4">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setPreviewOpen(false)
                      setEditMode(false)
                    }}
                    className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                      <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-text leading-tight">Data Preview</h1>
                      <p className="text-text-secondary text-sm font-medium">{file?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {editMode ? (
                    <>
                      <button
                        onClick={handleUndoAll}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-divider text-text-secondary hover:text-text text-sm font-medium rounded-xl transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Undo All
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-white text-sm font-bold rounded-xl shadow-lg shadow-success/20 transition-all hover:-translate-y-0.5"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditMode(true); setShowEditInfoDialog(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-warning/10 hover:bg-warning/20 border border-warning/20 text-warning text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5"
                      title="Live Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                      Live Edit
                      <span className="text-[10px] bg-warning text-white px-1.5 py-0.5 rounded-md ml-1">Beta</span>
                    </button>
                  )}
                  {/* Info icon with hover tooltip for edit mode */}
                  {editMode && (
                    <div 
                      className="relative"
                      onMouseEnter={() => setShowEditInfoTooltip(true)}
                      onMouseLeave={() => setShowEditInfoTooltip(false)}
                    >
                      <button
                        className="p-2 text-warning hover:text-warning-hover hover:bg-warning/10 rounded-xl transition-colors"
                        title="How to use Live Edit"
                      >
                        <Lightbulb className="w-5 h-5" />
                      </button>
                      {showEditInfoTooltip && (
                        <div className="absolute right-0 top-full mt-2 z-50 w-80 p-4 bg-surface-2 border border-divider rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
                          <div className="text-sm text-text">
                            <p className="font-bold mb-2 text-primary flex items-center gap-2">
                              <Edit3 className="w-4 h-4" />
                              Live Edit Mode
                            </p>
                            <p className="text-text-secondary mb-3 leading-relaxed">
                              Edit cells by double-clicking. Select rows and click delete to mark for deletion.
                              Changes are staged until you submit a change request for approval.
                            </p>
                            {readonlyColumns.size > 0 && (
                              <div className="flex items-start gap-2 p-2 bg-surface-3 rounded-lg mb-2">
                                <Lock className="w-3 h-3 text-text-muted mt-0.5" />
                                <p className="text-text-muted text-xs">
                                  Some columns are read-only based on business rules.
                                </p>
                              </div>
                            )}
                            {businessRules.length > 0 && (
                              <div className="flex items-start gap-2 p-2 bg-surface-3 rounded-lg">
                                <CheckCircle className="w-3 h-3 text-success mt-0.5" />
                                <p className="text-success text-xs">
                                  Business rules are enforced. Invalid values will be highlighted in red.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Error Banner */}
              {hasValidationErrors && (
                <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 text-error" />
                  <span className="font-medium text-error">Data Violation found, please review and edit the data then proceed.</span>
                </div>
              )}

              {/* Dismissible Edit Mode Info Dialog */}
              {editMode && showEditInfoDialog && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl relative animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => setShowEditInfoDialog(false)}
                    className="absolute top-2 right-2 p-1 text-primary hover:text-primary-hover hover:bg-primary/10 rounded-lg transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-start gap-3 pr-6">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                      <Info className="w-5 h-5 text-primary flex-shrink-0" />
                    </div>
                    <div className="text-sm text-text">
                      <p className="font-bold mb-1 text-primary">Live Edit Mode Active</p>
                      <p className="text-text-secondary leading-relaxed">
                        Edit cells by double-clicking. Select rows and click delete to mark for deletion.
                        Changes are staged until you submit a change request for approval.
                        {readonlyColumns.size > 0 && (
                          <span className="block mt-1 text-text-muted font-medium">
                            Note: Some columns are read-only based on business rules.
                          </span>
                        )}
                        {businessRules.length > 0 && (
                          <span className="block mt-1 text-success font-medium">
                            Business rules are enforced. Invalid values will be highlighted in red.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Grid */}
          <div className="w-full">
            <div className="bg-surface-1 border-y border-divider overflow-hidden flex flex-col h-[calc(100vh-180px)]">
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
              <div className="px-4 py-3 border-t border-divider bg-surface-2 flex items-center justify-between text-xs text-text-secondary font-mono">
                <div className="flex items-center gap-4">
                  {/* Download CSV Button */}
                  <button
                    onClick={exportToCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 hover:bg-surface-2 border border-divider text-text-secondary hover:text-text text-xs font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
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
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 border border-error/20 text-error text-xs font-bold rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <span className="px-2 py-1 bg-surface-3 rounded border border-divider">{rows.length - deletedRowIds.size} rows</span>
                  {deletedRowIds.size > 0 && (
                    <span className="px-2 py-1 bg-error/10 text-error rounded border border-error/20 font-bold">{deletedRowIds.size} deleted</span>
                  )}
                  {editedCells.length > 0 && (
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded border border-primary/20 font-bold">{editedCells.length} edits</span>
                  )}
                  {validationErrors.length > 0 && (
                    <span className="px-2 py-1 bg-error/10 text-error rounded border border-error/20 font-bold">{validationErrors.length} errors</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Dialog */}
      <Dialog open={submitDialog} onOpenChange={setSubmitDialog}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-0 bg-surface-1 shadow-2xl shadow-black/20">
          <div className="bg-surface-2/50 p-6 border-b border-divider flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shadow-inner">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-text tracking-tight">Submit Change Request</DialogTitle>
              <DialogDescription className="text-text-secondary text-sm mt-1">
                Create a new change request for approval
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2">Title</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-muted"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Monthly sales data update"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2">Description (Optional)</label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-none placeholder:text-text-muted"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Describe the changes..."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-text-secondary mb-2">Reviewers (Optional)</label>
              <div className="border border-divider rounded-xl bg-surface-2 max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {approverOptions.length === 0 ? (
                  <p className="text-sm text-text-muted p-3 text-center italic">No other members available</p>
                ) : (
                  approverOptions.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-3 hover:bg-surface-3 rounded-lg cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        className="rounded border-divider text-primary focus:ring-primary/20 bg-surface-1 w-4 h-4"
                        checked={selectedReviewerIds.includes(m.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedReviewerIds(prev => [...prev, m.id])
                          else setSelectedReviewerIds(prev => prev.filter(x => x !== m.id))
                        }}
                      />
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary border border-primary/10">
                          {m.email[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">{m.email}</span>
                          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                            {m.role}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-divider">
              <DialogClose asChild>
                <button className="px-5 py-2.5 rounded-xl font-medium text-text-secondary hover:bg-surface-2 hover:text-text transition-colors">
                  Cancel
                </button>
              </DialogClose>
              <button
                disabled={submitting || !title.trim()}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none flex items-center gap-2"
                onClick={async () => {
                  if (!file) return
                  setSubmitting(true)
                  try {
                    // Get the rows to submit (with deleted rows removed)
                    const rowsToSubmit = rows.filter((_, idx) => !deletedRowIds.has(idx))
                    
                    // Step 1: Validate the edited rows and get an upload_id
                    const validateResult = await validateEditedJSONTop(dsId, rowsToSubmit, file.name)
                    if (!validateResult.ok && !validateResult.upload_id) {
                      throw new Error(validateResult.error || 'Validation failed')
                    }
                    
                    // Step 2: Open the change request with title, edited cells, and deleted rows
                    await openAppendChangeTop(dsId, {
                      uploadId: validateResult.upload_id,
                      reviewerId: selectedReviewerIds.length > 1 ? selectedReviewerIds : selectedReviewerIds[0],
                      title: title.trim(),
                      comment: comment.trim() || undefined,
                      editedCells: editedCells,
                      deletedRows: Array.from(deletedRowIds)
                    })
                    
                    setToast('Change request created successfully')
                    setSubmitDialog(false)
                    resetAppendState()
                    setTimeout(() => nav(`/projects/${projectId}/datasets/${dsId}`), 1500)
                  } catch (e: any) {
                    setError(e.message)
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
