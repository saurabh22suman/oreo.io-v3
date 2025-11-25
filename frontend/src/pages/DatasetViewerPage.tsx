import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDatasetDataTop, getDatasetStatsTop, getProject, getDataset } from '../api'
import Alert from '../components/Alert'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { ChevronLeft, Database, BarChart3, Table2, RefreshCw, Download, ChevronRight, ChevronLeft as PrevIcon, Edit3, Type, Hash, Calendar, ToggleLeft, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'

// Custom Header Component for Column Types
const CustomHeader = (props: any) => {
  const { displayName, column } = props;
  const type = props.columnType || 'text';

  const Icon = {
    text: Type,
    number: Hash,
    date: Calendar,
    boolean: ToggleLeft
  }[type] || Type;

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
      <Icon className="w-3.5 h-3.5 opacity-50" />
      <span>{displayName}</span>
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

  async function loadData(offset: number, limit: number) {
    try {
      setLoading(true)
      const response = await getDatasetDataTop(dsId, limit, offset)
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

  // Load data automatically on mount
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

  // Infer column types
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
    // Add row number column
    const defs: ColDef[] = [
      {
        headerName: '#',
        valueGetter: 'node.rowIndex + 1',
        width: 50,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        cellClass: 'bg-slate-50 dark:bg-slate-800 text-slate-400 text-xs font-mono flex items-center justify-center border-r border-slate-200 dark:border-slate-700',
        headerClass: 'bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700',
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
      headerComponentParams: { columnType: columnTypes[c] },
      cellClass: 'text-sm text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700 font-mono',
    }))]
  }, [columns, columnTypes])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    headerClass: 'bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700',
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
    // For now, we'll just use CSV but name it .csv (Excel opens it). 
    // Real .xlsx requires a library like 'xlsx' or 'exceljs'.
    api?.exportDataAsCsv({ fileName: `${dataset?.name || 'dataset'}.csv` })
    setShowDownloadMenu(false)
  }, [api, dataset])

  // Update grid when rows change
  useEffect(() => {
    if (api && rows.length > 0) {
      api.setGridOption('rowData', rows)
    }
  }, [rows, api])

  const totalPages = Math.ceil((stats?.row_count || 0) / pageSize)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header - Slightly Larger */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-b border-slate-700">
        <div className="max-w-full px-8 py-6">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dataset
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <Table2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">Data Viewer</h1>
                <p className="text-slate-300 text-sm mt-1">Browse and explore dataset records</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Total Rows</div>
                  <div className="text-lg font-bold text-white leading-none">{(stats?.row_count ?? 0).toLocaleString()}</div>
                </div>
                <BarChart3 className="w-5 h-5 text-white/40" />
              </div>

              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Viewing</div>
                  <div className="text-lg font-bold text-white leading-none">{rows.length}</div>
                </div>
                <Table2 className="w-5 h-5 text-white/40" />
              </div>

              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                <div className="text-right">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Columns</div>
                  <div className="text-lg font-bold text-white leading-none">{columns.length || stats?.column_count || 0}</div>
                </div>
                <Database className="w-5 h-5 text-white/40" />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full px-6 py-6">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {/* Data Grid Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">{dataset?.name || 'Dataset Records'}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                Page {page + 1} of {totalPages || 1}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => api?.sizeColumnsToFit({ defaultMinWidth: 100 })}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                Fit Columns
              </button>
            </div>
          </div>

          {/* AG Grid */}
          <div className="ag-theme-quartz dark:ag-theme-quartz-dark" style={{ height: 'calc(100vh - 350px)', minHeight: '400px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
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
                rowClass="border-b border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-slate-900 dark:text-slate-100 font-medium"
              />
            )}
          </div>

          {/* Bottom Toolbar: Pagination & Download */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            {/* Download Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>

              {showDownloadMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  <div className="absolute bottom-full left-0 mb-2 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-20">
                    <button
                      onClick={exportCsv}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Download CSV
                    </button>
                    <button
                      onClick={exportExcel}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                      Download Excel
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value)
                    setPageSize(newSize)
                    setPage(0)
                    loadData(0, newSize)
                  }}
                  className="px-2 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, stats?.row_count || 0)} of {(stats?.row_count || 0).toLocaleString()}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevPage}
                    disabled={page === 0}
                    className="p-1.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PrevIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={page >= totalPages - 1 || rows.length < pageSize}
                    className="p-1.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
