import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getProject, getDataset, getDatasetDataTop, getDatasetSchemaTop, listMembers, myProjectRole, currentUser, validateCellRule } from '../api'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import {
  ChevronLeft, Pencil, Save, RotateCcw, Trash2, Send, X,
  AlertCircle, Users, Loader2, ArrowRight, ArrowLeft, Eye, FileText,
  CheckCircle, XCircle, Info, Lock, Lightbulb, Search, Download, Columns3, Check,
  ALargeSmall, ArrowUp, ArrowDown, Binary, CalendarDays, ToggleRight, Clock4
} from 'lucide-react'

// Data type definition
type DataType = 'text' | 'number' | 'date' | 'boolean' | 'timestamp'

// Data Type Icon component
const DataTypeIcon = ({ type, className = '' }: { type: DataType; className?: string }) => {
  const icons: Record<DataType, any> = {
    text: ALargeSmall,
    number: Binary,
    date: CalendarDays,
    boolean: ToggleRight,
    timestamp: Clock4
  }
  const Icon = icons[type] || ALargeSmall
  return <Icon className={className} />
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api'

type EditedCell = {
  rowIndex: number
  rowId: string
  column: string
  oldValue: any
  newValue: any
}

type DeletedRow = {
  rowIndex: number
  rowId: string
  rowData: any
}

type ValidationError = {
  column: string
  rowId: string
  severity: 'fatal' | 'error' | 'warning' | 'info'
  message: string
  ruleType: string
}

// Severity styling configurations
const SEVERITY_STYLES = {
  fatal: {
    textColor: 'text-red-300',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-950',
    borderColor: 'border-red-700',
    Icon: XCircle,
    label: 'Fatal'
  },
  error: {
    textColor: 'text-red-300',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-950',
    borderColor: 'border-red-700',
    Icon: AlertCircle,
    label: 'Error'
  },
  warning: {
    textColor: 'text-yellow-300',
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-950',
    borderColor: 'border-yellow-700',
    Icon: AlertCircle,
    label: 'Warning'
  },
  info: {
    textColor: 'text-blue-300',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-950',
    borderColor: 'border-blue-700',
    Icon: Info,
    label: 'Info'
  }
}

// Custom cell renderer for cells with validation errors (shows tooltip on hover)
const ValidationErrorCellRenderer = (params: any) => {
  const { value, validationErrors, editedCellMap, deletedRowIds, node, colDef } = params
  const rowId = node?.data?._row_id
  const column = colDef?.field
  const key = `${rowId}|${column}`
  const validationError = validationErrors?.get(key)
  const editInfo = editedCellMap?.get(key)
  const isDeleted = deletedRowIds?.has(rowId)
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

  // Validation error styling with tooltip - severity-aware
  if (validationError) {
    const severity = validationError.severity || 'error'
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.error
    const SeverityIcon = style.Icon
    
    return (
      <div
        ref={cellRef}
        className="w-full h-full flex items-center cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className={style.textColor}>{value}</span>
        <SeverityIcon className={`w-3 h-3 ml-1 ${style.iconColor} flex-shrink-0`} />
        {showTooltip && createPortal(
          <div
            style={{
              position: 'fixed',
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className={`z-[9999] px-3 py-2 ${style.bgColor} border ${style.borderColor} rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none max-w-xs`}
          >
            <div className="flex items-start gap-2">
              <SeverityIcon className={`w-4 h-4 ${style.iconColor} flex-shrink-0 mt-0.5`} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase ${style.textColor}`}>{style.label}</span>
                </div>
                <p className={`${style.textColor} font-medium`}>{validationError.message}</p>
                {editInfo && (
                  <p className={`${style.textColor}/70 text-[10px] mt-1`}>
                    Original: {String(editInfo.oldValue ?? '(empty)')}
                  </p>
                )}
              </div>
            </div>
            <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 ${style.bgColor} border-r border-b ${style.borderColor}`}></div>
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
}

// Custom cell renderer for edited cells with tooltip
const EditedCellRenderer = (params: any) => {
  const { value, editedCellMap, deletedRowIds, node, colDef } = params
  const rowIndex = node?.rowIndex ?? -1
  const rowId = node?.data?._row_id
  const column = colDef?.field
  const editInfo = editedCellMap?.get(`${rowId}|${column}`)
  const isDeleted = deletedRowIds?.has(rowId)
  const cellRef = useRef<HTMLDivElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = () => {
    if (cellRef.current && editInfo) {
      const rect = cellRef.current.getBoundingClientRect()
      setTooltipPos({
        x: rect.left,
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

  if (!editInfo) {
    return <span>{value}</span>
  }

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
            transform: 'translateY(-100%)',
          }}
          className="z-[9999] px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none"
        >
          <div className="flex items-center gap-2">
            <span className="text-red-400 line-through">{String(editInfo.oldValue ?? '')}</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
            <span className="text-green-400 font-semibold">{String(editInfo.newValue ?? '')}</span>
          </div>
          <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700"></div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function LiveEditPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const navigate = useNavigate()
  const gridRef = useRef<AgGridReact>(null)

  // State
  const [api, setApi] = useState<GridApi | null>(null)
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [editableColumns, setEditableColumns] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)

  // Edit tracking
  const [editedCells, setEditedCells] = useState<EditedCell[]>([])
  const [deletedRows, setDeletedRows] = useState<DeletedRow[]>([])
  const [selectedRows, setSelectedRows] = useState<any[]>([])
  const originalRowsRef = useRef<any[]>([])

  // Business rules validation
  const [businessRules, setBusinessRules] = useState<any[]>([])
  const [validationErrors, setValidationErrors] = useState<Map<string, ValidationError>>(new Map())
  const [validating, setValidating] = useState(false)

  // Submit dialog
  const [submitDialog, setSubmitDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('Live edit changes')
  const [comment, setComment] = useState('')
  const [members, setMembers] = useState<{ id: number; email: string; role: string }[]>([])
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<number[]>([])
  const [meUser, setMeUser] = useState<{ id: number; email: string } | null>(null)

  // Pagination
  const [page, setPage] = useState(0)
  const [pageSize] = useState(100)
  const [totalRows, setTotalRows] = useState(0)

  // Search & Column toggle state
  const [showSearch, setShowSearch] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchMatches, setSearchMatches] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(1)
  const [showColumnToggle, setShowColumnToggle] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const columnToggleRef = useRef<HTMLDivElement>(null)

  // Column types from schema
  const [columnTypes, setColumnTypes] = useState<Map<string, DataType>>(new Map())

  // Info dialog state - show popup only on first visit (check localStorage)
  const [showInfoDialog, setShowInfoDialog] = useState(() => {
    const dismissed = localStorage.getItem('liveEditInfoDismissed')
    return dismissed !== 'true'
  })
  const [showInfoTooltip, setShowInfoTooltip] = useState(false)

  // Handler to dismiss and remember
  const dismissInfoDialog = useCallback(() => {
    setShowInfoDialog(false)
    localStorage.setItem('liveEditInfoDismissed', 'true')
  }, [])

  // Computed values
  const editedCellMap = useMemo(() => {
    const map = new Map<string, EditedCell>()
    for (const edit of editedCells) {
      map.set(`${edit.rowId}|${edit.column}`, edit)
    }
    return map
  }, [editedCells])

  const deletedRowIds = useMemo(() => {
    return new Set(deletedRows.map(d => d.rowId))
  }, [deletedRows])

  const hasChanges = editedCells.length > 0 || deletedRows.length > 0

  // Load initial data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const [proj, ds] = await Promise.all([
          getProject(projectId),
          getDataset(projectId, dsId)
        ])
        setProject(proj)
        setDataset(ds)

        // Get role
        try {
          const r = await myProjectRole(projectId)
          setRole(r.role)
        } catch { setRole(null) }

        // Get current user
        try {
          const me = await currentUser()
          if (me?.id) setMeUser({ id: me.id, email: me.email })
        } catch { }

        // Get members for approver selection
        try {
          const mem = await listMembers(projectId)
          setMembers(mem || [])
        } catch { }

        // Get schema to determine editable columns
        try {
          const schemaResp = await getDatasetSchemaTop(dsId)
          if (schemaResp?.schema) {
            const schemaObj = typeof schemaResp.schema === 'string'
              ? JSON.parse(schemaResp.schema)
              : schemaResp.schema

            // Check rules for readonly columns and store business rules
            const readonlyColumns = new Set<string>()
            let rules: any[] = []
            if (schemaResp.rules) {
              rules = typeof schemaResp.rules === 'string'
                ? JSON.parse(schemaResp.rules)
                : schemaResp.rules
              
              if (Array.isArray(rules)) {
                rules.forEach((rule: any) => {
                  if (rule.type === 'readonly' && Array.isArray(rule.columns)) {
                    rule.columns.forEach((col: string) => readonlyColumns.add(col))
                  }
                })
              }
            }
            
            // Store business rules for validation
            setBusinessRules(rules)

            // All columns except readonly ones are editable
            const allColumns = Object.keys(schemaObj.properties || {})
            const editable = new Set(allColumns.filter(col => !readonlyColumns.has(col)))
            setEditableColumns(editable)

            // Extract column types from schema
            const types = new Map<string, DataType>()
            for (const [col, prop] of Object.entries(schemaObj.properties || {})) {
              const p = prop as any
              if (p.type === 'integer' || p.type === 'number') {
                types.set(col, 'number')
              } else if (p.type === 'boolean') {
                types.set(col, 'boolean')
              } else if (p.format === 'date' || p.format === 'date-time') {
                types.set(col, p.format === 'date-time' ? 'timestamp' : 'date')
              } else {
                types.set(col, 'text')
              }
            }
            setColumnTypes(types)
          }
        } catch (e) {
          console.error('Failed to load schema:', e)
          // Default: all columns editable
        }

        // Load data
        await loadData(0, pageSize)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

  // Initialize visible columns when columns change
  useEffect(() => {
    if (columns.length > 0 && visibleColumns.size === 0) {
      setVisibleColumns(new Set(columns))
    }
  }, [columns])

  // Search functionality
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value)
    if (!value.trim()) {
      setSearchMatches(0)
      setCurrentMatch(1)
      return
    }
    
    // Count matches in visible rows
    const searchLower = value.toLowerCase()
    let count = 0
    rows.forEach(row => {
      columns.forEach(col => {
        if (visibleColumns.has(col)) {
          const cellValue = String(row[col] ?? '').toLowerCase()
          if (cellValue.includes(searchLower)) {
            count++
          }
        }
      })
    })
    setSearchMatches(count)
    setCurrentMatch(count > 0 ? 1 : 0)
  }, [rows, columns, visibleColumns])

  // Column toggle handlers
  const toggleColumn = useCallback((field: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(field)) {
        if (next.size > 1) next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }, [])

  const selectAllColumns = useCallback(() => {
    setVisibleColumns(new Set(columns))
  }, [columns])

  const deselectAllColumns = useCallback(() => {
    // Keep at least the first column
    if (columns.length > 0) {
      setVisibleColumns(new Set([columns[0]]))
    }
  }, [columns])

  // Export CSV
  const exportCsv = useCallback(() => {
    if (!api) return
    const visibleCols = columns.filter(c => visibleColumns.has(c))
    const csvHeader = visibleCols.join(',')
    const csvRows = rows.map(row => 
      visibleCols.map(col => {
        const val = String(row[col] ?? '')
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(',')
    )
    const csv = [csvHeader, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dataset?.name || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [api, columns, visibleColumns, rows, dataset])

  // Click outside to close column toggle
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnToggleRef.current && !columnToggleRef.current.contains(e.target as Node)) {
        setShowColumnToggle(false)
      }
    }
    if (showColumnToggle) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColumnToggle])

  const loadData = async (offset: number, limit: number) => {
    try {
      const response = await getDatasetDataTop(dsId, limit, offset)
      if (!response) throw new Error('No response from server')

      let dataArray = response.data || response.rows || []
      const columnsArray = response.columns || []

      // Add internal row ID if not present
      dataArray = dataArray.map((row: any, idx: number) => ({
        ...row,
        _row_id: row._row_id ?? idx
      }))

      setRows(dataArray)
      const visibleColumns = columnsArray.filter((c: string) => c !== '_row_id')
      setColumns(visibleColumns)
      setTotalRows(response.total || dataArray.length)
      originalRowsRef.current = JSON.parse(JSON.stringify(dataArray))
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Start live edit session
  const startSession = async () => {
    if (sessionId) return // Already have a session

    setSessionLoading(true)
    try {
      const response = await fetch(`${API_BASE}/datasets/${dsId}/live-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          project_id: projectId,
          dataset_id: dsId,
          mode: 'full_table'
        })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Failed to start session')
      }

      const data = await response.json()
      setSessionId(data.session_id)
      setToast('Live edit session started')
    } catch (e: any) {
      setError(e.message || 'Failed to start live edit session')
    } finally {
      setSessionLoading(false)
    }
  }

  // Column definitions
  const colDefs = useMemo<ColDef[]>(() => {
    // Filter columns to only show visible ones
    const visibleColumnsList = columns.filter(c => visibleColumns.has(c))
    const dataCols: ColDef[] = visibleColumnsList.map((c, index) => {
      // Add selection checkbox to first column
      const isFirstColumn = index === 0
      const isReadonly = !editableColumns.has(c)
      return {
        headerName: c,
        field: c,
        colId: c,
        // Add checkbox selection to first column only with separator
        ...(isFirstColumn ? {
          headerCheckboxSelection: true,
          checkboxSelection: true,
          cellStyle: { borderRight: '2px solid #334155' },
          headerClass: 'border-r-2 border-slate-700',
        } : {}),
        // Custom header component to show data type icon and Lock icon for readonly columns
        headerComponent: (props: any) => {
          const colType = columnTypes.get(c) || 'text'
          return (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <DataTypeIcon type={colType} className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <span>{props.displayName}</span>
              {isReadonly && (
                <span title="Read-only column">
                  <Lock className="w-3 h-3 text-slate-500" />
                </span>
              )}
            </div>
          )
        },
        editable: (params: any) => {
          // Don't allow editing deleted rows or non-editable columns
          const rowId = params.data?._row_id
          return editableColumns.has(c) && !deletedRowIds.has(rowId)
        },
        // Prevent cell focus/click on readonly columns
        suppressNavigable: isReadonly,
        resizable: true,
        // Use custom renderer for cells with validation errors, deleted rows, or edited cells
        cellRendererSelector: (params: any) => {
          const rowId = params.data?._row_id
          const key = `${rowId}|${c}`
          // Use ValidationErrorCellRenderer for all cells that need special rendering
          if (deletedRowIds.has(rowId) || editedCellMap.has(key) || validationErrors.has(key)) {
            return {
              component: ValidationErrorCellRenderer,
              params: { validationErrors, editedCellMap, deletedRowIds }
            }
          }
          return undefined // Use default renderer (allows editing)
        },
        cellStyle: (params: any) => {
          const rowId = params.data?._row_id
          const key = `${rowId}|${c}`

          // Deleted row styling
          if (deletedRowIds.has(rowId)) {
            return { backgroundColor: '#450a0a', color: '#fca5a5', textDecoration: 'line-through' }
          }

          // Validation styling by severity (validation takes priority over edit styling)
          if (validationErrors.has(key)) {
            const error = validationErrors.get(key)!
            switch (error.severity) {
              case 'fatal':
                return { backgroundColor: '#450a0a', color: '#fca5a5', borderLeft: '4px solid #dc2626' }
              case 'error':
                return { backgroundColor: '#7f1d1d', color: '#fca5a5', borderLeft: '3px solid #ef4444' }
              case 'warning':
                return { backgroundColor: '#78350f', color: '#fcd34d', borderLeft: '3px solid #f59e0b' }
              case 'info':
                return { backgroundColor: '#1e3a5f', color: '#93c5fd', borderLeft: '3px solid #3b82f6' }
              default:
                return { backgroundColor: '#7f1d1d', color: '#fca5a5', borderLeft: '3px solid #ef4444' }
            }
          }

          // Edited cell styling (only if no validation issue)
          if (editedCellMap.has(key)) {
            return { backgroundColor: '#1e3a5f', color: '#93c5fd', fontWeight: '600' }
          }

          // Non-editable column styling (more prominent)
          if (isReadonly) {
            return { 
              backgroundColor: '#334155', 
              color: '#64748b', 
              cursor: 'not-allowed',
              opacity: 0.7
            }
          }

          return undefined
        },
        // Add tooltip for validation errors
        tooltipValueGetter: (params: any) => {
          const rowId = params.data?._row_id
          const key = `${rowId}|${c}`
          if (validationErrors.has(key)) {
            return validationErrors.get(key)!.message
          }
          if (isReadonly) {
            return 'This column is read-only'
          }
          return undefined
        },
        cellClass: (params: any) => {
          const base = 'text-sm text-slate-300 font-mono border-r border-slate-800'
          if (isReadonly) {
            return `${base} cursor-not-allowed select-none`
          }
          return base
        },
        headerClass: `bg-[#0f172a] border-r border-slate-800 text-xs font-bold ${isReadonly ? 'text-slate-500' : 'text-slate-400'}`,
      }
    })

    return dataCols
  }, [columns, visibleColumns, editableColumns, editedCellMap, deletedRowIds, validationErrors])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), [])

  // Force AG Grid to refresh cells when edited cells or deleted rows change
  // This ensures cell styling is updated after state changes
  useEffect(() => {
    if (api) {
      api.refreshCells({ force: true })
    }
  }, [api, editedCellMap, deletedRowIds, validationErrors])

  const onGridReady = useCallback((params: { api: GridApi }) => {
    setApi(params.api)
    params.api.setGridOption('rowData', rows)
    setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)
  }, [rows])

  // Handle cell value change
  const onCellValueChanged = useCallback(async (e: CellValueChangedEvent) => {
    const rowId = e.data?._row_id
    const column = e.colDef.field!
    const rowIndex = e.node.rowIndex!

    // Get original value
    const originalRow = originalRowsRef.current.find(r => r._row_id === rowId)
    const originalValue = originalRow?.[column]

    // If new value equals original, remove from edits
    if (e.newValue === originalValue) {
      setEditedCells(prev => prev.filter(edit => !(edit.rowId === rowId && edit.column === column)))
      // Also clear any validation errors for this cell
      setValidationErrors(prev => {
        const newMap = new Map(prev)
        newMap.delete(`${rowId}|${column}`)
        return newMap
      })
    } else {
      // Add or update the edit
      setEditedCells(prev => {
        const filtered = prev.filter(edit => !(edit.rowId === rowId && edit.column === column))
        return [
          ...filtered,
          {
            rowIndex,
            rowId,
            column,
            oldValue: originalValue,
            newValue: e.newValue
          }
        ]
      })

      // Validate the cell if we have business rules
      if (businessRules.length > 0) {
        try {
          const result = await validateCellRule(column, e.newValue, businessRules, rowId, e.data)
          if (!result.valid && result.errors?.length > 0) {
            // Store validation error
            const firstError = result.errors[0]
            setValidationErrors(prev => {
              const newMap = new Map(prev)
              newMap.set(`${rowId}|${column}`, {
                column,
                rowId: String(rowId),
                severity: firstError.severity || 'error',
                message: firstError.message,
                ruleType: firstError.rule_type || 'unknown'
              })
              return newMap
            })
          } else {
            // Clear validation error for this cell
            setValidationErrors(prev => {
              const newMap = new Map(prev)
              newMap.delete(`${rowId}|${column}`)
              return newMap
            })
          }
        } catch (err) {
          console.error('Cell validation failed:', err)
        }
      }
    }
  }, [businessRules])

  // Handle row selection
  const onSelectionChanged = useCallback(() => {
    if (!api) return
    const selected = api.getSelectedRows()
    setSelectedRows(selected)
  }, [api])

  // Delete selected rows
  const handleDeleteRows = useCallback(() => {
    if (selectedRows.length === 0) return

    const newDeleted: DeletedRow[] = selectedRows.map(row => ({
      rowIndex: rows.findIndex(r => r._row_id === row._row_id),
      rowId: row._row_id,
      rowData: row
    }))

    setDeletedRows(prev => {
      // Don't add duplicates
      const existingIds = new Set(prev.map(d => d.rowId))
      const toAdd = newDeleted.filter(d => !existingIds.has(d.rowId))
      return [...prev, ...toAdd]
    })

    // Clear selection
    api?.deselectAll()
    setSelectedRows([])

    // Refresh grid to show deleted styling
    api?.refreshCells({ force: true })
  }, [selectedRows, rows, api])

  // Restore deleted rows
  const handleRestoreRows = useCallback((rowIds: string[]) => {
    setDeletedRows(prev => prev.filter(d => !rowIds.includes(d.rowId)))
    api?.refreshCells({ force: true })
  }, [api])

  // Undo all changes
  const handleUndo = useCallback(() => {
    // Clear all edit state
    setEditedCells([])
    setDeletedRows([])
    setValidationErrors(new Map())
    
    // Restore original rows
    const originalData = JSON.parse(JSON.stringify(originalRowsRef.current))
    setRows(originalData)
    
    // Force AG Grid to refresh with the new data
    if (api) {
      api.setGridOption('rowData', originalData)
      // Redraw all rows to clear cell styles (force: true ensures styles are recalculated)
      api.redrawRows()
    }
    
    setToast('All changes reverted')
  }, [api])

  // Count validation issues by severity
  const validationCounts = useMemo(() => {
    const counts = { fatal: 0, error: 0, warning: 0, info: 0 }
    validationErrors.forEach((err) => {
      const severity = err.severity || 'error'
      if (counts.hasOwnProperty(severity)) {
        counts[severity as keyof typeof counts]++
      }
    })
    return counts
  }, [validationErrors])

  // Check if submission is allowed - only block for error and fatal severity
  const hasBlockingErrors = validationCounts.fatal > 0 || validationCounts.error > 0
  const hasWarningsOrInfo = validationCounts.warning > 0 || validationCounts.info > 0
  const canSubmit = hasChanges && !hasBlockingErrors

  // Approver options (exclude current user)
  const approverOptions = useMemo(() => {
    if (!meUser) return members
    return members.filter(m => m.id !== meUser.id)
  }, [members, meUser])

  // Submit change request
  const handleSubmit = async () => {
    if (!canSubmit) {
      if (hasBlockingErrors) {
        setError('Please fix validation errors before submitting')
      }
      return
    }
    if (selectedReviewerIds.length === 0) {
      setError('Please select at least one approver')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Prepare edits payload
      const editsPayload = {
        edited_cells: editedCells.map(e => ({
          row_id: e.rowId,
          column: e.column,
          old_value: e.oldValue,
          new_value: e.newValue
        })),
        deleted_rows: deletedRows.map(d => ({
          row_id: d.rowId,
          row_data: d.rowData
        }))
      }

      // Create change request via project-scoped endpoint
      const response = await fetch(`${API_BASE}/projects/${projectId}/datasets/${dsId}/live-edit/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          session_id: sessionId || '',
          title,
          comment,
          reviewer_ids: selectedReviewerIds,
          edited_cells: editsPayload.edited_cells,
          deleted_rows: editsPayload.deleted_rows.map((d: any) => String(d.row_id))
        })
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(err || 'Failed to submit change request')
      }

      setSubmitDialog(false)
      setToast('Change request submitted successfully')

      // Reset state
      setEditedCells([])
      setDeletedRows([])
      setTitle('Live edit changes')
      setComment('')
      setSelectedReviewerIds([])

      // Navigate to approvals page
      setTimeout(() => {
        navigate(`/projects/${projectId}/datasets/${dsId}/approvals`)
      }, 1500)
    } catch (e: any) {
      setError(e.message || 'Failed to submit change request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-divider bg-surface-1/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/projects/${projectId}/datasets/${dsId}`} className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-divider" />
            <div>
              <h1 className="text-xl font-bold text-text font-display flex items-center gap-2">
                Live Edit: {dataset?.name}
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                  Beta
                </span>
                {/* Hint icon with tooltip */}
                <div className="relative inline-flex">
                  <button
                    type="button"
                    onMouseEnter={() => setShowInfoTooltip(true)}
                    onMouseLeave={() => setShowInfoTooltip(false)}
                    onClick={() => setShowInfoDialog(true)}
                    className="p-1 rounded-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                    title="How to use Live Edit"
                  >
                    <Lightbulb className="w-4 h-4" />
                  </button>
                  {showInfoTooltip && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 p-3 bg-surface-2 border border-divider rounded-lg shadow-xl text-sm text-text-secondary">
                      <p className="font-medium text-text mb-1">Live Edit Mode</p>
                      <p className="text-xs">
                        Edit cells by double-clicking. Select rows to mark for deletion.
                        Changes are staged until you submit a change request for approval.
                      </p>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-2 border-l border-t border-divider rotate-45"></div>
                    </div>
                  )}
                </div>
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                {totalRows.toLocaleString()} rows
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {hasChanges && (
              <>
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Undo All
                </button>
                
                {/* Show validation status badges */}
                {(validationCounts.fatal > 0 || validationCounts.error > 0) && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 bg-red-950/50 border border-red-800 rounded-lg">
                    <XCircle className="w-4 h-4" />
                    <span>{validationCounts.fatal + validationCounts.error} error{(validationCounts.fatal + validationCounts.error) > 1 ? 's' : ''}</span>
                  </div>
                )}
                {validationCounts.warning > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-yellow-400 bg-yellow-950/50 border border-yellow-800 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>{validationCounts.warning} warning{validationCounts.warning > 1 ? 's' : ''}</span>
                  </div>
                )}
                {validationCounts.info > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 bg-blue-950/50 border border-blue-800 rounded-lg">
                    <Info className="w-4 h-4" />
                    <span>{validationCounts.info} info</span>
                  </div>
                )}
                
                {hasBlockingErrors ? (
                  <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-950/50 border border-red-800 rounded-lg cursor-not-allowed">
                    <AlertCircle className="w-4 h-4" />
                    <span>Fix errors to proceed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setSubmitDialog(true)}
                    disabled={role === 'viewer'}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Proceed ({editedCells.length + deletedRows.length} changes)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="px-4 pt-3 space-y-2">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss />}
      </div>

      {/* Welcome Popup Modal - shows on first visit */}
      {showInfoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={dismissInfoDialog}
          />
          {/* Modal */}
          <div className="relative w-full max-w-lg bg-surface border border-divider rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-divider bg-gradient-to-r from-purple-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20">
                  <Lightbulb className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-text">Welcome to Live Edit</h2>
              </div>
              <button
                onClick={dismissInfoDialog}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-text-secondary text-sm">
                Live Edit mode allows you to make changes to the dataset directly. Here's how it works:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pencil className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="text-text-secondary">
                    <span className="text-text font-medium">Edit cells</span> by double-clicking on them. Modified cells will be highlighted.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </div>
                  <span className="text-text-secondary">
                    <span className="text-text font-medium">Delete rows</span> by selecting them (checkbox) and clicking "Delete Selected".
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Send className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-text-secondary">
                    <span className="text-text font-medium">Submit changes</span> for approval via a Change Request when you're ready.
                  </span>
                </li>
              </ul>
              {(editableColumns.size < columns.length || businessRules.length > 0) && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm">
                  {editableColumns.size < columns.length && (
                    <p className="flex items-center gap-2 text-purple-300">
                      <Lock className="w-4 h-4 flex-shrink-0" />
                      Some columns are read-only based on business rules.
                    </p>
                  )}
                  {businessRules.length > 0 && (
                    <p className="flex items-center gap-2 text-purple-300 mt-1">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      Business rules will validate your changes in real-time.
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-divider bg-surface-2 flex justify-end">
              <button
                onClick={dismissInfoDialog}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Got it, let's start!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar - Actions on left, Tools on right */}
      <div className="px-4 py-2 flex items-center justify-between bg-surface-1 border-b border-divider">
        <div className="flex items-center gap-3">
          {/* Delete/Restore selection actions */}
          {selectedRows.length > 0 && (
            <button
              onClick={handleDeleteRows}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 border border-red-500/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedRows.length})
            </button>
          )}

          {deletedRows.length > 0 && (
            <button
              onClick={() => handleRestoreRows(deletedRows.map(d => d.rowId))}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/30 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restore All ({deletedRows.length})
            </button>
          )}

          {/* Stats */}
          {editedCells.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-sm">
              <Pencil className="w-3.5 h-3.5" />
              {editedCells.length} cell{editedCells.length !== 1 ? 's' : ''} edited
            </span>
          )}
          {deletedRows.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/30 text-red-300 rounded text-sm">
              <Trash2 className="w-3.5 h-3.5" />
              {deletedRows.length} row{deletedRows.length !== 1 ? 's' : ''} deleted
            </span>
          )}
          {validationErrors.size > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/50 text-red-300 rounded border border-red-500/30 text-sm">
              <AlertCircle className="w-3.5 h-3.5" />
              {validationErrors.size} validation error{validationErrors.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tools - Search, Column toggle on right */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-divider rounded-lg">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchValue}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search displayed data"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-w-[200px]"
                autoFocus
              />
              {searchValue && (
                <>
                  <span className="text-xs text-text-muted px-2 border-l border-divider">
                    {searchMatches > 0 ? `${currentMatch} of ${searchMatches}` : 'No matches'}
                  </span>
                  <div className="flex items-center gap-0.5 border-l border-divider pl-2">
                    <button 
                      onClick={() => setCurrentMatch(m => Math.max(1, m - 1))} 
                      className="p-1 hover:bg-surface-3 rounded transition-colors" 
                      disabled={searchMatches === 0}
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                    <button 
                      onClick={() => setCurrentMatch(m => Math.min(searchMatches, m + 1))} 
                      className="p-1 hover:bg-surface-3 rounded transition-colors" 
                      disabled={searchMatches === 0}
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-text-muted" />
                    </button>
                  </div>
                </>
              )}
              <button 
                onClick={() => { setShowSearch(false); setSearchValue(''); setSearchMatches(0) }} 
                className="p-1 hover:bg-surface-3 rounded transition-colors ml-1"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary"
              title="Search displayed data"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Column toggle */}
          <div className="relative" ref={columnToggleRef}>
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary"
              title="Explore columns"
            >
              <Columns3 className="w-4 h-4" />
            </button>
            {showColumnToggle && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-surface-2 border border-divider rounded-xl shadow-elevated overflow-hidden">
                <div className="px-3 py-2.5 border-b border-divider bg-surface-3/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text-primary">Explore Columns</span>
                    <span className="text-[10px] text-text-muted">{visibleColumns.size} of {columns.length} visible</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-divider">
                  <button
                    onClick={selectAllColumns}
                    disabled={visibleColumns.size === columns.length}
                    className="flex-1 px-2 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Select All
                  </button>
                  <div className="w-px h-4 bg-divider" />
                  <button
                    onClick={deselectAllColumns}
                    disabled={visibleColumns.size <= 1}
                    className="flex-1 px-2 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {columns.map(col => (
                    <div 
                      key={col}
                      className={`flex items-center gap-2.5 px-3 py-2 hover:bg-surface-3 cursor-pointer transition-colors ${
                        visibleColumns.has(col) ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggleColumn(col)}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col)}
                        onChange={() => toggleColumn(col)}
                        className="w-4 h-4 rounded border-divider bg-surface-3 text-primary focus:ring-primary/30"
                      />
                      <DataTypeIcon type={columnTypes.get(col) || 'text'} className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                      <span className="text-sm text-text-primary truncate flex-1">{col}</span>
                      {visibleColumns.has(col) && (
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="w-full">
        <div
          className="ag-theme-quartz-dark overflow-hidden border-y border-divider"
          style={{ height: 'calc(100vh - 220px)', width: '100%' }}
        >
          <AgGridReact
            ref={gridRef}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            rowData={rows}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            onSelectionChanged={onSelectionChanged}
            animateRows={true}
            enableCellTextSelection={true}
            tooltipShowDelay={200}
            getRowId={(params) => params.data._row_id}
            rowClassRules={{
              'deleted-row': (params) => deletedRowIds.has(params.data?._row_id)
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-divider bg-surface-1">
          {/* Download Button - Left */}
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-divider rounded-xl text-sm text-text-secondary hover:text-text-primary transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>

          {/* Stats - Right */}
          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span>{rows.length.toLocaleString()} total rows</span>
            {editedCells.length > 0 && (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Pencil className="w-3.5 h-3.5" />
                {editedCells.length} edited
              </span>
            )}
            {deletedRows.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
                {deletedRows.length} deleted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      {submitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-3xl shadow-2xl border border-divider w-full max-w-lg mx-4">
            <div className="p-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Submit Change Request</h2>
                <button
                  onClick={() => setSubmitDialog(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary */}
              <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Changes Summary</h3>
                {editedCells.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Pencil className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300">{editedCells.length} cell{editedCells.length !== 1 ? 's' : ''} edited</span>
                  </div>
                )}
                {deletedRows.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span className="text-slate-300">{deletedRows.length} row{deletedRows.length !== 1 ? 's' : ''} to be deleted</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none"
                  placeholder="Describe your changes..."
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Comment (optional)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none resize-none"
                  placeholder="Add any additional context..."
                />
              </div>

              {/* Approvers */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                  <Users className="w-4 h-4 inline mr-1" />
                  Select Approvers *
                </label>
                {!meUser && <div className="text-sm text-slate-500">Loading approvers…</div>}
                {meUser && approverOptions.length === 0 && (
                  <div className="text-sm text-slate-500">No other project members available</div>
                )}
                {meUser && approverOptions.map(a => (
                  <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedReviewerIds.includes(a.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReviewerIds(prev => [...prev, a.id])
                        } else {
                          setSelectedReviewerIds(prev => prev.filter(id => id !== a.id))
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                    />
                    <span className="text-sm text-slate-300">{a.email}</span>
                    <span className="text-xs text-slate-500">({a.role})</span>
                  </label>
                ))}
                {selectedReviewerIds.length === 0 && meUser && (
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Please select at least one approver
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              {hasBlockingErrors && (
                <div className="flex-1 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Fix {validationCounts.fatal + validationCounts.error} error{(validationCounts.fatal + validationCounts.error) !== 1 ? 's' : ''} before submitting</span>
                </div>
              )}
              {!hasBlockingErrors && hasWarningsOrInfo && (
                <div className="flex-1 flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{validationCounts.warning + validationCounts.info} warning{(validationCounts.warning + validationCounts.info) !== 1 ? 's' : ''} (will be included in submission)</span>
                </div>
              )}
              <button
                onClick={() => setSubmitDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedReviewerIds.length === 0 || hasBlockingErrors}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit for Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom styles for deleted rows */}
      <style>{`
        .deleted-row {
          opacity: 0.6;
        }
        .deleted-row .ag-cell {
          text-decoration: line-through;
          color: #fca5a5 !important;
          background-color: #450a0a !important;
        }
      `}</style>
    </div>
  )
}
