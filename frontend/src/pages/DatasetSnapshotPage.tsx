import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { 
  getDataset, 
  getProject, 
  getSnapshotCalendar,
  getSnapshotData,
  restoreSnapshot,
  myProjectRole,
  SnapshotEntry,
  SnapshotCalendar
} from '../api'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  History,
  Loader2,
  RotateCcw,
  Upload,
  GitMerge,
  Pencil,
  FileText,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Eye,
  Table2,
  Download,
  Type,
  Hash,
  ToggleLeft,
  MoreVertical,
  Filter,
  Copy,
  Pin,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react'

// Custom Header Component with Sort Icons and Context Menu (Databricks style)
const CustomHeader = (props: any) => {
  const { displayName, column, api } = props;
  const type = props.columnType || 'text';
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sortState = column.getSort();

  const Icon = {
    text: Type,
    number: Hash,
    date: Calendar,
    boolean: ToggleLeft
  }[type] || Type;

  const SortIcon = sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ x: rect.right - 192, y: rect.bottom + 5 });
    }
    setShowMenu(!showMenu);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayName);
    setShowMenu(false);
  };

  const handlePin = () => {
    const colId = column.getColId();
    const isPinned = column.isPinned();
    api.applyColumnState({
      state: [{ colId, pinned: isPinned ? null : 'left' }],
      defaultState: { pinned: null }
    });
    setShowMenu(false);
  };

  const handleSort = () => {
    if (!sortState) {
      column.setSort('asc');
    } else if (sortState === 'asc') {
      column.setSort('desc');
    } else {
      column.setSort(null);
    }
  };

  return (
    <div className="flex items-center justify-between w-full h-full group">
      <div className="flex items-center gap-2 text-xs font-bold text-text-secondary group-hover:text-text transition-colors">
        <Icon className="w-3.5 h-3.5 opacity-50" />
        <span>{displayName}</span>
        <button
          onClick={handleSort}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <SortIcon className={`w-3.5 h-3.5 ${sortState ? 'text-primary' : 'text-text-muted'}`} />
        </button>
      </div>

      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          className={`p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-all ${showMenu ? 'opacity-100 bg-surface-2 text-text' : ''}`}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {showMenu && createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
            className="w-48 bg-surface-2 border border-divider rounded-lg shadow-xl z-[9999] py-1"
          >
            <button onClick={handleCopy} className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-3 flex items-center gap-2">
              <Copy className="w-3.5 h-3.5" />
              Copy column name
            </button>
            <div className="h-px bg-divider my-1" />
            <button onClick={handlePin} className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-3 flex items-center gap-2">
              <Pin className="w-3.5 h-3.5" />
              {column.isPinned() ? 'Unpin column' : 'Pin column'}
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

// Helper to get month/year display
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Event type icons
const eventTypeIcons: Record<string, React.ReactNode> = {
  WRITE: <Upload className="w-3.5 h-3.5" />,
  'CREATE TABLE': <Database className="w-3.5 h-3.5" />,
  MERGE: <GitMerge className="w-3.5 h-3.5" />,
  append: <Upload className="w-3.5 h-3.5" />,
  edit: <Pencil className="w-3.5 h-3.5" />,
  cr_merged: <GitMerge className="w-3.5 h-3.5" />,
  restore: <RotateCcw className="w-3.5 h-3.5" />,
}

// Event type colors for badges
const eventTypeColors: Record<string, string> = {
  WRITE: 'bg-success/10 text-success',
  'CREATE TABLE': 'bg-primary/10 text-primary',
  MERGE: 'bg-accent/10 text-accent',
  append: 'bg-success/10 text-success',
  edit: 'bg-primary/10 text-primary',
  cr_merged: 'bg-accent/10 text-accent',
  restore: 'bg-warning/10 text-warning',
  RESTORE: 'bg-warning/10 text-warning',
}

type Dataset = { id: number; name: string }

export default function DatasetSnapshotPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)

  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)

  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [calendar, setCalendar] = useState<SnapshotCalendar>({})
  const [versions, setVersions] = useState<SnapshotEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<SnapshotEntry | null>(null)

  // Data viewer state
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [pageSize] = useState(50)
  const [totalRows, setTotalRows] = useState(0)
  const [runtime, setRuntime] = useState(0)

  // Restore modal
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // Load project, dataset, role, and calendar
  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
        try {
          const r = await myProjectRole(projectId)
          setRole(r.role)
        } catch { }
        
        const result = await getSnapshotCalendar(dsId)
        setCalendar(result.calendar || {})
        setVersions(result.versions || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

  // Load snapshot data when version is selected
  const loadSnapshotData = useCallback(async (version: number, offset: number) => {
    setLoadingData(true)
    try {
      const start = performance.now()
      const result = await getSnapshotData(dsId, version, pageSize, offset)
      const end = performance.now()
      setRuntime((end - start) / 1000)
      
      setRows(result.data || [])
      setColumns(result.columns || [])
      setTotalRows(result.total || 0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingData(false)
    }
  }, [dsId, pageSize])

  // When version is selected, load its data
  useEffect(() => {
    if (selectedVersion !== null) {
      setPage(0)
      loadSnapshotData(selectedVersion.version, 0)
    }
  }, [selectedVersion, loadSnapshotData])

  // Handle pagination
  const handleNextPage = useCallback(() => {
    if (selectedVersion) {
      const newPage = page + 1
      setPage(newPage)
      loadSnapshotData(selectedVersion.version, newPage * pageSize)
    }
  }, [page, pageSize, selectedVersion, loadSnapshotData])

  const handlePrevPage = useCallback(() => {
    if (selectedVersion && page > 0) {
      const newPage = page - 1
      setPage(newPage)
      loadSnapshotData(selectedVersion.version, newPage * pageSize)
    }
  }, [page, pageSize, selectedVersion, loadSnapshotData])

  // Handle restore
  const handleRestore = async () => {
    if (!selectedVersion) return
    setRestoring(true)
    try {
      const result = await restoreSnapshot(dsId, selectedVersion.version)
      setToast(`Successfully restored to Snapshot #${selectedVersion.version}`)
      setShowRestoreModal(false)
      // Reload calendar
      const calResult = await getSnapshotCalendar(dsId)
      setCalendar(calResult.calendar || {})
      setVersions(calResult.versions || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRestoring(false)
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth)

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  // Get snapshots for selected date
  const selectedDateSnapshots = selectedDate ? (calendar[selectedDate] || []) : []

  // Format timestamp
  const formatTime = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatFullDate = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Detect column types from data
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    if (rows.length > 0) {
      columns.forEach(col => {
        const val = rows[0][col];
        if (typeof val === 'number') types[col] = 'number';
        else if (typeof val === 'boolean') types[col] = 'boolean';
        else if (val instanceof Date) types[col] = 'date';
        else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') types[col] = 'number';
        else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) types[col] = 'date';
        else types[col] = 'text';
      });
    }
    return types;
  }, [rows, columns]);

  // AG Grid columns - Databricks style
  const colDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = [
      {
        headerName: '',
        valueGetter: 'node.rowIndex + 1',
        width: 50,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'bg-surface-2 text-text-secondary text-xs font-mono flex items-center justify-center border-r border-divider',
        headerClass: 'bg-surface-2 border-r border-divider',
      }
    ]

    return [...defs, ...columns.map((c) => ({
      headerName: c,
      field: c,
      colId: c,
      valueGetter: (p: any) => p?.data?.[c],
      editable: false,
      resizable: true,
      sortable: true,
      filter: true,
      headerComponent: CustomHeader,
      headerComponentParams: { columnType: columnTypes[c] },
      cellClass: 'text-sm text-text font-mono border-r border-divider',
    }))]
  }, [columns, columnTypes])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    headerClass: 'bg-surface-2 border-r border-divider',
  }), [])

  const onGridReady = useCallback((params: { api: GridApi }) => {
    setApi(params.api)
    params.api.setGridOption('rowData', rows)
    setTimeout(() => params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)
  }, [rows])

  useEffect(() => {
    if (api && rows.length > 0) {
      api.setGridOption('rowData', rows)
    }
  }, [rows, api])

  const canRestore = role === 'owner' || role === 'contributor'
  const totalPages = Math.ceil(totalRows / pageSize)

  return (
    <div className="h-screen overflow-hidden flex flex-col animate-fade-in bg-surface-1">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="error" message={error} onClose={() => setError('')} />
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss />
        </div>
      )}

      {/* Header Section */}
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
                <History className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-text leading-tight font-display tracking-tight">Snapshots</h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold border border-primary/20 text-primary uppercase tracking-wider">
                    Time Travel
                  </span>
                </div>
                <p className="text-text-secondary text-sm mt-1 font-medium">
                  {dataset?.name || `Dataset #${dsId}`} • {project?.name || 'Project'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 py-6 min-h-0">
          {/* Calendar Panel - Compact */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col min-h-0">
            <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden flex flex-col h-full">
              {/* Calendar Header */}
              <div className="px-4 py-3 border-b border-divider bg-surface-2/30 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors text-text-secondary hover:text-text"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-text">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors text-text-secondary hover:text-text"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid - Compact */}
              <div className="p-4 flex-shrink-0">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-text-muted py-1 uppercase tracking-wider">
                      {day.charAt(0)}
                    </div>
                  ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty cells for days before the 1st */}
                  {Array.from({ length: startingDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square"></div>
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dateKey = formatDateKey(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth(),
                      day
                    )
                    const snapshots = calendar[dateKey] || []
                    const count = snapshots.length
                    const isSelected = selectedDate === dateKey
                    const isToday = new Date().toDateString() === new Date(dateKey).toDateString()

                    return (
                      <button
                        key={day}
                        onClick={() => {
                          setSelectedDate(dateKey)
                          setSelectedVersion(null)
                          setRows([])
                          setColumns([])
                        }}
                        className={`
                          aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all text-xs font-medium
                          ${isSelected
                            ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-105 z-10'
                            : count > 0
                              ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105'
                              : 'text-text-secondary hover:bg-surface-2 hover:text-text'
                          }
                          ${isToday && !isSelected ? 'ring-2 ring-primary/30' : ''}
                        `}
                      >
                        <span>{day}</span>
                        {count > 0 && (
                          <span className={`
                            absolute -bottom-1 -right-1 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm
                            ${isSelected
                              ? 'bg-white text-primary'
                              : 'bg-primary text-white'
                            }
                          `}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Selected Date Snapshots - Scrollable */}
              <div className="border-t border-divider flex-1 min-h-0 overflow-hidden bg-surface-2/30">
                <div className="p-4 h-full flex flex-col">
                  {selectedDate ? (
                    <>
                      <h4 className="text-xs font-bold text-text-secondary mb-3 flex-shrink-0 uppercase tracking-wider">
                        {new Date(selectedDate).toLocaleDateString([], { month: 'long', day: 'numeric' })}
                      </h4>
                      
                      {selectedDateSnapshots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-text-muted border-2 border-dashed border-divider rounded-xl">
                          <p className="text-xs font-medium">No snapshots</p>
                        </div>
                      ) : (
                        <ul className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar">
                          {selectedDateSnapshots.map((snap) => (
                            <li key={snap.version}>
                              <button
                                onClick={() => setSelectedVersion(snap)}
                                className={`
                                  w-full p-3 rounded-xl text-left transition-all border group relative overflow-hidden
                                  ${selectedVersion?.version === snap.version
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                                    : 'bg-surface-1 hover:bg-surface-1 hover:border-primary/30 border-divider hover:shadow-md'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className={`p-1.5 rounded-lg ${selectedVersion?.version === snap.version ? 'bg-white/20' : eventTypeColors[snap.operation || snap.type] || 'bg-surface-3'}`}>
                                    {eventTypeIcons[snap.operation || snap.type] || <Database className="w-3.5 h-3.5" />}
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${selectedVersion?.version === snap.version ? 'bg-white/20' : 'bg-surface-3 text-text-secondary'}`}>
                                    v{snap.version}
                                  </span>
                                  <span className={`text-[10px] font-medium ml-auto ${selectedVersion?.version === snap.version ? 'text-white/80' : 'text-text-muted'}`}>
                                    {formatTime(snap.timestamp)}
                                  </span>
                                </div>
                                <p className={`text-xs font-bold truncate ${selectedVersion?.version === snap.version ? 'text-white' : 'text-text group-hover:text-primary transition-colors'}`}>
                                  {snap.title}
                                </p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-3">
                      <div className="p-4 bg-surface-1 rounded-full border border-divider shadow-sm">
                        <Calendar className="w-6 h-6 text-text-secondary" />
                      </div>
                      <p className="text-xs font-medium text-center">Select a date<br/>to view snapshots</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Data Viewer Panel */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
            {selectedVersion ? (
              <div className="bg-surface-1 rounded-3xl border border-divider overflow-hidden shadow-lg shadow-black/5 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Snapshot Header - Compact */}
                <div className="px-4 py-3 border-b border-divider bg-surface-2/30 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shadow-sm ${eventTypeColors[selectedVersion.operation || selectedVersion.type] || 'bg-surface-3'}`}>
                        {eventTypeIcons[selectedVersion.operation || selectedVersion.type] || <Database className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text">
                          Snapshot #{selectedVersion.version}
                        </h3>
                        <p className="text-xs text-text-secondary font-medium">
                          {formatFullDate(selectedVersion.timestamp)} at {formatTime(selectedVersion.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    {canRestore && (
                      <button
                        onClick={() => setShowRestoreModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore to this Snapshot
                      </button>
                    )}
                  </div>

                  {/* Banner - Compact */}
                  <div className="mt-3 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-warning flex-shrink-0" />
                    <p className="text-xs text-warning font-medium">
                      <span className="font-bold">Read-only snapshot view</span> — You are viewing data as it was at this point in time.
                    </p>
                  </div>
                </div>

                {/* Data Grid - Databricks Style - Flex to fill */}
                <div className="flex-1 min-h-0 w-full ag-theme-quartz-dark">
                  {loadingData ? (
                    <div className="flex items-center justify-center h-full bg-surface-1">
                      <div className="text-text-secondary flex items-center gap-2 font-medium">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        Loading snapshot data...
                      </div>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex items-center justify-center h-full bg-surface-1">
                      <div className="text-center">
                        <div className="p-4 bg-surface-2 rounded-full inline-block mb-3">
                          <Table2 className="w-8 h-8 text-text-muted" />
                        </div>
                        <p className="text-text-secondary font-medium">No data in this snapshot</p>
                      </div>
                    </div>
                  ) : (
                    <AgGridReact
                      ref={gridRef as any}
                      columnDefs={colDefs}
                      defaultColDef={defaultColDef}
                      rowData={rows}
                      animateRows
                      onGridReady={onGridReady as any}
                      enableCellTextSelection
                      suppressPaginationPanel
                      domLayout="normal"
                      rowHeight={32}
                      headerHeight={36}
                    />
                  )}
                </div>

                {/* Footer with pagination - Databricks style - Compact */}
                <div className="px-4 py-2 border-t border-divider bg-surface-2/50 flex items-center justify-between text-[11px] text-text-secondary font-mono flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-text">{totalRows} rows</span>
                    <div className="h-3 w-px bg-divider" />
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{runtime.toFixed(2)}s</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-surface-1 rounded-lg border border-divider p-0.5 shadow-sm">
                    <button
                      onClick={handlePrevPage}
                      disabled={page === 0}
                      className="p-1 hover:bg-surface-2 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-text-secondary hover:text-text"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-medium text-text">
                      {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRows)}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={page >= totalPages - 1 || rows.length < pageSize}
                      className="p-1 hover:bg-surface-2 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-text-secondary hover:text-text"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-1 rounded-3xl border border-divider p-8 text-center shadow-lg shadow-black/5 flex flex-col items-center justify-center h-full">
                <div className="p-6 bg-surface-2 rounded-full mb-4 shadow-inner">
                  <Calendar className="w-12 h-12 text-primary/50" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2">Select a Snapshot</h3>
                <p className="text-text-secondary text-sm max-w-sm leading-relaxed">
                  Click on a date in the calendar that has snapshots, then select a specific snapshot to view the data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border-0 shadow-2xl bg-surface-1 rounded-3xl overflow-hidden">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-warning/10 text-warning shadow-inner border border-warning/20">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-text tracking-tight">
                    Restore Snapshot?
                  </h3>
                  <p className="text-sm text-text-secondary font-medium">This action cannot be undone easily.</p>
                </div>
              </div>

              <p className="text-text-secondary mb-6 text-base leading-relaxed">
                You are about to restore to <span className="font-bold text-text bg-surface-2 px-1.5 py-0.5 rounded border border-divider">Snapshot #{selectedVersion.version}</span> from {formatFullDate(selectedVersion.timestamp)}.
              </p>

              <div className="bg-surface-2/50 rounded-2xl p-5 mb-8 space-y-3 border border-divider">
                <div className="flex items-center gap-3 text-sm text-text-secondary font-medium">
                  <div className="p-1 bg-success/10 rounded-full">
                    <Check className="w-3 h-3 text-success" />
                  </div>
                  Replace dataset with its state at this time
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary font-medium">
                  <div className="p-1 bg-success/10 rounded-full">
                    <Check className="w-3 h-3 text-success" />
                  </div>
                  Undo changes made after this snapshot
                </div>
                <div className="flex items-center gap-3 text-sm text-text-secondary font-medium">
                  <div className="p-1 bg-success/10 rounded-full">
                    <Check className="w-3 h-3 text-success" />
                  </div>
                  Create a new snapshot documenting the restore
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  disabled={restoring}
                  className="flex-1 px-6 py-3 bg-surface-2 hover:bg-surface-3 text-text font-bold rounded-xl transition-colors border border-divider hover:border-text-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="flex-1 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-primary/40"
                >
                  {restoring ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5" />
                      Restore
                    </>
                  )}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
