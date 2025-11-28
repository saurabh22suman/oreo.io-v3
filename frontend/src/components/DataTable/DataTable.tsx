import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent, ColumnState } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import {
  ChevronLeft, ChevronRight, Download, ArrowRight, Search, X, Filter,
  Columns3, RefreshCw, Copy, Pin, ArrowUp, ArrowDown, ArrowUpDown,
  MoreVertical, Type, Hash, Calendar, ToggleLeft, Clock, Check,
  FileSpreadsheet, ChevronDown
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type DataType = 'text' | 'number' | 'date' | 'boolean' | 'timestamp'

export type EditedCell = {
  rowIndex: number
  column: string
  oldValue: any
  newValue: any
}

export type ColumnDef = {
  field: string
  headerName?: string
  type?: DataType
  editable?: boolean
  pinned?: 'left' | 'right' | null
  width?: number
  hide?: boolean
}

export type FilterConfig = {
  field: string
  name: string
  condition: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan'
  value: string
}

export type DataTableProps = {
  // Data
  rows: any[]
  columns: string[] | ColumnDef[]
  
  // Display
  title?: string
  showToolbar?: boolean
  showFooter?: boolean
  showRowNumbers?: boolean
  compact?: boolean
  height?: string | number
  className?: string
  style?: React.CSSProperties
  
  // Features
  allowEdit?: boolean
  allowSearch?: boolean
  allowFilter?: boolean
  allowColumnToggle?: boolean
  allowExport?: boolean
  allowRefresh?: boolean
  
  // Pagination
  pageSize?: number
  totalRows?: number
  currentPage?: number
  onPageChange?: (page: number, pageSize: number) => void
  
  // Events
  onSave?: (rows: any[], editedCells: EditedCell[]) => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  onCellValueChanged?: (cell: EditedCell) => void
  
  // Validation & Styling
  invalidCells?: Array<{ row: number; column: string; message?: string }>
  invalidRows?: number[]
  editedCells?: EditedCell[]
  deletedRowIds?: Set<number>
  
  // Schema
  columnTypes?: Record<string, DataType>
  columnMappings?: Record<string, string>
  
  // Runtime info
  runtime?: number
  lastRefreshed?: Date
}

// ============================================================================
// Data Type Icons
// ============================================================================

const DataTypeIcon = ({ type, className = '' }: { type: DataType; className?: string }) => {
  const icons: Record<DataType, any> = {
    text: Type,
    number: Hash,
    date: Calendar,
    boolean: ToggleLeft,
    timestamp: Clock
  }
  const Icon = icons[type] || Type
  return <Icon className={className} />
}

// ============================================================================
// Custom Header Component
// ============================================================================

const CustomHeader = (props: any) => {
  const { displayName, column, api, columnType, onFilterClick, onSortChanged } = props
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [currentSort, setCurrentSort] = useState<string | null | undefined>(column.getSort())

  useEffect(() => {
    setCurrentSort(column.getSort())
  }, [column])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ x: rect.right - 180, y: rect.bottom + 4 })
    }
    setShowMenu(!showMenu)
  }

  const handleSort = () => {
    const colId = column.getColId()
    let newSort: 'asc' | 'desc' | null = null
    if (!currentSort) newSort = 'asc'
    else if (currentSort === 'asc') newSort = 'desc'
    else newSort = null
    
    api.applyColumnState({
      state: [{ colId, sort: newSort }],
      defaultState: { sort: null }
    })
    setCurrentSort(newSort)
    onSortChanged?.()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(displayName)
    setShowMenu(false)
  }

  const handleFilter = () => {
    onFilterClick?.({ field: column.getColId(), name: displayName, type: columnType })
    setShowMenu(false)
  }

  const handlePin = () => {
    const colId = column.getColId()
    const isPinned = column.isPinned()
    api.applyColumnState({
      state: [{ colId, pinned: isPinned ? null : 'left' }],
      defaultState: { pinned: null }
    })
    setShowMenu(false)
  }

  const SortIcon = currentSort === 'asc' ? ArrowUp : currentSort === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <div className="flex items-center justify-between w-full h-full group px-1">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <DataTypeIcon type={columnType || 'text'} className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        <span className="text-xs font-medium text-text-secondary truncate">{displayName}</span>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={handleSort}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-4 transition-all"
          title="Sort"
        >
          <SortIcon className={`w-3.5 h-3.5 ${currentSort ? 'text-primary' : 'text-text-muted'}`} />
        </button>
        
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          className={`p-0.5 rounded hover:bg-surface-4 transition-all ${showMenu ? 'opacity-100 bg-surface-4' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <MoreVertical className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>

      {showMenu && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
          className="w-44 bg-surface-2 border border-divider rounded-lg shadow-elevated z-[9999] py-1 animate-fade-in"
        >
          <button onClick={handleCopy} className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary flex items-center gap-2 transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy column name
          </button>
          <button onClick={handleFilter} className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary flex items-center gap-2 transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <div className="h-px bg-divider my-1" />
          <button onClick={handlePin} className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-3 hover:text-text-primary flex items-center gap-2 transition-colors">
            <Pin className="w-3.5 h-3.5" /> {column.isPinned() ? 'Unpin column' : 'Pin column'}
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// Edited Cell Renderer
// ============================================================================

const EditedCellRenderer = (params: any) => {
  const { value, editedCellMap, deletedRowIds, node, colDef } = params
  const rowIndex = node?.rowIndex ?? -1
  const rowId = node?.data?._row_id ?? rowIndex
  const c = colDef?.field
  const editInfo = editedCellMap?.get(`${rowId}|${c}`) || editedCellMap?.get(`${rowIndex}|${c}`)
  const isDeleted = deletedRowIds?.has(rowId) || deletedRowIds?.has(rowIndex)
  const cellRef = useRef<HTMLDivElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = () => {
    if (cellRef.current && editInfo) {
      const rect = cellRef.current.getBoundingClientRect()
      setTooltipPos({ x: rect.left, y: rect.top - 8 })
      setShowTooltip(true)
    }
  }

  if (isDeleted) {
    return (
      <div className="w-full h-full flex items-center">
        <span className="line-through text-danger opacity-60">{value}</span>
      </div>
    )
  }

  if (!editInfo) {
    return <span className="truncate">{value}</span>
  }

  return (
    <div
      ref={cellRef}
      className="w-full h-full flex items-center cursor-help"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="truncate">{value}</span>
      {showTooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateY(-100%)',
          }}
          className="z-[9999] px-3 py-2 bg-surface-1 border border-divider rounded-lg shadow-elevated text-xs whitespace-nowrap animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="text-danger line-through">{String(editInfo.oldValue ?? '')}</span>
            <ArrowRight className="w-3 h-3 text-text-muted" />
            <span className="text-success font-medium">{String(editInfo.newValue ?? '')}</span>
          </div>
          <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-surface-1 border-r border-b border-divider" />
        </div>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// Search Panel
// ============================================================================

const SearchPanel = ({ 
  value, 
  onChange, 
  matches, 
  currentMatch, 
  onPrev, 
  onNext, 
  onClose 
}: {
  value: string
  onChange: (v: string) => void
  matches: number
  currentMatch: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-divider rounded-lg">
    <Search className="w-4 h-4 text-text-muted" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search displayed data"
      className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-w-[200px]"
      autoFocus
    />
    <div className="flex items-center gap-1 text-xs text-text-muted border-l border-divider pl-2">
      <span className="font-medium">Aa</span>
      <span className="font-bold">ab</span>
    </div>
    {value && (
      <>
        <span className="text-xs text-text-muted px-2 border-l border-divider">
          {matches > 0 ? `${currentMatch} of ${matches}` : 'No matches'}
        </span>
        <div className="flex items-center gap-0.5 border-l border-divider pl-2">
          <button onClick={onPrev} className="p-1 hover:bg-surface-3 rounded transition-colors" disabled={matches === 0}>
            <ArrowUp className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <button onClick={onNext} className="p-1 hover:bg-surface-3 rounded transition-colors" disabled={matches === 0}>
            <ArrowDown className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      </>
    )}
    <button onClick={onClose} className="p-1 hover:bg-surface-3 rounded transition-colors ml-1">
      <X className="w-4 h-4 text-text-muted" />
    </button>
  </div>
)

// ============================================================================
// Column Toggle Panel
// ============================================================================

const ColumnTogglePanel = ({
  columns,
  visibleColumns,
  onToggle,
  onClose
}: {
  columns: Array<{ field: string; headerName: string; type?: DataType }>
  visibleColumns: Set<string>
  onToggle: (field: string) => void
  onClose: () => void
}) => {
  const [search, setSearch] = useState('')
  const filtered = columns.filter(c => 
    c.headerName.toLowerCase().includes(search.toLowerCase()) ||
    c.field.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="w-64 bg-surface-2 border border-divider rounded-lg shadow-elevated overflow-hidden animate-fade-in">
      <div className="px-3 py-2 border-b border-divider flex items-center gap-2">
        <input
          type="checkbox"
          checked={visibleColumns.size === columns.length}
          onChange={() => {
            if (visibleColumns.size === columns.length) {
              // Hide all (keep at least one visible)
            } else {
              columns.forEach(c => !visibleColumns.has(c.field) && onToggle(c.field))
            }
          }}
          className="w-4 h-4 rounded border-divider bg-surface-3 text-primary"
        />
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for column"
            className="w-full pl-7 pr-2 py-1.5 bg-surface-3 border border-divider rounded text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.map(col => (
          <div 
            key={col.field}
            className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3 cursor-pointer transition-colors"
            onClick={() => onToggle(col.field)}
          >
            <input
              type="checkbox"
              checked={visibleColumns.has(col.field)}
              onChange={() => onToggle(col.field)}
              className="w-4 h-4 rounded border-divider bg-surface-3 text-primary"
            />
            <DataTypeIcon type={col.type || 'text'} className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-sm text-text-primary truncate">{col.headerName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Filter Panel
// ============================================================================

const FilterPanel = ({
  filterConfig,
  onApply,
  onClose
}: {
  filterConfig: { field: string; name: string; type?: DataType }
  onApply: (filter: FilterConfig) => void
  onClose: () => void
}) => {
  const [condition, setCondition] = useState<FilterConfig['condition']>('contains')
  const [value, setValue] = useState('')

  const conditions = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'startsWith', label: 'Starts with' },
    { value: 'endsWith', label: 'Ends with' },
    ...(filterConfig.type === 'number' ? [
      { value: 'greaterThan', label: 'Greater than' },
      { value: 'lessThan', label: 'Less than' }
    ] : [])
  ]

  return (
    <div className="p-4 w-64 bg-surface-2 border border-divider rounded-lg shadow-elevated animate-fade-in">
      <div className="text-xs font-medium text-text-primary mb-3">Filter: {filterConfig.name}</div>
      <select 
        value={condition}
        onChange={e => setCondition(e.target.value as any)}
        className="w-full mb-2 px-3 py-2 bg-surface-3 border border-divider rounded-lg text-sm text-text-primary"
      >
        {conditions.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Enter value..."
        className="w-full mb-3 px-3 py-2 bg-surface-3 border border-divider rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50"
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-3 rounded-lg transition-colors">
          Cancel
        </button>
        <button 
          onClick={() => {
            onApply({ field: filterConfig.field, name: filterConfig.name, condition, value })
            onClose()
          }}
          className="flex-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          disabled={!value.trim()}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Main DataTable Component
// ============================================================================

export default function DataTable({
  rows,
  columns,
  title,
  showToolbar = true,
  showFooter = true,
  showRowNumbers = true,
  compact = false,
  height = '100%',
  className = '',
  style,
  allowEdit = false,
  allowSearch = true,
  allowFilter = true,
  allowColumnToggle = true,
  allowExport = true,
  allowRefresh = false,
  pageSize = 50,
  totalRows,
  currentPage: externalPage,
  onPageChange,
  onSave,
  onRefresh,
  onCellValueChanged: externalCellValueChanged,
  invalidCells = [],
  invalidRows = [],
  editedCells: externalEditedCells = [],
  deletedRowIds: externalDeletedRowIds,
  columnTypes: externalColumnTypes,
  columnMappings = {},
  runtime,
  lastRefreshed
}: DataTableProps) {
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)
  const [localRows, setLocalRows] = useState<any[]>(rows || [])
  const originalRowsRef = useRef<any[]>(Array.isArray(rows) ? JSON.parse(JSON.stringify(rows)) : [])
  const [editedCells, setEditedCells] = useState<EditedCell[]>(externalEditedCells || [])
  const deletedRowIds = externalDeletedRowIds || new Set<number>()

  // UI State
  const [showSearch, setShowSearch] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchMatches, setSearchMatches] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [showColumnToggle, setShowColumnToggle] = useState(false)
  const [filterConfig, setFilterConfig] = useState<{ field: string; name: string; type?: DataType } | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterConfig[]>([])
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const columnToggleRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  // Pagination
  const [internalPage, setInternalPage] = useState(1)
  const [internalTotalPages, setInternalTotalPages] = useState(1)
  const [gridPageSize, setGridPageSize] = useState(pageSize)

  const currentPage = externalPage ?? internalPage

  // Sort key for triggering header updates
  const [sortKey, setSortKey] = useState(0)

  // Parse columns
  const parsedColumns = useMemo(() => {
    if (!columns || columns.length === 0) return []
    
    if (typeof columns[0] === 'string') {
      return (columns as string[]).map(c => ({
        field: c,
        headerName: columnMappings[c] || c,
        type: externalColumnTypes?.[c] || 'text' as DataType,
        editable: allowEdit,
        hide: false
      }))
    }
    return columns as ColumnDef[]
  }, [columns, columnMappings, externalColumnTypes, allowEdit])

  // Auto-detect column types
  const columnTypes = useMemo(() => {
    if (externalColumnTypes) return externalColumnTypes
    
    const types: Record<string, DataType> = {}
    if (rows.length > 0) {
      parsedColumns.forEach(col => {
        const val = rows[0][col.field]
        if (typeof val === 'number') types[col.field] = 'number'
        else if (typeof val === 'boolean') types[col.field] = 'boolean'
        else if (val instanceof Date) types[col.field] = 'date'
        else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') types[col.field] = 'number'
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) types[col.field] = 'timestamp'
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) types[col.field] = 'date'
        else types[col.field] = 'text'
      })
    }
    return types
  }, [rows, parsedColumns, externalColumnTypes])

  // Initialize visible columns
  useEffect(() => {
    if (parsedColumns.length > 0 && visibleColumns.size === 0) {
      setVisibleColumns(new Set(parsedColumns.filter(c => c.hide !== true).map(c => c.field)))
    }
  }, [parsedColumns])

  // Validation sets
  const invalidCellSet = useMemo(() => {
    const s = new Set<string>()
    for (const cell of invalidCells || []) {
      if (cell && typeof cell.row === 'number' && typeof cell.column === 'string') {
        s.add(`${cell.row}|${cell.column}`)
      }
    }
    return s
  }, [invalidCells])

  const invalidRowSet = useMemo(() => new Set<number>((invalidRows || []).filter(n => typeof n === 'number')), [invalidRows])

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
    if (externalEditedCells && externalEditedCells.length > 0) {
      setEditedCells(externalEditedCells)
    }
  }, [rows, externalEditedCells])

  // AG Grid Column Definitions
  const colDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = []

    // Row number column
    if (showRowNumbers) {
      defs.push({
        headerName: '',
        valueGetter: 'node.rowIndex + 1',
        width: 50,
        maxWidth: 50,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'bg-surface-2 text-text-muted text-xs font-mono flex items-center justify-center border-r border-divider',
        headerClass: 'bg-surface-2 border-r border-divider',
      })
    }

    // Data columns
    parsedColumns.forEach(col => {
      if (!visibleColumns.has(col.field)) return
      
      const type = col.type || columnTypes[col.field] || 'text'
      
      defs.push({
        headerName: col.headerName || col.field,
        field: col.field,
        colId: col.field,
        valueGetter: (p: any) => p?.data?.[col.field],
        valueSetter: (p: any) => { if (!p?.data) return false; p.data[col.field] = p.newValue; return true },
        editable: col.editable ?? allowEdit,
        resizable: true,
        sortable: true,
        filter: true,
        pinned: col.pinned,
        width: col.width,
        headerComponent: CustomHeader,
        headerComponentParams: {
          columnType: type,
          onFilterClick: setFilterConfig,
          onSortChanged: () => setSortKey(k => k + 1)
        },
        cellRenderer: EditedCellRenderer,
        cellRendererParams: { editedCellMap, deletedRowIds },
        cellStyle: (p: any) => {
          const ri = p?.rowIndex
          const rowId = p?.data?._row_id ?? ri
          const key = `${typeof ri === 'number' ? ri : -1}|${col.field}`
          const keyById = `${rowId}|${col.field}`

          // Deleted rows
          if (deletedRowIds.has(ri) || deletedRowIds.has(rowId)) {
            return { backgroundColor: 'rgba(255, 83, 112, 0.15)', color: '#FF5370' }
          }

          // Invalid cells
          if ((typeof ri === 'number' && invalidRowSet.has(ri)) || invalidCellSet.has(key)) {
            return { backgroundColor: 'rgba(255, 83, 112, 0.25)', color: '#FF5370', borderLeft: '2px solid #FF5370' }
          }

          // Edited cells
          if (editedCellMap.has(key) || editedCellMap.has(keyById)) {
            return { backgroundColor: 'rgba(123, 75, 255, 0.15)', color: '#A87CFF', borderLeft: '2px solid #7B4BFF' }
          }

          return undefined
        },
        cellClass: 'text-sm text-text-primary font-mono border-r border-divider',
      })
    })

    return defs
  }, [parsedColumns, showRowNumbers, visibleColumns, columnTypes, allowEdit, editedCellMap, deletedRowIds, invalidCellSet, invalidRowSet, sortKey])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    headerClass: 'bg-surface-2 border-r border-divider',
  }), [])

  const onGridReady = useCallback((params: { api: GridApi }) => {
    setApi(params.api)
    params.api.setGridOption('rowData', localRows)
    if (!compact) {
      params.api.setGridOption('paginationPageSize', gridPageSize)
    }
    setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 80 }), 0)
    setInternalPage(params.api.paginationGetCurrentPage() + 1)
    setInternalTotalPages(params.api.paginationGetTotalPages())
  }, [localRows, gridPageSize, compact])

  const onPaginationChanged = useCallback(() => {
    if (api) {
      setInternalPage(api.paginationGetCurrentPage() + 1)
      setInternalTotalPages(api.paginationGetTotalPages())
    }
  }, [api])

  const handleCellValueChanged = useCallback((e: CellValueChangedEvent) => {
    const rowIndex = e.node.rowIndex!
    const column = e.colDef.field!
    const originalValue = originalRowsRef.current[rowIndex]?.[column]
    const key = `${rowIndex}|${column}`

    const cellEdit: EditedCell = {
      rowIndex,
      column,
      oldValue: originalValue,
      newValue: e.newValue
    }

    if (e.newValue === originalValue) {
      setEditedCells(prev => prev.filter(edit => `${edit.rowIndex}|${edit.column}` !== key))
    } else {
      setEditedCells(prev => {
        const filtered = prev.filter(edit => `${edit.rowIndex}|${edit.column}` !== key)
        return [...filtered, cellEdit]
      })
    }

    externalCellValueChanged?.(cellEdit)
  }, [externalCellValueChanged])

  // Search functionality
  const handleSearch = useCallback((value: string) => {
    setSearchValue(value)
    if (!api || !value.trim()) {
      setSearchMatches(0)
      setCurrentMatch(0)
      return
    }

    // Simple search implementation
    let matches = 0
    api.forEachNode(node => {
      const data = node.data
      if (data) {
        const found = Object.values(data).some(v => 
          String(v).toLowerCase().includes(value.toLowerCase())
        )
        if (found) matches++
      }
    })
    setSearchMatches(matches)
    setCurrentMatch(matches > 0 ? 1 : 0)
  }, [api])

  const exportCsv = useCallback(() => {
    api?.exportDataAsCsv({ fileName: (title || 'data') + '.csv' })
  }, [api, title])

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

  const applyFilter = useCallback((filter: FilterConfig) => {
    const newFilters = [...activeFilters.filter(f => f.field !== filter.field), filter]
    setActiveFilters(newFilters)
    
    // Build filter model from all active filters
    if (api) {
      const filterModel: Record<string, any> = {}
      newFilters.forEach(f => {
        filterModel[f.field] = {
          type: f.condition === 'contains' ? 'contains' :
                f.condition === 'equals' ? 'equals' :
                f.condition === 'startsWith' ? 'startsWith' :
                f.condition === 'endsWith' ? 'endsWith' :
                f.condition === 'greaterThan' ? 'greaterThan' :
                'lessThan',
          filter: f.value
        }
      })
      api.setFilterModel(filterModel)
    }
  }, [api, activeFilters])

  const removeFilter = useCallback((field: string) => {
    const newFilters = activeFilters.filter(f => f.field !== field)
    setActiveFilters(newFilters)
    
    if (api) {
      if (newFilters.length === 0) {
        api.setFilterModel(null)
      } else {
        const filterModel: Record<string, any> = {}
        newFilters.forEach(f => {
          filterModel[f.field] = {
            type: f.condition === 'contains' ? 'contains' :
                  f.condition === 'equals' ? 'equals' :
                  f.condition === 'startsWith' ? 'startsWith' :
                  f.condition === 'endsWith' ? 'endsWith' :
                  f.condition === 'greaterThan' ? 'greaterThan' :
                  'lessThan',
            filter: f.value
          }
        })
        api.setFilterModel(filterModel)
      }
    }
  }, [api, activeFilters])

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnToggleRef.current && !columnToggleRef.current.contains(e.target as Node)) {
        setShowColumnToggle(false)
      }
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterConfig(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const actualTotalRows = totalRows ?? localRows.length

  return (
    <div className={`flex flex-col bg-surface-1 border border-divider rounded-card overflow-hidden ${className}`} style={{ height, ...style }}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-divider bg-surface-2">
          <div className="flex items-center gap-2">
            {/* Search */}
            {allowSearch && (
              showSearch ? (
                <SearchPanel
                  value={searchValue}
                  onChange={handleSearch}
                  matches={searchMatches}
                  currentMatch={currentMatch}
                  onPrev={() => setCurrentMatch(m => Math.max(1, m - 1))}
                  onNext={() => setCurrentMatch(m => Math.min(searchMatches, m + 1))}
                  onClose={() => { setShowSearch(false); setSearchValue('') }}
                />
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-muted hover:text-text-primary"
                  title="Search displayed data"
                >
                  <Search className="w-4 h-4" />
                </button>
              )
            )}

            {/* Active filters */}
            {activeFilters.map(f => (
              <div key={f.field} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary">
                <Filter className="w-3 h-3" />
                <span>{f.name}: {f.value}</span>
                <button onClick={() => removeFilter(f.field)} className="hover:text-primary-hover">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {/* Column toggle */}
            {allowColumnToggle && (
              <div className="relative" ref={columnToggleRef}>
                <button
                  onClick={() => setShowColumnToggle(!showColumnToggle)}
                  className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-muted hover:text-text-primary"
                  title="Explore columns"
                >
                  <Columns3 className="w-4 h-4" />
                </button>
                {showColumnToggle && (
                  <div className="absolute right-0 top-full mt-1 z-50">
                    <ColumnTogglePanel
                      columns={parsedColumns.map(c => ({ 
                        field: c.field, 
                        headerName: c.headerName || c.field,
                        type: c.type || columnTypes[c.field]
                      }))}
                      visibleColumns={visibleColumns}
                      onToggle={toggleColumn}
                      onClose={() => setShowColumnToggle(false)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Filter panel */}
            {allowFilter && filterConfig && (
              <div className="absolute right-4 top-12 z-50" ref={filterPanelRef}>
                <FilterPanel
                  filterConfig={filterConfig}
                  onApply={applyFilter}
                  onClose={() => setFilterConfig(null)}
                />
              </div>
            )}

            {/* Export */}
            {allowExport && (
              <button
                onClick={exportCsv}
                className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-muted hover:text-text-primary"
                title="Download CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Refresh */}
            {allowRefresh && onRefresh && (
              <button
                onClick={() => onRefresh()}
                className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-muted hover:text-text-primary"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 ag-theme-quartz-dark">
        <AgGridReact
          ref={gridRef as any}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          rowData={localRows}
          animateRows
          pagination={!compact}
          suppressPaginationPanel
          onGridReady={onGridReady as any}
          onPaginationChanged={onPaginationChanged}
          onCellValueChanged={handleCellValueChanged}
          enableCellTextSelection
          rowHeight={compact ? 28 : 32}
          headerHeight={36}
        />
      </div>

      {/* Footer */}
      {showFooter && !compact && (
        <div className="px-3 py-2 border-t border-divider bg-surface-2 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-4">
            {/* Download button */}
            {allowExport && (
              <button
                onClick={exportCsv}
                className="p-1 hover:bg-surface-3 rounded transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Row count & runtime */}
            <span>{actualTotalRows.toLocaleString()} rows</span>
            {runtime !== undefined && (
              <span className="text-text-muted">| {runtime.toFixed(2)}s runtime</span>
            )}
            {lastRefreshed && (
              <span>Refreshed {lastRefreshed.toLocaleString()}</span>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-4">
            <span>
              {((currentPage - 1) * gridPageSize + 1).toLocaleString()} - {Math.min(currentPage * gridPageSize, actualTotalRows).toLocaleString()} of {actualTotalRows.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                className="p-1 hover:bg-surface-3 rounded transition-colors disabled:opacity-30"
                onClick={() => onPageChange ? onPageChange(currentPage - 1, gridPageSize) : api?.paginationGoToPreviousPage()}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                className="p-1 hover:bg-surface-3 rounded transition-colors disabled:opacity-30"
                onClick={() => onPageChange ? onPageChange(currentPage + 1, gridPageSize) : api?.paginationGoToNextPage()}
                disabled={currentPage >= (totalRows ? Math.ceil(totalRows / gridPageSize) : internalTotalPages)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
