/**
 * AgGridTable - Legacy wrapper around the new DataTable component
 * 
 * This component maintains backward compatibility while delegating to DataTable.
 * For new implementations, use DataTable directly from '@/components/DataTable'
 */

import { DataTable, EditedCell as DataTableEditedCell } from './DataTable'

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
    deletedRowIds?: Set<number>
    className?: string
    style?: React.CSSProperties
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
    deletedRowIds: externalDeletedRowIds,
    className = '',
    style
}: Props) {
    return (
        <DataTable
            rows={rows}
            columns={columns}
            title={title}
            pageSize={pageSize}
            allowEdit={allowEdit}
            compact={compact}
            invalidCells={invalidCells}
            invalidRows={invalidRows}
            editedCells={externalEditedCells}
            deletedRowIds={externalDeletedRowIds}
            className={className}
            style={style}
            onSave={onSave}
            showRowNumbers={false}
            allowSearch={!compact}
            allowFilter={!compact}
            allowColumnToggle={!compact}
            allowExport={!compact}
        />
    )
}
