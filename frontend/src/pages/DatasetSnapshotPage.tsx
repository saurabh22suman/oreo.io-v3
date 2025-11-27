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
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
        <Icon className="w-3.5 h-3.5 opacity-50" />
        <span>{displayName}</span>
        <button
          onClick={handleSort}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <SortIcon className={`w-3.5 h-3.5 ${sortState ? 'text-blue-400' : 'text-slate-500'}`} />
        </button>
      </div>

      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleMenuClick}
          className={`p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-all ${showMenu ? 'opacity-100 bg-slate-700 text-slate-200' : ''}`}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {showMenu && createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px` }}
            className="w-48 bg-[#1e293b] border border-slate-700 rounded-lg shadow-xl z-[9999] py-1"
          >
            <button onClick={handleCopy} className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
              <Copy className="w-3.5 h-3.5" />
              Copy column name
            </button>
            <div className="h-px bg-slate-700 my-1" />
            <button onClick={handlePin} className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
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
  WRITE: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'CREATE TABLE': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  MERGE: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  append: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  edit: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  cr_merged: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  restore: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  RESTORE: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
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
        cellClass: 'bg-[#0f172a] text-slate-500 text-xs font-mono flex items-center justify-center border-r border-slate-800',
        headerClass: 'bg-[#0f172a] border-r border-slate-800',
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
      cellClass: 'text-sm text-slate-300 font-mono border-r border-slate-800',
    }))]
  }, [columns, columnTypes])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    headerClass: 'bg-[#0f172a] border-r border-slate-800',
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
    <div className="h-screen overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      {/* Compact Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-4 text-white shadow-xl shadow-slate-900/20 mx-4 mt-4 flex-shrink-0">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/projects/${projectId}/datasets/${dsId}`}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors no-underline"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10">
              <History className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Snapshots</h1>
                <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-bold border border-white/10 text-blue-200">
                  Time Travel
                </span>
              </div>
              <p className="text-slate-400 text-xs">
                {dataset?.name || `Dataset #${dsId}`} • {project?.name || 'Project'}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 py-3 min-h-0">
          {/* Calendar Panel - Compact */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col min-h-0">
            <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col h-full">
              {/* Calendar Header */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid - Compact */}
              <div className="p-2 flex-shrink-0">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-[10px] font-semibold text-slate-400 py-1">
                      {day.charAt(0)}
                    </div>
                  ))}
                </div>

                {/* Date cells */}
                <div className="grid grid-cols-7 gap-0.5">
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
                          aspect-square rounded flex flex-col items-center justify-center relative transition-all text-xs
                          ${isSelected
                            ? 'bg-blue-600 text-white shadow'
                            : count > 0
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }
                          ${isToday && !isSelected ? 'ring-1 ring-blue-500' : ''}
                        `}
                      >
                        <span className="font-medium">{day}</span>
                        {count > 0 && (
                          <span className={`
                            absolute -bottom-0.5 -right-0.5 text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center
                            ${isSelected
                              ? 'bg-white/30 text-white'
                              : 'bg-blue-600 text-white'
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
              <div className="border-t border-slate-100 dark:border-slate-700/50 flex-1 min-h-0 overflow-hidden">
                <div className="p-2 bg-slate-50 dark:bg-slate-800/30 h-full flex flex-col">
                  {selectedDate ? (
                    <>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2 flex-shrink-0">
                        {new Date(selectedDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </h4>
                      
                      {selectedDateSnapshots.length === 0 ? (
                        <p className="text-xs text-slate-500">No snapshots</p>
                      ) : (
                        <ul className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
                          {selectedDateSnapshots.map((snap) => (
                            <li key={snap.version}>
                              <button
                                onClick={() => setSelectedVersion(snap)}
                                className={`
                                  w-full p-2 rounded-lg text-left transition-all
                                  ${selectedVersion?.version === snap.version
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`p-0.5 rounded ${selectedVersion?.version === snap.version ? 'bg-white/20' : eventTypeColors[snap.operation || snap.type] || 'bg-slate-100 dark:bg-slate-700'}`}>
                                    {eventTypeIcons[snap.operation || snap.type] || <Database className="w-3 h-3" />}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-70">
                                    #{snap.version}
                                  </span>
                                  <span className="text-[10px] opacity-70 ml-auto">{formatTime(snap.timestamp)}</span>
                                </div>
                                <p className={`text-xs font-medium truncate mt-0.5 ${selectedVersion?.version === snap.version ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {snap.title}
                                </p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <p className="text-xs text-center">Select a date<br/>with snapshots</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Data Viewer Panel */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
            {selectedVersion ? (
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-xl flex flex-col h-full">
                {/* Snapshot Header - Compact */}
                <div className="px-4 py-2 border-b border-slate-800 bg-[#0f172a] flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${eventTypeColors[selectedVersion.operation || selectedVersion.type] || 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        {eventTypeIcons[selectedVersion.operation || selectedVersion.type] || <Database className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Snapshot #{selectedVersion.version}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {formatFullDate(selectedVersion.timestamp)} at {formatTime(selectedVersion.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    {canRestore && (
                      <button
                        onClick={() => setShowRestoreModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-500/25 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore to this Snapshot
                      </button>
                    )}
                  </div>

                  {/* Banner - Compact */}
                  <div className="mt-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300">
                      <span className="font-semibold">Read-only snapshot view</span> — You are viewing data as it was at this point in time.
                    </p>
                  </div>
                </div>

                {/* Data Grid - Databricks Style - Flex to fill */}
                <div className="flex-1 min-h-0 w-full ag-theme-databricks-dark">
                  {loadingData ? (
                    <div className="flex items-center justify-center h-full bg-[#0f172a]">
                      <div className="text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading snapshot data...
                      </div>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex items-center justify-center h-full bg-[#0f172a]">
                      <div className="text-center">
                        <Table2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500">No data in this snapshot</p>
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
                <div className="px-3 py-1.5 border-t border-slate-800 bg-[#0f172a] flex items-center justify-between text-[11px] text-slate-400 font-mono flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <span>{totalRows} rows</span>
                    <div className="h-3 w-px bg-slate-700" />
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{runtime.toFixed(2)}s</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={page === 0}
                      className="p-0.5 hover:bg-slate-800 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRows)}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={page >= totalPages - 1 || rows.length < pageSize}
                      className="p-0.5 hover:bg-slate-800 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-8 text-center shadow-xl flex flex-col items-center justify-center h-full">
                <Calendar className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Select a Snapshot</h3>
                <p className="text-slate-400 text-sm max-w-sm">
                  Click on a date in the calendar that has snapshots, then select a specific snapshot to view the data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md border-0 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Restore Snapshot?
                </h3>
              </div>

              <p className="text-slate-600 dark:text-slate-400 mb-4">
                You are about to restore to <span className="font-semibold">Snapshot #{selectedVersion.version}</span> from {formatFullDate(selectedVersion.timestamp)}.
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-green-500" />
                  Replace dataset with its state at this time
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-green-500" />
                  Undo changes made after this snapshot
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="w-4 h-4 text-green-500" />
                  Create a new snapshot documenting the restore
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  disabled={restoring}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {restoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
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
