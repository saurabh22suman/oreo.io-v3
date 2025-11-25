import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

type EditedCell = {
    rowIndex: number
    column: string
    oldValue: any
    newValue: any
}

type Props = {
    title?: string
    rows: any[]
    columns: string[]
    pageSize?: number
    allowEdit?: boolean
    onSave?: (rows: any[], editedCells: EditedCell[]) => void | Promise<void>
    onFetchMore?: () => Promise<any[] | { data: any[] }>
    compact?: boolean
    invalidCells?: Array<{ row: number; column: string }>
    invalidRows?: number[]
    editedCells?: EditedCell[]
    className?: string
    style?: React.CSSProperties
}

const EditedCellRenderer = (params: any) => {
    const { value, editedCellMap, node, colDef } = params
    const rowIndex = node?.rowIndex ?? -1
    const c = colDef?.field
    const editInfo = editedCellMap?.get(`${rowIndex}|${c}`)

    if (!editInfo) {
        return <span>{value}</span>
    }

    return (
        <div className="group relative w-full h-full flex items-center">
            <span>{value}</span>
            <div className="invisible group-hover:visible absolute z-50 bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs whitespace-nowrap pointer-events-none">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 line-through">{String(editInfo.oldValue)}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-green-400 font-semibold">{String(editInfo.newValue)}</span>
                </div>
                <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-slate-700"></div>
            </div>
        </div>
    )
}

export default function AgGridTable({
    title = 'Preview',
    rows,
    columns,
    pageSize = 50,
    allowEdit = true,
    onSave,
    onFetchMore,
    compact = false,
    invalidCells = [],
    invalidRows = [],
    editedCells: externalEditedCells = [],
    className = '',
    style
}: Props) {
    const gridRef = useRef<AgGridReact>(null)
    const [api, setApi] = useState<GridApi | null>(null)
    const [colApi, setColApi] = useState<any>(null)
    const [localRows, setLocalRows] = useState<any[]>(rows || [])
    const originalRowsRef = useRef<any[]>(Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [])
    const [editedCells, setEditedCells] = useState<EditedCell[]>(externalEditedCells || [])

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [gridPageSize, setGridPageSize] = useState(pageSize)

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
            cellRenderer: EditedCellRenderer,
            cellRendererParams: { editedCellMap },
            cellStyle: (p: any) => {
                const ri = p?.rowIndex
                const key = `${typeof ri === 'number' ? ri : -1}|${c}`

                // Invalid cells (red)
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
    }, [columns, allowEdit, invalidCellSet, invalidRowSet, editedCellMap])

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        floatingFilter: false,
        resizable: true,
        headerClass: 'bg-[#0f172a] border-r border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider',
    }), [])

    const onGridReady = useCallback((params: { api: GridApi; columnApi: any }) => {
        setApi(params.api); setColApi(params.columnApi)
        params.api.setGridOption('rowData', localRows)
        if (!compact) {
            params.api.setGridOption('paginationPageSize', gridPageSize)
        }
        setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)

        // Initial pagination state
        setCurrentPage(params.api.paginationGetCurrentPage() + 1)
        setTotalPages(params.api.paginationGetTotalPages())
    }, [localRows, gridPageSize, compact])

    const onPaginationChanged = useCallback(() => {
        if (api) {
            setCurrentPage(api.paginationGetCurrentPage() + 1)
            setTotalPages(api.paginationGetTotalPages())
        }
    }, [api])

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

    return (
        <div className={`flex flex-col bg-[#0f172a] border border-slate-700 rounded-lg overflow-hidden ${className}`} style={style}>
            <div className="ag-theme-databricks-dark flex-1">
                <AgGridReact
                    ref={gridRef as any}
                    columnDefs={colDefs}
                    defaultColDef={defaultColDef}
                    rowData={localRows}
                    // Removed rowSelection to remove checkboxes
                    animateRows
                    pagination={!compact}
                    suppressPaginationPanel={true} // Hide default pagination panel
                    onGridReady={onGridReady as any}
                    onPaginationChanged={onPaginationChanged}
                    onCellValueChanged={onCellValueChanged}
                    enableCellTextSelection
                    rowHeight={32}
                    headerHeight={36}
                />
            </div>

            {/* Custom Footer */}
            {!compact && (
                <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCsv}
                            className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-slate-300"
                            title="Export CSV"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Removed Page Size Selector */}

                        <div className="flex items-center gap-3">
                            <span>
                                {(currentPage - 1) * gridPageSize + 1} - {Math.min(currentPage * gridPageSize, localRows.length)} of {localRows.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    className="p-1 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    onClick={() => api?.paginationGoToPreviousPage()}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    className="p-1 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    onClick={() => api?.paginationGoToNextPage()}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
