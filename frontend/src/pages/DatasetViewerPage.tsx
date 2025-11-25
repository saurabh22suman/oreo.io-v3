import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { getDatasetDataTop, getDatasetStatsTop, getProject, getDataset } from '../api'
import Alert from '../components/Alert'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import {
  ChevronLeft, Database, BarChart3, Table2, RefreshCw, Download,
  ChevronRight, ChevronLeft as PrevIcon, Edit3, Type, Hash, Calendar,
  ToggleLeft, FileSpreadsheet, FileText, ChevronDown, MoreVertical,
  Filter, Copy, Pin, Clock, ArrowUp, ArrowDown, ArrowUpDown, X, Plus
} from 'lucide-react'

// Custom Header Component with Sort Icons and Context Menu
const CustomHeader = (props: any) => {
  const { displayName, column, api, setFilterColumn } = props;
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

  const handleFilter = () => {
    setFilterColumn({
      name: displayName,
      field: column.getColId(),
      type: type
    });
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
            <button onClick={handleFilter} className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>
            <div className="relative group/sub">
              <button className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5" />
                  Format
                </div>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
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

export default function DatasetViewerPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [runtime, setRuntime] = useState<number>(0)
  const [filterColumn, setFilterColumn] = useState<any>(null)
  const [filterCondition, setFilterCondition] = useState('contains')
  const [filterValue, setFilterValue] = useState('')

  async function loadData(offset: number, limit: number) {
    try {
      setLoading(true)
      const start = performance.now()
      const response = await getDatasetDataTop(dsId, limit, offset)
      const end = performance.now()
      setRuntime((end - start) / 1000)

      if (!response) throw new Error('No response from server')

      const dataArray = response.data || response.rows || []
      const columnsArray = response.columns || []

      setRows(dataArray)
      setColumns(columnsArray)
    } catch (e: any) {
      console.error('[DataViewer] Error loading data:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
        setStats(await getDatasetStatsTop(dsId))
        await loadData(0, 50)
      } catch (e: any) {
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

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
    ];

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
      headerComponentParams: { columnType: columnTypes[c], setFilterColumn },
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

  const handleNextPage = useCallback(() => {
    const newPage = page + 1
    setPage(newPage)
    loadData(newPage * pageSize, pageSize)
  }, [page, pageSize])

  const handlePrevPage = useCallback(() => {
    if (page > 0) {
      const newPage = page - 1
      setPage(newPage)
      loadData(newPage * pageSize, pageSize)
    }
  }, [page, pageSize])

  const handleRefresh = useCallback(async () => {
    try {
      setStats(await getDatasetStatsTop(dsId))
      await loadData(page * pageSize, pageSize)
    } catch (e: any) {
      setError(e.message)
    }
  }, [dsId, page, pageSize])

  const exportCsv = useCallback(() => {
    api?.exportDataAsCsv({ fileName: `${dataset?.name || 'dataset'}.csv` })
    setShowDownloadMenu(false)
  }, [api, dataset])

  const exportExcel = useCallback(() => {
    api?.exportDataAsCsv({ fileName: `${dataset?.name || 'dataset'}.csv` })
    setShowDownloadMenu(false)
  }, [api, dataset])

  const applyFilter = () => {
    if (!api || !filterColumn || !filterValue) return;
    api.setGridOption('quickFilterText', filterValue);
    setFilterColumn(null);
    setFilterValue('');
  };

  useEffect(() => {
    if (api && rows.length > 0) {
      api.setGridOption('rowData', rows)
    }
  }, [rows, api])

  const totalPages = Math.ceil((stats?.row_count || 0) / pageSize)

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <div className="bg-[#0f172a] border-b border-slate-800">
        <div className="max-w-full px-6 py-4">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dataset
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Table2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Data Viewer</h1>
                <p className="text-slate-400 text-sm">Explore {dataset?.name}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full px-6 py-6">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        <div className="bg-[#0f172a] rounded-lg border border-slate-800 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
          {filterColumn && (
            <div className="p-4 border-b border-slate-800 bg-[#1e293b]/50">
              <div className="flex items-center gap-3 mb-3">
                <Filter className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Add filter</span>
                <button onClick={() => setFilterColumn(null)} className="ml-auto p-1 hover:bg-slate-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    {filterColumn.name}
                  </span>
                  <button onClick={() => setFilterColumn(null)} className="p-1 hover:bg-slate-700 rounded">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <select
                  value={filterCondition}
                  onChange={(e) => setFilterCondition(e.target.value)}
                  className="px-3 py-2 bg-[#0f172a] border border-slate-700 rounded text-sm text-slate-300"
                >
                  <option value="is one of">is one of</option>
                  <option value="contains">contains</option>
                  <option value="equals">equals</option>
                </select>

                <input
                  type="text"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder="Type or select"
                  className="px-3 py-2 bg-[#0f172a] border border-slate-700 rounded text-sm text-slate-300 placeholder-slate-500"
                />

                <div className="flex gap-2">
                  <button
                    onClick={applyFilter}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setFilterColumn(null)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 ag-theme-databricks-dark w-full">
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading data...
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
                suppressPaginationPanel={true}
                domLayout="normal"
                rowHeight={32}
                headerHeight={36}
              />
            )}
          </div>

          <div className="px-4 py-2 border-t border-slate-800 bg-[#0f172a] flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="p-1.5 border border-slate-700 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {showDownloadMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDownloadMenu(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-40 bg-[#1e293b] rounded-lg shadow-xl border border-slate-700 py-1 z-20">
                      <button
                        onClick={exportCsv}
                        className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        Download CSV
                      </button>
                      <button
                        onClick={exportExcel}
                        className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                        Download Excel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 0}
                  className="hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <PrevIcon className="w-3.5 h-3.5" />
                </button>
                <span>
                  {page * pageSize + 1}-{Math.min((page + 1) * pageSize, stats?.row_count || 0)}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={page >= totalPages - 1 || rows.length < pageSize}
                  className="hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-3 w-px bg-slate-700" />

              <span>{rows.length} rows</span>

              <div className="h-3 w-px bg-slate-700" />

              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>{runtime.toFixed(2)}s runtime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
