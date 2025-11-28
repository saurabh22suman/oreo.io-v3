import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getDatasetSchemaTop, setDatasetRulesTop, setDatasetSchemaTop, getProject, myProjectRole, finalizeDataset, deleteStagedUpload } from '../api'
import Alert from '../components/Alert'
import { Check, X, Edit2, Save } from 'lucide-react'

type ColumnSchema = {
  name: string
  type: string
  originalName: string
}

type ColumnRule = {
  name: string
  required: boolean
  editable: boolean
  validationType?: 'between' | 'greater_than' | 'less_than' | 'equals' | 'none'
  validationValue?: any
  validationValue2?: any // For 'between'
}

const DATA_TYPES = ['string', 'integer', 'number', 'boolean', 'date', 'datetime', 'timestamp']
const VALIDATION_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'equals', label: 'Equals' },
]

export default function DatasetSchemaRulesPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = datasetId === 'new' ? 0 : Number(datasetId)
  const nav = useNavigate()
  const location = useLocation()
  
  // Check if we're in staging mode (creating new dataset)
  const stagingState = location.state as {
    stagingId?: string
    filename?: string
    rowCount?: number
    schema?: any
    name?: string
    targetSchema?: string
    table?: string
    source?: string
  } | null
  const isStagingMode = !!stagingState?.stagingId
  
  const [project, setProject] = useState<any>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'schema' | 'rules'>('schema')

  // Schema state
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [editingColumn, setEditingColumn] = useState<string | null>(null)

  // Rules state
  const [columnRules, setColumnRules] = useState<ColumnRule[]>([])

  const [loading, setLoading] = useState(true)

  // Cleanup staging on unmount if user leaves without creating
  useEffect(() => {
    return () => {
      // If user navigates away from staging mode without creating, cleanup
      // This is a best-effort cleanup; the server also has auto-cleanup
    }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        
        // If in staging mode, use the schema from state
        if (isStagingMode && stagingState?.schema) {
          const schemaObj = stagingState.schema
          if (schemaObj.properties) {
            const cols: ColumnSchema[] = Object.keys(schemaObj.properties).map(key => ({
              name: key,
              originalName: key,
              type: schemaObj.properties[key].type || 'string'
            }))
            setColumns(cols)
            const rules: ColumnRule[] = cols.map(col => ({
              name: col.name,
              required: true,  // Default all columns to required
              editable: true,
              validationType: 'none'
            }))
            setColumnRules(rules)
          }
          setLoading(false)
          try { const r = await myProjectRole(projectId); setRole(r.role) } catch { setRole(null) }
          return
        }
        
        // Normal mode - fetch schema from existing dataset
        const s = await getDatasetSchemaTop(dsId)

        if (s?.schema) {
          const schemaObj = typeof s.schema === 'string' ? JSON.parse(s.schema) : s.schema

          // Extract columns from schema
          if (schemaObj.properties) {
            const cols: ColumnSchema[] = Object.keys(schemaObj.properties).map(key => {
              const prop = schemaObj.properties[key]
              return {
                name: key,
                // Use stored originalName if available, otherwise use the key itself
                originalName: prop.originalName || key,
                type: prop.type || 'string'
              }
            })
            setColumns(cols)

            // Initialize rules for each column
            const rules: ColumnRule[] = cols.map(col => ({
              name: col.originalName, // Use originalName for rule matching
              required: schemaObj.required?.includes(col.name) || false,
              editable: true,
              validationType: 'none'
            }))
            setColumnRules(rules)
          }
          setLoading(false)
        } else {
          // Poll for schema inference
          let attempts = 0
          const maxAttempts = 20
          setToast('Inferring schema...')
          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000))
            attempts++
            try {
              const s2 = await getDatasetSchemaTop(dsId)
              if (s2?.schema) {
                const schemaObj = typeof s2.schema === 'string' ? JSON.parse(s2.schema) : s2.schema
                if (schemaObj.properties) {
                  const cols: ColumnSchema[] = Object.keys(schemaObj.properties).map(key => ({
                    name: key,
                    originalName: key,
                    type: schemaObj.properties[key].type || 'string'
                  }))
                  setColumns(cols)
                  const rules: ColumnRule[] = cols.map(col => ({
                    name: col.name,
                    required: true,  // Default all columns to required
                    editable: true,
                    validationType: 'none'
                  }))
                  setColumnRules(rules)
                }
                setToast('')
                setLoading(false)
                break
              }
            } catch (e: any) { /* ignore interim errors */ }
          }
          if (loading) { setToast(''); setLoading(false) }
        }
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { setRole(null) }
      } catch (e: any) { setError(e.message); setLoading(false) }
    })()
  }, [projectId, dsId, isStagingMode])

  const handleSaveSchema = async () => {
    try {
      const properties: any = {}
      const requiredFields: string[] = []
      const columnMappings: Record<string, string> = {} // originalName -> displayName

      columns.forEach(col => {
        properties[col.name] = { type: col.type, originalName: col.originalName }
        // Track column mappings for display purposes
        if (col.name !== col.originalName) {
          columnMappings[col.originalName] = col.name
        }
        const rule = columnRules.find(r => r.name === col.originalName)
        if (rule?.required) requiredFields.push(col.name)
      })

      const schemaObj = {
        type: 'object',
        properties,
        ...(requiredFields.length > 0 && { required: requiredFields }),
        ...(Object.keys(columnMappings).length > 0 && { columnMappings })
      }

      await setDatasetSchemaTop(dsId, schemaObj)
      setToast('Schema saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save schema')
    }
  }

  const handleSaveRules = async () => {
    // In staging mode, rules are saved when creating the dataset
    if (isStagingMode || !datasetId || datasetId === 'new') {
      setToast('Rules will be saved when you create the dataset')
      return
    }

    try {
      const rules: any[] = []

      // Required fields
      const requiredCols = columnRules.filter(r => r.required).map(r => r.name)
      if (requiredCols.length > 0) {
        rules.push({ type: 'required', columns: requiredCols })
      }

      // Validation rules
      columnRules.forEach(rule => {
        if (rule.validationType && rule.validationType !== 'none') {
          const ruleObj: any = {
            type: rule.validationType,
            column: rule.name
          }

          if (rule.validationType === 'between') {
            ruleObj.min = rule.validationValue
            ruleObj.max = rule.validationValue2
          } else {
            ruleObj.value = rule.validationValue
          }

          rules.push(ruleObj)
        }

        if (!rule.editable) {
          rules.push({ type: 'readonly', columns: [rule.name] })
        }
      })

      await setDatasetRulesTop(dsId, rules)
      setToast('Rules saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save rules')
    }
  }

  const handleCreateDataset = async () => {
    if (role === 'viewer') return
    setError('')
    setToast('')
    setCreating(true)
    try {
      // Build schema object
      const properties: any = {}
      const requiredFields: string[] = []
      const columnMappings: Record<string, string> = {}

      columns.forEach(col => {
        properties[col.name] = { type: col.type, originalName: col.originalName }
        if (col.name !== col.originalName) {
          columnMappings[col.originalName] = col.name
        }
        const rule = columnRules.find(r => r.name === col.originalName)
        if (rule?.required) requiredFields.push(col.name)
      })

      const schemaObj = {
        type: 'object',
        properties,
        ...(requiredFields.length > 0 && { required: requiredFields }),
        ...(Object.keys(columnMappings).length > 0 && { columnMappings })
      }

      if (isStagingMode && stagingState) {
        // Finalize staging - create the actual dataset
        const result = await finalizeDataset({
          project_id: projectId,
          staging_id: stagingState.stagingId!,
          name: stagingState.name || 'Untitled Dataset',
          schema: JSON.stringify(schemaObj),
          table: stagingState.table || '',
          target_schema: stagingState.targetSchema || 'public',
          source: stagingState.source || 'local'
        })
        
        // Save rules to the new dataset
        const newDatasetId = result.id
        try {
          const rules: any[] = []
          const requiredCols = columnRules.filter(r => r.required).map(r => r.name)
          if (requiredCols.length > 0) {
            rules.push({ type: 'required', columns: requiredCols })
          }
          columnRules.forEach(rule => {
            if (rule.validationType && rule.validationType !== 'none') {
              const ruleObj: any = { type: rule.validationType, column: rule.name }
              if (rule.validationType === 'between') {
                ruleObj.min = rule.validationValue
                ruleObj.max = rule.validationValue2
              } else {
                ruleObj.value = rule.validationValue
              }
              rules.push(ruleObj)
            }
            if (!rule.editable) {
              rules.push({ type: 'readonly', columns: [rule.name] })
            }
          })
          await setDatasetRulesTop(newDatasetId, rules)
        } catch (e) {
          console.warn('Failed to save rules:', e)
        }
        
        try { window.dispatchEvent(new CustomEvent('dataset:created', { detail: { projectId, datasetId: newDatasetId } })) } catch (e) { }
        setToast('Dataset created successfully')
        setTimeout(() => nav(`/projects/${projectId}/datasets/${newDatasetId}`), 1000)
      } else {
        // Normal mode - save schema and rules to existing dataset
        await handleSaveSchema()
        await handleSaveRules()
        setToast('Schema and rules saved successfully')
        setTimeout(() => nav(`/projects/${projectId}/datasets/${dsId}`), 1000)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create dataset')
    } finally {
      setCreating(false)
    }
  }

  // Cancel staging and cleanup
  const handleCancel = async () => {
    if (isStagingMode && stagingState?.stagingId) {
      try {
        await deleteStagedUpload(stagingState.stagingId)
      } catch (e) {
        console.warn('Failed to cleanup staging:', e)
      }
    }
    nav(`/projects/${projectId}`)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--divider)] border-t-[var(--primary)]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            {isStagingMode ? 'Configure Schema & Rules' : 'Schema & Rules'}
          </h1>
          {isStagingMode && stagingState?.name && (
            <p className="text-[var(--text-secondary)] mt-1">
              Dataset: <span className="font-medium text-[var(--text)]">{stagingState.name}</span>
              {stagingState.rowCount !== undefined && (
                <span className="ml-2">({stagingState.rowCount} rows)</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isStagingMode ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={role === 'viewer' || creating}
                className="btn-primary"
                onClick={handleCreateDataset}
              >
                {creating ? 'Creating…' : 'Create Dataset'}
              </button>
            </>
          ) : (
            <>
              <Link to={`/projects/${projectId}`} className="text-[var(--primary)] hover:underline text-sm">Back</Link>
              <button
                disabled={role === 'viewer' || creating}
                className="btn-primary"
                onClick={handleCreateDataset}
              >
                {creating ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      {/* Tabs */}
      <div className="border-b border-[var(--divider)] mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-3 px-1 border-b-2 transition-colors font-medium ${activeTab === 'schema'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
          >
            Schema Configuration
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-1 border-b-2 transition-colors font-medium ${activeTab === 'rules'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
          >
            Business Rules
          </button>
        </div>
      </div>

      {/* Schema Tab */}
      {activeTab === 'schema' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg-page)]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Column Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Data Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {columns.map((col, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-page)] transition-colors">
                    <td className="px-6 py-4">
                      {editingColumn === col.originalName ? (
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => {
                            const newCols = [...columns]
                            newCols[idx].name = e.target.value
                            setColumns(newCols)
                          }}
                          className="input-compact"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-[var(--text)]">{col.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={col.type}
                        onChange={(e) => {
                          const newCols = [...columns]
                          newCols[idx].type = e.target.value
                          setColumns(newCols)
                        }}
                        className="input-compact"
                        disabled={role === 'viewer'}
                      >
                        {DATA_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {editingColumn === col.originalName ? (
                        <button
                          onClick={() => setEditingColumn(null)}
                          className="text-[var(--primary)] hover:text-[var(--primary-hover)] inline-flex items-center gap-1 text-sm"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingColumn(col.originalName)}
                          className="text-[var(--text-secondary)] hover:text-[var(--primary)] inline-flex items-center gap-1 text-sm"
                          disabled={role === 'viewer'}
                        >
                          <Edit2 className="h-4 w-4" />
                          Rename
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[var(--bg-page)] border-t border-[var(--divider)] flex justify-end">
            <button
              onClick={handleSaveSchema}
              disabled={role === 'viewer'}
              className="btn-primary"
            >
              Save Schema
            </button>
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg-page)]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Column</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Required</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Editable</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Validation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Value(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {columnRules.map((rule, idx) => {
                  const colType = columns.find(c => c.originalName === rule.name)?.type
                  const isNumeric = colType === 'integer' || colType === 'number'

                  return (
                    <tr key={idx} className="hover:bg-[var(--bg-page)] transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-[var(--text)]">{rule.name}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            const newRules = [...columnRules]
                            newRules[idx].required = !newRules[idx].required
                            setColumnRules(newRules)
                          }}
                          disabled={role === 'viewer'}
                          className={`h-5 w-5 rounded border transition-colors ${rule.required
                              ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'border-[var(--text-muted)] hover:border-[var(--primary)]'
                            }`}
                        >
                          {rule.required && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            const newRules = [...columnRules]
                            newRules[idx].editable = !newRules[idx].editable
                            setColumnRules(newRules)
                          }}
                          disabled={role === 'viewer'}
                          className={`h-5 w-5 rounded border transition-colors ${rule.editable
                              ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'border-[var(--text-muted)] hover:border-[var(--primary)]'
                            }`}
                        >
                          {rule.editable && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={rule.validationType || 'none'}
                          onChange={(e) => {
                            const newRules = [...columnRules]
                            newRules[idx].validationType = e.target.value as any
                            setColumnRules(newRules)
                          }}
                          disabled={!isNumeric || role === 'viewer'}
                          className="input-compact"
                        >
                          {VALIDATION_TYPES.map(vt => (
                            <option key={vt.value} value={vt.value}>{vt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {rule.validationType === 'between' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Min"
                              value={rule.validationValue || ''}
                              onChange={(e) => {
                                const newRules = [...columnRules]
                                newRules[idx].validationValue = e.target.value
                                setColumnRules(newRules)
                              }}
                              className="input-compact w-24"
                              disabled={role === 'viewer'}
                            />
                            <span className="text-[var(--text-secondary)]">-</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={rule.validationValue2 || ''}
                              onChange={(e) => {
                                const newRules = [...columnRules]
                                newRules[idx].validationValue2 = e.target.value
                                setColumnRules(newRules)
                              }}
                              className="input-compact w-24"
                              disabled={role === 'viewer'}
                            />
                          </div>
                        ) : rule.validationType && rule.validationType !== 'none' ? (
                          <input
                            type="number"
                            placeholder="Value"
                            value={rule.validationValue || ''}
                            onChange={(e) => {
                              const newRules = [...columnRules]
                              newRules[idx].validationValue = e.target.value
                              setColumnRules(newRules)
                            }}
                            className="input-compact w-32"
                            disabled={role === 'viewer'}
                          />
                        ) : (
                          <span className="text-[var(--text-muted)] text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-[var(--bg-page)] border-t border-[var(--divider)] flex justify-end">
            {isStagingMode || !datasetId || datasetId === 'new' ? (
              <span className="text-sm text-[var(--text-muted)]">
                Rules will be saved when you click "Create Dataset"
              </span>
            ) : (
              <button
                onClick={handleSaveRules}
                disabled={role === 'viewer'}
                className="btn-primary"
              >
                Save Rules
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .input-compact {
          background-color: var(--bg-surface);
          border: 1px solid var(--text-muted);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 14px;
          color: var(--text);
          outline: none;
          transition: all 0.2s;
        }
        .input-compact:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.1);
        }
        .input-compact:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
