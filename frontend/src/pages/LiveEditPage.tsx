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
  AlertCircle, Users, Loader2, ArrowRight, Eye, FileText,
  CheckCircle, XCircle, Info
} from 'lucide-react'

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
  severity: 'error' | 'warning' | 'info'
  message: string
  ruleType: string
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
      
      // If no editable columns set yet, default to all visible columns being editable
      if (editableColumns.size === 0 && visibleColumns.length > 0) {
        setEditableColumns(new Set(visibleColumns))
      }
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
    // Row selection column
    const selectionCol: ColDef = {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 50,
      pinned: 'left',
      lockPosition: true,
      headerClass: 'bg-[#0f172a]',
    }

    const dataCols: ColDef[] = columns.map((c) => ({
      headerName: c,
      field: c,
      colId: c,
      editable: (params: any) => {
        // Don't allow editing deleted rows or non-editable columns
        const rowId = params.data?._row_id
        return editableColumns.has(c) && !deletedRowIds.has(rowId)
      },
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

        // Validation error styling (red border/background)
        if (validationErrors.has(key)) {
          const error = validationErrors.get(key)!
          if (error.severity === 'error') {
            return { backgroundColor: '#7f1d1d', color: '#fca5a5', borderLeft: '3px solid #ef4444' }
          } else if (error.severity === 'warning') {
            return { backgroundColor: '#78350f', color: '#fcd34d', borderLeft: '3px solid #f59e0b' }
          }
        }

        // Edited cell styling
        if (editedCellMap.has(key)) {
          return { backgroundColor: '#1e3a5f', color: '#93c5fd', fontWeight: '600' }
        }

        // Non-editable column styling
        if (!editableColumns.has(c)) {
          return { backgroundColor: '#1e293b', color: '#94a3b8' }
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
        return undefined
      },
      cellClass: 'text-sm text-slate-300 font-mono border-r border-slate-800',
      headerClass: 'bg-[#0f172a] border-r border-slate-800 text-xs font-bold text-slate-400',
    }))

    return [selectionCol, ...dataCols]
  }, [columns, editableColumns, editedCellMap, deletedRowIds, validationErrors])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), [])

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
    setEditedCells([])
    setDeletedRows([])
    setValidationErrors(new Map()) // Clear validation errors
    setRows(JSON.parse(JSON.stringify(originalRowsRef.current)))
    api?.setGridOption('rowData', originalRowsRef.current)
    api?.refreshCells({ force: true })
    setToast('All changes reverted')
  }, [api])

  // Check if submission is allowed (has changes but no validation errors)
  const hasValidationErrors = validationErrors.size > 0
  const canSubmit = hasChanges && !hasValidationErrors

  // Approver options (exclude current user)
  const approverOptions = useMemo(() => {
    if (!meUser) return members
    return members.filter(m => m.id !== meUser.id)
  }, [members, meUser])

  // Submit change request
  const handleSubmit = async () => {
    if (!canSubmit) {
      if (hasValidationErrors) {
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
      <div className="bg-[#0f172a] border-b border-slate-800">
        <div className="max-w-full px-6 py-4">
          <Link
            to={`/projects/${projectId}/labs?dataset=${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Experimental Features
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Pencil className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Live Editor</h1>
                <p className="text-slate-400 text-sm">Edit {dataset?.name} data directly</p>
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
                  {hasValidationErrors ? (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 bg-red-950/50 border border-red-800 rounded-lg cursor-not-allowed">
                      <AlertCircle className="w-4 h-4" />
                      <span>{validationErrors.size} validation error{validationErrors.size > 1 ? 's' : ''}</span>
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
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4 space-y-2">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss />}
      </div>

      {/* Info banner */}
      <div className="px-6 pt-4">
        <div className="flex items-start gap-3 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-200">
            <p className="font-medium mb-1">Live Edit Mode</p>
            <p className="text-purple-300/80">
              Edit cells by double-clicking. Select rows and click "Delete Selected" to mark for deletion.
              Changes are staged until you submit a change request for approval.
              {editableColumns.size < columns.length && (
                <span className="block mt-1 text-purple-400">
                  Note: Some columns are read-only based on business rules.
                </span>
              )}
              {businessRules.length > 0 && (
                <span className="block mt-1 text-purple-400">
                  Business rules are enforced. Invalid values will be highlighted in red.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
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
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-slate-400">
          {editedCells.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 text-blue-300 rounded">
              <Pencil className="w-3.5 h-3.5" />
              {editedCells.length} cell{editedCells.length !== 1 ? 's' : ''} edited
            </span>
          )}
          {deletedRows.length > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/30 text-red-300 rounded">
              <Trash2 className="w-3.5 h-3.5" />
              {deletedRows.length} row{deletedRows.length !== 1 ? 's' : ''} deleted
            </span>
          )}
          {validationErrors.size > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-900/50 text-red-300 rounded border border-red-500/30">
              <AlertCircle className="w-3.5 h-3.5" />
              {validationErrors.size} validation error{validationErrors.size !== 1 ? 's' : ''}
            </span>
          )}
          <span>{totalRows.toLocaleString()} total rows</span>
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 pb-6">
        <div
          className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800"
          style={{ height: 'calc(100vh - 320px)', width: '100%' }}
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
      </div>

      {/* Submit Dialog */}
      {submitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-700">
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
              {hasValidationErrors && (
                <div className="flex-1 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Fix {validationErrors.size} validation error{validationErrors.size !== 1 ? 's' : ''} before submitting</span>
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
                disabled={submitting || selectedReviewerIds.length === 0 || hasValidationErrors}
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
