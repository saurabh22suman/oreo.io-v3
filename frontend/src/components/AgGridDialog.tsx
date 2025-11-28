import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from './ui/dialog'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent, ICellRendererParams } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { ChevronLeft, ChevronRight, Download, FileText, FileSpreadsheet, RotateCcw, Save, ArrowRight, AlertCircle, Edit3 } from 'lucide-react'

type EditedCell = {
  rowIndex: number
  column: string
  oldValue: any
  newValue: any
}

type ValidationError = {
  message: string
}

type Props = {
  open: boolean
  title?: string
  rows: any[]
  columns: string[]
  pageSize?: number
  onOpenChange: (v: boolean) => void
  allowEdit?: boolean
  onSave?: (rows: any[], editedCells: EditedCell[]) => void | Promise<void>
  onFetchMore?: () => Promise<any[] | { data: any[] }>
  compact?: boolean
  invalidCells?: Array<{ row: number; column: string }>
  invalidRows?: number[]
  editedCells?: EditedCell[]
  validationErrors?: Map<string, ValidationError>
  onLiveEdit?: () => void
}

// Cell renderer that shows validation errors with tooltip
const ValidationCellRenderer = (params: any) => {
  const { value, validationErrors, editedCellMap, node, colDef } = params
  const rowIndex = node?.rowIndex ?? -1
  const c = colDef?.field
  const key = `${rowIndex}|${c}`
  const validationError = validationErrors?.get(key)
  const editInfo = editedCellMap?.get(key)
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

const EditedCellRenderer = (params: any) => {
  const { value, editedCellMap, node, colDef } = params
  const rowIndex = node?.rowIndex ?? -1
  const c = colDef?.field
  const editInfo = editedCellMap?.get(`${rowIndex}|${c}`)
  const cellRef = useRef<HTMLDivElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = () => {
    if (cellRef.current && editInfo) {
      const rect = cellRef.current.getBoundingClientRect()
      // Position tooltip above the cell
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

export default function AgGridDialog({
  open,
  title = 'Preview',
  rows,
  columns,
  pageSize = 50,
  onOpenChange,
  allowEdit = true,
  onSave,
  onFetchMore,
  compact = false,
  invalidCells = [],
  invalidRows = [],
  editedCells: externalEditedCells = [],
  validationErrors,
  onLiveEdit
}: Props) {
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)
  const [colApi, setColApi] = useState<any>(null)
  const [localRows, setLocalRows] = useState<any[]>(rows || [])
  const originalRowsRef = useRef<any[]>(Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [])
  const [editedCells, setEditedCells] = useState<EditedCell[]>(externalEditedCells || [])

  const invalidCellSet = useMemo(() => {
    const s = new Set<string>()
    for (const cell of invalidCells || []) {
      if (cell && typeof cell.row === 'number' && typeof cell.column === 'string') {
        s.add(`${cell.row}|${cell.column}`)
      }
    }
    return s
  }, [invalidCells])

  const invalidRowSet = useMemo(() => new Set<number>((invalidRows || []).filter((n) => typeof n === 'number')), [invalidRows])

  // Map for quick lookup of edited cells
  const editedCellMap = useMemo(() => {
    const map = new Map<string, EditedCell>()
    for (const edit of editedCells) {
      map.set(`${edit.rowIndex}|${edit.column}`, edit)
    }
    return map
  }, [editedCells])

  useEffect(() => {
    setLocalRows(rows || [])
    originalRowsRef.current = Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : []
    // If external edited cells are provided, use them
    if (externalEditedCells && externalEditedCells.length > 0) {
      setEditedCells(externalEditedCells)
    }
  }, [rows, externalEditedCells])

  const colDefs = useMemo<ColDef[]>(() => {
    return columns.map((c) => ({
      headerName: c,
      field: c,
      colId: c,
      valueGetter: (p: any) => p?.data?.[c],
      valueSetter: (p: any) => { if (!p?.data) return false; p.data[c] = p.newValue; return true },
      editable: !!allowEdit,
      resizable: true,
      suppressSizeToFit: false,
      cellRenderer: validationErrors ? ValidationCellRenderer : EditedCellRenderer,
      cellRendererParams: { editedCellMap, validationErrors },
      cellStyle: (p: any) => {
        const ri = p?.rowIndex
        const key = `${typeof ri === 'number' ? ri : -1}|${c}`

        // Validation error cells (red)
        if (validationErrors?.has(key)) {
          return { backgroundColor: '#7F1D1D', color: '#FCA5A5' }
        }

        // Invalid cells (red) - legacy
        if ((typeof ri === 'number' && invalidRowSet.has(ri)) || invalidCellSet.has(key)) {
          return { backgroundColor: '#7F1D1D', color: '#FCA5A5' }
        }

        // Edited cells (blue/highlight)
        if (editedCellMap.has(key)) {
          return { backgroundColor: '#1e3a5f', color: '#93c5fd', fontWeight: '600' }
        }

        return undefined
      },
      cellClass: 'text-sm text-slate-300 font-mono border-r border-slate-800',
    }))
  }, [columns, allowEdit, invalidCellSet, invalidRowSet, editedCellMap, validationErrors])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    floatingFilter: false,
    resizable: true,
    headerClass: 'bg-[#0f172a] border-r border-slate-800',
  }), [])

  const onGridReady = useCallback((params: { api: GridApi; columnApi: any }) => {
    setApi(params.api); setColApi(params.columnApi)
    params.api.setGridOption('rowData', localRows)
    if (!compact) {
      params.api.setGridOption('paginationPageSize', pageSize)
    }
    setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)
  }, [localRows, pageSize, compact])

  const onCellValueChanged = useCallback((e: CellValueChangedEvent) => {
    if (e.newValue === null || e.newValue === undefined || (typeof e.newValue === 'string' && e.newValue.trim() === '')) {
      e.node.setDataValue(e.colDef.field!, e.oldValue)
      if (api) { api.showLoadingOverlay(); setTimeout(() => api.hideOverlay(), 300) }
      alert('Value required')
      return
    }

    // Track the edit
    const rowIndex = e.node.rowIndex
    const column = e.colDef.field!
    const key = `${rowIndex}|${column}`

    // Get the original value from the snapshot
    const originalValue = originalRowsRef.current[rowIndex!]?.[column]

    // If the new value equals the original, remove from edits
    if (e.newValue === originalValue) {
      setEditedCells(prev => prev.filter(edit => `${edit.rowIndex}|${edit.column}` !== key))
    } else {
      // Add or update the edit
      setEditedCells(prev => {
        const filtered = prev.filter(edit => `${edit.rowIndex}|${edit.column}` !== key)
        return [
          ...filtered,
          {
            rowIndex: rowIndex!,
            column,
            oldValue: originalValue,
            newValue: e.newValue
          }
        ]
      })
    }
  }, [api])

  const exportCsv = useCallback(() => { api?.exportDataAsCsv({ fileName: (title || 'data') + '.csv' }) }, [api, title])
  const exportExcel = useCallback(() => { (api as any)?.exportDataAsExcel?.({ fileName: (title || 'data') + '.xlsx' }) }, [api, title])

  const handleSave = useCallback(async () => {
    if (!onSave || !api) return
    const data: any[] = []
    api.forEachNode((node) => { if (node?.data) data.push(node.data) })
    await onSave(data, editedCells)
  }, [onSave, api, editedCells])

  const handleUndo = useCallback(() => {
    const snapshot = Array.isArray(originalRowsRef.current) ? JSON.parse(JSON.stringify(originalRowsRef.current)) : []
    setLocalRows(snapshot)
    setEditedCells([])
    api?.setGridOption('rowData', snapshot)
  }, [api])

  const handleFetchMore = useCallback(async () => {
    if (!onFetchMore) return
    const res = await onFetchMore()
    const more = Array.isArray(res) ? res : (res?.data || [])
    if (more.length) {
      const next = [...localRows, ...more]
      setLocalRows(next)
      api?.setGridOption('rowData', next)
    }
  }, [onFetchMore, localRows, api])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 bg-[#0f172a] border-slate-700">
        <DialogHeader className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold text-white">{title}</DialogTitle>
              {editedCells.length > 0 && (
                <p className="text-xs text-blue-400 mt-1">
                  {editedCells.length} cell{editedCells.length !== 1 ? 's' : ''} edited
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">Data preview grid with pagination and export controls.</DialogDescription>
          <div className="flex items-center gap-2 mt-3">
            {!compact && (
              <>
                <button
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  onClick={() => api?.paginationGoToPreviousPage()}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  onClick={() => api?.paginationGoToNextPage()}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <select
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                  defaultValue={String(pageSize)}
                  onChange={(e) => api?.setGridOption('paginationPageSize', Number(e.target.value))}
                >
                  {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}/page</option>)}
                </select>

                <div className="w-px h-4 bg-slate-700 mx-1" />

                <button
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                  onClick={() => api?.sizeColumnsToFit({ defaultMinWidth: 100 })}
                >
                  Fit Columns
                </button>
                <button
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  onClick={exportCsv}
                >
                  <FileText className="w-3.5 h-3.5" />
                  CSV
                </button>
                {(api as any)?.exportDataAsExcel && (
                  <button
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    onClick={exportExcel}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Excel
                  </button>
                )}
                {onFetchMore && (
                  <button
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    onClick={handleFetchMore}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Load more
                  </button>
                )}
                {onSave && (
                  <>
                    <button
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      onClick={handleUndo}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Undo
                    </button>
                    <button
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      onClick={handleSave}
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save edits
                    </button>
                  </>
                )}
              </>
            )}
            {compact && onSave && (
              <>
                <button
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  onClick={handleUndo}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Undo
                </button>
                <button
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  onClick={handleSave}
                >
                  <Save className="w-3.5 h-3.5" />
                  Save edits
                </button>
              </>
            )}
            {compact && onLiveEdit && (
              <button
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                onClick={() => {
                  onOpenChange(false)
                  onLiveEdit()
                }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Live Edit
              </button>
            )}
            <div className="ml-auto">
              <DialogClose asChild>
                <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
                  Close
                </button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>
        <div 
          className="ag-theme-quartz-dark rounded-lg overflow-hidden border border-slate-800" 
          style={{ height: 'calc(85vh - 120px)' }}
        >
          <AgGridReact
            ref={gridRef as any}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            rowData={localRows}
            rowSelection={compact ? undefined : ({ mode: 'multiRow' } as any)}
            animateRows
            pagination={!compact}
            onGridReady={onGridReady as any}
            onCellValueChanged={onCellValueChanged}
            enableCellTextSelection
            rowHeight={32}
            headerHeight={36}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
