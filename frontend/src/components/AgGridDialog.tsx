import { useCallback, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from './ui/dialog'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community'
// AG Grid v34+ requires modules to be registered; use all community modules to cover common features
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])
import 'ag-grid-community/styles/ag-theme-quartz.css'

type Props = {
  open: boolean
  title?: string
  rows: any[]
  columns: string[]
  pageSize?: number
  onOpenChange: (v: boolean) => void
  allowEdit?: boolean
  onSave?: (rows: any[]) => void | Promise<void>
  onFetchMore?: () => Promise<any[] | { data: any[] }>
}

export default function AgGridDialog({ open, title = 'Preview', rows, columns, pageSize = 50, onOpenChange, allowEdit = true, onSave, onFetchMore }: Props){
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi|null>(null)
  const [colApi, setColApi] = useState<any>(null)
  const [localRows, setLocalRows] = useState<any[]>(rows || [])

  // keep local rows in sync when prop changes (open/reopen)
  if (open && localRows !== rows) {
    // naive sync on prop changes while open
  }

  // When rows prop changes (new preview), replace local rows
  // using a ref-safe pattern to avoid uncontrolled updates.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(()=>{ setLocalRows(rows || []) }, [rows])

  const colDefs = useMemo<ColDef[]>(()=> {
    return columns.map((c)=> ({
      field: c,
      headerName: c,
      editable: !!allowEdit,
      resizable: true,
      suppressSizeToFit: false,
    }))
  }, [columns, allowEdit])

  const defaultColDef = useMemo<ColDef>(()=> ({
    sortable: true,
    filter: true,
    floatingFilter: false,
    resizable: true,
  }), [])

  const onGridReady = useCallback((params: { api: GridApi; columnApi: any })=>{
    setApi(params.api); setColApi(params.columnApi)
    params.api.setGridOption('rowData', localRows)
    params.api.setGridOption('paginationPageSize', pageSize)
    setTimeout(()=> params.api.sizeColumnsToFit({ defaultMinWidth: 100 }), 0)
  }, [localRows, pageSize])

  const onCellValueChanged = useCallback((e: CellValueChangedEvent)=>{
    // Simple validation: ensure not null for edited cells
    if(e.newValue === null || e.newValue === undefined || (typeof e.newValue === 'string' && e.newValue.trim() === '')){
      e.node.setDataValue(e.colDef.field!, e.oldValue)
      if(api){ api.showLoadingOverlay(); setTimeout(()=> api.hideOverlay(), 300) }
      alert('Value required')
    }
  }, [api])

  const exportCsv = useCallback(()=>{ api?.exportDataAsCsv({ fileName: (title||'data') + '.csv' }) }, [api, title])
  const exportExcel = useCallback(()=>{ (api as any)?.exportDataAsExcel?.({ fileName: (title||'data') + '.xlsx' }) }, [api, title])

  const handleSave = useCallback(async()=>{
    if(!onSave || !api) return
    const data: any[] = []
    api.forEachNode((node)=>{ if(node?.data) data.push(node.data) })
    await onSave(data)
  }, [onSave, api])

  const handleFetchMore = useCallback(async()=>{
    if(!onFetchMore) return
    const res = await onFetchMore()
    const more = Array.isArray(res) ? res : (res?.data || [])
    if(more.length){
      const next = [...localRows, ...more]
      setLocalRows(next)
      api?.setGridOption('rowData', next)
    }
  }, [onFetchMore, localRows, api])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Data preview grid with pagination and export controls.</DialogDescription>
          <div className="flex items-center gap-2">
            <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=> api?.paginationGoToPreviousPage()}>Prev</button>
            <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=> api?.paginationGoToNextPage()}>Next</button>
            <select className="border border-gray-300 rounded px-2 py-1 text-xs" defaultValue={String(pageSize)} onChange={(e)=> api?.setGridOption('paginationPageSize', Number(e.target.value))}>
              {[25,50,100,200,500].map(n=> <option key={n} value={n}>{n}/page</option>)}
            </select>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=> api?.sizeColumnsToFit({ defaultMinWidth: 100 })}>Fit</button>
            <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={exportCsv}>CSV</button>
            {(api as any)?.exportDataAsExcel && (
              <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={exportExcel}>Excel</button>
            )}
            {onFetchMore && (
              <button className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={handleFetchMore}>Load more</button>
            )}
            {onSave && (
              <button className="rounded bg-green-600 text-white px-2 py-1 text-xs hover:bg-green-700" onClick={handleSave}>Save as change</button>
            )}
            <DialogClose asChild>
              <button className="rounded bg-primary text-white px-2 py-1 text-xs">Close</button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="ag-theme-quartz" style={{ height: 'calc(85vh - 48px)' }}>
          <AgGridReact
            ref={gridRef as any}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            rowData={localRows}
            rowSelection={{ mode: 'multiRow' } as any}
            animateRows
            pagination
            onGridReady={onGridReady as any}
            onCellValueChanged={onCellValueChanged}
            enableCellTextSelection
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
