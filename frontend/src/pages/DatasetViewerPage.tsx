import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDatasetDataTop, getDatasetStatsTop, getProject } from '../api'
import Alert from '../components/Alert'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { ChevronLeft, Database, BarChart3, Table2, RefreshCw, Download, ChevronRight, ChevronLeft as PrevIcon } from 'lucide-react'

export default function DatasetViewerPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)
  const [project, setProject] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadData(offset: number, limit: number) {
    try {
      console.log('[DataViewer] Loading data with offset:', offset, 'limit:', limit, 'dsId:', dsId)
      setLoading(true)
      const response = await getDatasetDataTop(dsId, limit, offset)
      console.log('[DataViewer] Received response:', response)

      if (!response) {
        throw new Error('No response from server')
      }

      const dataArray = response.data || response.rows || []
      const columnsArray = response.columns || []

      console.log('[DataViewer] Data array length:', dataArray.length)
      console.log('[DataViewer] Columns:', columnsArray)

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
        console.log('[DataViewer] Loading initial data for dataset', dsId)
        setProject(await getProject(projectId))
        setStats(await getDatasetStatsTop(dsId))
        await loadData(0, 50) // Auto-load first page
      } catch (e: any) {
        console.error('[DataViewer] Error during initial load:', e)
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

  const colDefs = useMemo<ColDef[]>(() => {
    return columns.map((c) => ({
      headerName: c,
      field: c,
      colId: c,
      valueGetter: (p: any) => p?.data?.[c],
      editable: false,
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: true, // Enable column filters
    }))
  }, [columns])

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    minWidth: 100,
  }), [])

  const onGridReady = useCallback((params: { api: GridApi }) => {
    console.log('[DataViewer] Grid ready, setting', rows.length, 'rows')
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
    api?.exportDataAsCsv({ fileName: 'dataset-export.csv' })
  }, [api])

  // Update grid when rows change
  useEffect(() => {
    if (api && rows.length > 0) {
      console.log('[DataViewer] Updating grid with', rows.length, 'rows')
      api.setGridOption('rowData', rows)
    }
  }, [rows, api])

  const totalPages = Math.ceil((stats?.row_count || 0) / pageSize)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-b border-slate-700">
        <div className="max-w-full px-6 py-8">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dataset
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <Table2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Data Viewer</h1>
                <p className="text-slate-300 text-sm mt-1">Browse and explore dataset records</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Rows</div>
                  <div className="text-2xl font-bold text-white">{(stats?.row_count ?? 0).toLocaleString()}</div>
                </div>
                <BarChart3 className="w-8 h-8 text-white/50" />
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Viewing</div>
                  <div className="text-2xl font-bold text-white">{rows.length}</div>
                </div>
                <Table2 className="w-8 h-8 text-white/50" />
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Columns</div>
                  <div className="text-2xl font-bold text-white">{columns.length || stats?.column_count || 0}</div>
                </div>
                <Database className="w-8 h-8 text-white/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full px-6 py-6">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {/* Data Grid Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-900 dark:text-white">Dataset Records</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {page + 1} of {totalPages || 1}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => api?.sizeColumnsToFit({ defaultMinWidth: 100 })}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Fit Columns
              </button>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* AG Grid */}
          <div className="ag-theme-quartz dark:ag-theme-quartz-dark" style={{ height: 'calc(100vh - 500px)', minHeight: '500px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-slate-500 dark:text-slate-400">Loading data...</div>
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
              />
            )}
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value)
                  setPageSize(newSize)
                  setPage(0)
                  loadData(0, newSize)
                }}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, stats?.row_count || 0)} of {(stats?.row_count || 0).toLocaleString()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={page === 0}
                  className="p-2 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={page >= totalPages - 1 || rows.length < pageSize}
                  className="p-2 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
