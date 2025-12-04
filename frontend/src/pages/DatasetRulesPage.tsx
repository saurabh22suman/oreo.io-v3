import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { 
  getDataset, getDatasetSchemaTop, setDatasetSchemaTop, setDatasetRulesTop, 
  getProject, myProjectRole 
} from '../api'
import Alert from '../components/Alert'
import { 
  Check, Plus, Trash2, Save, ArrowLeft, Loader2, Shield, Database, 
  AlertCircle, Info, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  Lock, Unlock, Hash, Type, Calendar, ToggleRight, Binary, ALargeSmall,
  Regex, ListChecks, ArrowUpDown, Eye, EyeOff
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type DataType = 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'datetime' | 'timestamp'

type ColumnSchema = {
  name: string
  type: DataType
  originalName: string
  isNew?: boolean // Flag for newly added columns
}

type Severity = 'info' | 'warning' | 'error' | 'fatal'

type ValidationRuleType = 
  | 'none'
  | 'required'
  | 'unique'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'equals'
  | 'not_equals'
  | 'in_set'
  | 'not_in_set'
  | 'regex'
  | 'min_length'
  | 'max_length'
  | 'not_null'

type ColumnRule = {
  name: string
  required: boolean
  editable: boolean
  unique: boolean
  rules: ValidationRule[]
}

type ValidationRule = {
  id: string
  type: ValidationRuleType
  value?: any
  value2?: any // For 'between'
  values?: string[] // For 'in_set', 'not_in_set'
  severity: Severity
}

// ============================================================================
// Constants
// ============================================================================

const DATA_TYPES: { value: DataType; label: string; icon: any }[] = [
  { value: 'string', label: 'String', icon: ALargeSmall },
  { value: 'integer', label: 'Integer', icon: Binary },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'boolean', label: 'Boolean', icon: ToggleRight },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'datetime', label: 'DateTime', icon: Calendar },
  { value: 'timestamp', label: 'Timestamp', icon: Calendar },
]

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string; icon: any }[] = [
  { value: 'info', label: 'Info', color: 'text-info bg-info/10 border-info/20', icon: Info },
  { value: 'warning', label: 'Warning', color: 'text-warning bg-warning/10 border-warning/20', icon: AlertTriangle },
  { value: 'error', label: 'Error', color: 'text-danger bg-danger/10 border-danger/20', icon: AlertCircle },
  { value: 'fatal', label: 'Fatal', color: 'text-red-600 bg-red-600/10 border-red-600/20', icon: XCircle },
]

// Validation rules available per data type
const NUMERIC_RULES: { value: ValidationRuleType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'in_set', label: 'In Set' },
  { value: 'not_in_set', label: 'Not In Set' },
]

const STRING_RULES: { value: ValidationRuleType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'in_set', label: 'In Set' },
  { value: 'not_in_set', label: 'Not In Set' },
  { value: 'regex', label: 'Regex Pattern' },
  { value: 'min_length', label: 'Min Length' },
  { value: 'max_length', label: 'Max Length' },
]

const BOOLEAN_RULES: { value: ValidationRuleType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'equals', label: 'Must Be' },
]

const DATE_RULES: { value: ValidationRuleType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'greater_than', label: 'After' },
  { value: 'less_than', label: 'Before' },
  { value: 'between', label: 'Between' },
]

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function getValidationRulesForType(type: DataType): { value: ValidationRuleType; label: string }[] {
  switch (type) {
    case 'integer':
    case 'number':
      return NUMERIC_RULES
    case 'string':
      return STRING_RULES
    case 'boolean':
      return BOOLEAN_RULES
    case 'date':
    case 'datetime':
    case 'timestamp':
      return DATE_RULES
    default:
      return [{ value: 'none', label: 'None' }]
  }
}

function getTypeIcon(type: DataType) {
  const found = DATA_TYPES.find(t => t.value === type)
  return found?.icon || Type
}

// ============================================================================
// Sub-Components
// ============================================================================

function SeverityBadge({ severity }: { severity: Severity }) {
  const opt = SEVERITY_OPTIONS.find(s => s.value === severity) || SEVERITY_OPTIONS[0]
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${opt.color}`}>
      <Icon className="w-3 h-3" />
      {opt.label}
    </span>
  )
}

function ValidationRuleEditor({
  rule,
  columnType,
  onChange,
  onRemove,
  disabled,
}: {
  rule: ValidationRule
  columnType: DataType
  onChange: (rule: ValidationRule) => void
  onRemove: () => void
  disabled: boolean
}) {
  const availableRules = getValidationRulesForType(columnType)
  const isNumeric = columnType === 'integer' || columnType === 'number'
  const isString = columnType === 'string'
  const isDate = columnType === 'date' || columnType === 'datetime' || columnType === 'timestamp'
  const isBoolean = columnType === 'boolean'

  return (
    <div className="flex items-start gap-3 p-3 bg-surface-2/50 rounded-xl border border-divider">
      {/* Rule Type */}
      <div className="flex-1 min-w-[140px]">
        <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Rule Type</label>
        <select
          value={rule.type}
          onChange={(e) => onChange({ ...rule, type: e.target.value as ValidationRuleType, value: undefined, value2: undefined, values: undefined })}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
        >
          {availableRules.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Value Input(s) */}
      {rule.type !== 'none' && (
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">
            {rule.type === 'between' ? 'Range' : rule.type === 'in_set' || rule.type === 'not_in_set' ? 'Values (comma separated)' : 'Value'}
          </label>
          {rule.type === 'between' ? (
            <div className="flex items-center gap-2">
              <input
                type={isDate ? 'date' : 'number'}
                placeholder="Min"
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: e.target.value })}
                disabled={disabled}
                className="flex-1 px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
              />
              <span className="text-text-muted">–</span>
              <input
                type={isDate ? 'date' : 'number'}
                placeholder="Max"
                value={rule.value2 || ''}
                onChange={(e) => onChange({ ...rule, value2: e.target.value })}
                disabled={disabled}
                className="flex-1 px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
              />
            </div>
          ) : rule.type === 'in_set' || rule.type === 'not_in_set' ? (
            <input
              type="text"
              placeholder="value1, value2, value3"
              value={rule.values?.join(', ') || ''}
              onChange={(e) => onChange({ ...rule, values: e.target.value.split(',').map(v => v.trim()).filter(v => v) })}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            />
          ) : rule.type === 'regex' ? (
            <div className="flex items-center gap-2">
              <Regex className="w-4 h-4 text-text-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="^[a-zA-Z]+$"
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: e.target.value })}
                disabled={disabled}
                className="flex-1 px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
              />
            </div>
          ) : isBoolean ? (
            <select
              value={rule.value || ''}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            >
              <option value="">Select...</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              type={isNumeric ? 'number' : isDate ? 'date' : 'text'}
              placeholder="Enter value"
              value={rule.value || ''}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            />
          )}
        </div>
      )}

      {/* Severity */}
      {rule.type !== 'none' && (
        <div className="w-32">
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Severity</label>
          <select
            value={rule.severity}
            onChange={(e) => onChange({ ...rule, severity: e.target.value as Severity })}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg border border-divider bg-surface-1 text-text text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
          >
            {SEVERITY_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Remove Button */}
      {!disabled && (
        <button
          onClick={onRemove}
          className="mt-6 p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
          title="Remove rule"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function ColumnRuleCard({
  column,
  rule,
  onChange,
  disabled,
  expanded,
  onToggleExpand,
}: {
  column: ColumnSchema
  rule: ColumnRule
  onChange: (rule: ColumnRule) => void
  disabled: boolean
  expanded: boolean
  onToggleExpand: () => void
}) {
  const TypeIcon = getTypeIcon(column.type)
  const activeRulesCount = rule.rules.filter(r => r.type !== 'none').length + 
    (rule.required ? 1 : 0) + (rule.unique ? 1 : 0) + (!rule.editable ? 1 : 0)

  const addRule = () => {
    onChange({
      ...rule,
      rules: [...rule.rules, { id: generateId(), type: 'none', severity: 'error' }]
    })
  }

  const updateRule = (index: number, updatedRule: ValidationRule) => {
    const newRules = [...rule.rules]
    newRules[index] = updatedRule
    onChange({ ...rule, rules: newRules })
  }

  const removeRule = (index: number) => {
    onChange({ ...rule, rules: rule.rules.filter((_, i) => i !== index) })
  }

  return (
    <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-2">
            <TypeIcon className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text">{column.name}</span>
              {column.isNew && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success border border-success/20">
                  NEW
                </span>
              )}
            </div>
            <span className="text-xs text-text-muted">{column.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeRulesCount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {activeRulesCount} rule{activeRulesCount !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-divider pt-4">
          {/* Quick Toggles */}
          <div className="flex flex-wrap gap-4">
            {/* Required */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <button
                type="button"
                onClick={() => !disabled && onChange({ ...rule, required: !rule.required })}
                disabled={disabled}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  rule.required 
                    ? 'bg-primary border-primary text-white' 
                    : 'border-divider bg-surface-1 group-hover:border-primary/50'
                } disabled:opacity-50`}
              >
                {rule.required && <Check className="w-3 h-3" />}
              </button>
              <span className="text-sm text-text">Required</span>
              <span className="text-xs text-text-muted">(not null)</span>
            </label>

            {/* Unique */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <button
                type="button"
                onClick={() => !disabled && onChange({ ...rule, unique: !rule.unique })}
                disabled={disabled}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  rule.unique 
                    ? 'bg-primary border-primary text-white' 
                    : 'border-divider bg-surface-1 group-hover:border-primary/50'
                } disabled:opacity-50`}
              >
                {rule.unique && <Check className="w-3 h-3" />}
              </button>
              <span className="text-sm text-text">Unique</span>
              <span className="text-xs text-text-muted">(no duplicates)</span>
            </label>

            {/* Editable */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <button
                type="button"
                onClick={() => !disabled && onChange({ ...rule, editable: !rule.editable })}
                disabled={disabled}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  rule.editable 
                    ? 'bg-primary border-primary text-white' 
                    : 'border-divider bg-surface-1 group-hover:border-primary/50'
                } disabled:opacity-50`}
              >
                {rule.editable && <Check className="w-3 h-3" />}
              </button>
              <span className="text-sm text-text flex items-center gap-1">
                {rule.editable ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                Editable
              </span>
              <span className="text-xs text-text-muted">(in live edit)</span>
            </label>
          </div>

          {/* Validation Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">Validation Rules</span>
              {!disabled && (
                <button
                  onClick={addRule}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Rule
                </button>
              )}
            </div>

            {rule.rules.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No validation rules defined</p>
            ) : (
              <div className="space-y-2">
                {rule.rules.map((r, idx) => (
                  <ValidationRuleEditor
                    key={r.id}
                    rule={r}
                    columnType={column.type}
                    onChange={(updated) => updateRule(idx, updated)}
                    onRemove={() => removeRule(idx)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export default function DatasetRulesPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()

  // State
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Schema state
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<DataType>('string')
  const [showAddColumn, setShowAddColumn] = useState(false)

  // Rules state
  const [columnRules, setColumnRules] = useState<ColumnRule[]>([])
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())

  // Active tab
  const [activeTab, setActiveTab] = useState<'schema' | 'rules'>('schema')

  // Derived state
  const isOwner = role === 'owner'
  const canEdit = isOwner

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [proj, ds, roleRes] = await Promise.all([
          getProject(projectId),
          getDataset(projectId, dsId),
          myProjectRole(projectId).catch(() => ({ role: null }))
        ])
        
        setProject(proj)
        setDataset(ds)
        setRole(roleRes.role as any)

        // Load schema
        const schemaRes = await getDatasetSchemaTop(dsId)
        if (schemaRes?.schema) {
          const schemaObj = typeof schemaRes.schema === 'string' ? JSON.parse(schemaRes.schema) : schemaRes.schema
          
          if (schemaObj.properties) {
            const cols: ColumnSchema[] = Object.keys(schemaObj.properties).map(key => ({
              name: key,
              originalName: schemaObj.properties[key].originalName || key,
              type: schemaObj.properties[key].type || 'string',
              isNew: false
            }))
            setColumns(cols)

            // Parse existing rules
            const existingRules = ds.rules ? (typeof ds.rules === 'string' ? JSON.parse(ds.rules) : ds.rules) : []
            
            // Build rules for each column
            const rules: ColumnRule[] = cols.map(col => {
              // Find required rule
              const requiredRule = existingRules.find((r: any) => r.type === 'required' && r.columns?.includes(col.name))
              const isRequired = !!requiredRule

              // Find readonly rule
              const readonlyRule = existingRules.find((r: any) => r.type === 'readonly' && r.columns?.includes(col.name))
              const isEditable = !readonlyRule

              // Find unique rule
              const uniqueRule = existingRules.find((r: any) => r.type === 'unique' && r.column === col.name)
              const isUnique = !!uniqueRule

              // Find validation rules for this column
              const validationRules: ValidationRule[] = existingRules
                .filter((r: any) => r.column === col.name && !['required', 'readonly', 'unique'].includes(r.type))
                .map((r: any) => ({
                  id: generateId(),
                  type: r.type as ValidationRuleType,
                  value: r.value ?? r.min,
                  value2: r.max,
                  values: r.values,
                  severity: r.severity || 'error'
                }))

              return {
                name: col.originalName,
                required: isRequired,
                editable: isEditable,
                unique: isUnique,
                rules: validationRules.length > 0 ? validationRules : []
              }
            })

            setColumnRules(rules)
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load dataset')
      } finally {
        setLoading(false)
      }
    })()
  }, [projectId, dsId])

  // Add new column
  const handleAddColumn = () => {
    if (!newColumnName.trim()) return
    
    // Check for duplicate names
    if (columns.some(c => c.name.toLowerCase() === newColumnName.trim().toLowerCase())) {
      setError('Column name already exists')
      return
    }

    const newCol: ColumnSchema = {
      name: newColumnName.trim(),
      originalName: newColumnName.trim(),
      type: newColumnType,
      isNew: true
    }

    setColumns([...columns, newCol])
    setColumnRules([...columnRules, {
      name: newCol.name,
      required: true,
      editable: true,
      unique: false,
      rules: []
    }])

    setNewColumnName('')
    setNewColumnType('string')
    setShowAddColumn(false)
    setToast('Column added. Remember to save changes.')
  }

  // Remove new column (only for newly added columns)
  const handleRemoveColumn = (columnName: string) => {
    const col = columns.find(c => c.name === columnName)
    if (!col?.isNew) return // Can only remove new columns

    setColumns(columns.filter(c => c.name !== columnName))
    setColumnRules(columnRules.filter(r => r.name !== columnName))
  }

  // Update column rule
  const updateColumnRule = (name: string, rule: ColumnRule) => {
    setColumnRules(columnRules.map(r => r.name === name ? rule : r))
  }

  // Toggle expanded column
  const toggleExpanded = (name: string) => {
    const newExpanded = new Set(expandedColumns)
    if (newExpanded.has(name)) {
      newExpanded.delete(name)
    } else {
      newExpanded.add(name)
    }
    setExpandedColumns(newExpanded)
  }

  // Save all changes
  const handleSaveAll = async () => {
    if (!canEdit) return
    setError('')
    setToast('')
    setSaving(true)

    try {
      // Build schema object
      const properties: any = {}
      const requiredFields: string[] = []

      columns.forEach(col => {
        properties[col.name] = { 
          type: col.type, 
          originalName: col.originalName 
        }
        const rule = columnRules.find(r => r.name === col.originalName || r.name === col.name)
        if (rule?.required) requiredFields.push(col.name)
      })

      const schemaObj = {
        type: 'object',
        properties,
        ...(requiredFields.length > 0 && { required: requiredFields })
      }

      // Build rules array
      const rules: any[] = []

      // Required fields rule
      const requiredCols = columnRules.filter(r => r.required).map(r => {
        const col = columns.find(c => c.originalName === r.name || c.name === r.name)
        return col?.name || r.name
      })
      if (requiredCols.length > 0) {
        rules.push({ type: 'required', columns: requiredCols })
      }

      // Process each column's rules
      columnRules.forEach(colRule => {
        const col = columns.find(c => c.originalName === colRule.name || c.name === colRule.name)
        const columnName = col?.name || colRule.name

        // Unique rule
        if (colRule.unique) {
          rules.push({ type: 'unique', column: columnName, severity: 'error' })
        }

        // Readonly rule
        if (!colRule.editable) {
          rules.push({ type: 'readonly', columns: [columnName] })
        }

        // Validation rules
        colRule.rules.forEach(rule => {
          if (rule.type === 'none') return

          const ruleObj: any = {
            type: rule.type,
            column: columnName,
            severity: rule.severity
          }

          if (rule.type === 'between') {
            ruleObj.min = rule.value
            ruleObj.max = rule.value2
          } else if (rule.type === 'in_set' || rule.type === 'not_in_set') {
            ruleObj.values = rule.values
          } else if (rule.value !== undefined) {
            ruleObj.value = rule.value
          }

          rules.push(ruleObj)
        })
      })

      // Save schema and rules
      await setDatasetSchemaTop(dsId, schemaObj)
      await setDatasetRulesTop(dsId, rules)

      // Update columns to mark new ones as no longer new
      setColumns(columns.map(c => ({ ...c, isNew: false })))

      setToast('Changes saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Count active rules
  const totalRulesCount = useMemo(() => {
    return columnRules.reduce((acc, r) => {
      return acc + r.rules.filter(rule => rule.type !== 'none').length +
        (r.required ? 1 : 0) + (r.unique ? 1 : 0) + (!r.editable ? 1 : 0)
    }, 0)
  }, [columnRules])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text animate-fade-in">
      {/* Header */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to={`/projects/${projectId}/labs?dataset=${dsId}`}
                className="p-2 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary" />
                  <h1 className="text-2xl font-bold text-text">Rules & Schema</h1>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                    Beta
                  </span>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                  {dataset?.name} • {columns.length} columns • {totalRulesCount} rules
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!canEdit && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-divider text-sm text-text-muted">
                  <Eye className="w-4 h-4" />
                  View Only
                </span>
              )}
              {canEdit && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save All Changes
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 p-1 bg-surface-2/50 rounded-xl w-fit border border-divider/50">
            <button
              onClick={() => setActiveTab('schema')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'schema'
                  ? 'bg-surface-1 text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-1/50'
              }`}
            >
              <Database className="w-4 h-4" />
              Schema
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-text-muted">
                {columns.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'rules'
                  ? 'bg-surface-1 text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text hover:bg-surface-1/50'
              }`}
            >
              <Shield className="w-4 h-4" />
              Business Rules
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-text-muted">
                {totalRulesCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="px-6 pt-4 space-y-2">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss />}
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Schema Tab */}
        {activeTab === 'schema' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-info/5 border border-info/20">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text mb-1">Schema Configuration</p>
                <p>You can add new columns to extend the schema. Existing columns cannot be removed to preserve data integrity. To change data types, contact your administrator.</p>
              </div>
            </div>

            {/* Columns List */}
            <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden">
              <div className="px-5 py-4 border-b border-divider bg-surface-2/30 flex items-center justify-between">
                <h2 className="font-semibold text-text">Columns</h2>
                {canEdit && (
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Column
                  </button>
                )}
              </div>

              {/* Add Column Form */}
              {showAddColumn && canEdit && (
                <div className="px-5 py-4 border-b border-divider bg-surface-2/50">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Column Name</label>
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="Enter column name"
                        className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        autoFocus
                      />
                    </div>
                    <div className="w-48">
                      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">Data Type</label>
                      <select
                        value={newColumnType}
                        onChange={(e) => setNewColumnType(e.target.value as DataType)}
                        className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-1 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      >
                        {DATA_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddColumn}
                      disabled={!newColumnName.trim()}
                      className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowAddColumn(false); setNewColumnName(''); }}
                      className="px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-2/30 border-b border-divider">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Column</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                      {canEdit && <th className="px-5 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {columns.map((col) => {
                      const TypeIcon = getTypeIcon(col.type)
                      const rule = columnRules.find(r => r.name === col.originalName || r.name === col.name)
                      
                      return (
                        <tr key={col.name} className="hover:bg-surface-2/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-surface-2">
                                <TypeIcon className="w-4 h-4 text-text-muted" />
                              </div>
                              <div>
                                <span className="font-medium text-text">{col.name}</span>
                                {col.originalName !== col.name && (
                                  <span className="text-xs text-text-muted ml-2">(was: {col.originalName})</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 rounded-lg bg-surface-2 text-sm text-text-secondary">
                              {col.type}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {col.isNew ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success border border-success/20">
                                  New
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-3 text-text-muted">
                                  Existing
                                </span>
                              )}
                              {rule?.required && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                  Required
                                </span>
                              )}
                              {rule?.unique && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                                  Unique
                                </span>
                              )}
                            </div>
                          </td>
                          {canEdit && (
                            <td className="px-5 py-4 text-right">
                              {col.isNew && (
                                <button
                                  onClick={() => handleRemoveColumn(col.name)}
                                  className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                  title="Remove column"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-info/5 border border-info/20">
              <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text mb-1">Business Rules</p>
                <p>Configure validation rules for each column. Rules are enforced during data uploads, live editing, and change request approvals.</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {SEVERITY_OPTIONS.map(s => (
                    <SeverityBadge key={s.value} severity={s.value} />
                  ))}
                </div>
              </div>
            </div>

            {/* Rules by Column */}
            <div className="space-y-3">
              {columns.map(col => {
                const rule = columnRules.find(r => r.name === col.originalName || r.name === col.name)
                if (!rule) return null

                return (
                  <ColumnRuleCard
                    key={col.name}
                    column={col}
                    rule={rule}
                    onChange={(r) => updateColumnRule(rule.name, r)}
                    disabled={!canEdit}
                    expanded={expandedColumns.has(col.name)}
                    onToggleExpand={() => toggleExpanded(col.name)}
                  />
                )
              })}
            </div>

            {/* Expand All / Collapse All */}
            {columns.length > 0 && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setExpandedColumns(new Set(columns.map(c => c.name)))}
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Expand All
                </button>
                <span className="text-text-muted">•</span>
                <button
                  onClick={() => setExpandedColumns(new Set())}
                  className="text-sm text-text-muted hover:text-text transition-colors"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
