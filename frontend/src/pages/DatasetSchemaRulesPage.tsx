import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDatasetSchemaTop, setDatasetRulesTop, setDatasetSchemaTop, getProject, myProjectRole } from '../api'
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
  const dsId = Number(datasetId)
  const nav = useNavigate()
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

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        const s = await getDatasetSchemaTop(dsId)

        if (s?.schema) {
          const schemaObj = typeof s.schema === 'string' ? JSON.parse(s.schema) : s.schema

          // Extract columns from schema
          if (schemaObj.properties) {
            const cols: ColumnSchema[] = Object.keys(schemaObj.properties).map(key => ({
              name: key,
              originalName: key,
              type: schemaObj.properties[key].type || 'string'
            }))
            setColumns(cols)

            // Initialize rules for each column
            const rules: ColumnRule[] = cols.map(col => ({
              name: col.name,
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
                    required: false,
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
  }, [projectId, dsId])

  const handleSaveSchema = async () => {
    try {
      const properties: any = {}
      const requiredFields: string[] = []

      columns.forEach(col => {
        properties[col.name] = { type: col.type }
        const rule = columnRules.find(r => r.name === col.originalName)
        if (rule?.required) requiredFields.push(col.name)
      })

      const schemaObj = {
        type: 'object',
        properties,
        ...(requiredFields.length > 0 && { required: requiredFields })
      }

      await setDatasetSchemaTop(dsId, schemaObj)
      setToast('Schema saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save schema')
    }
  }

  const handleSaveRules = async () => {
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
      await handleSaveSchema()
      await handleSaveRules()
      setToast('Dataset created successfully')
      setTimeout(() => nav(`/projects/${projectId}/datasets/${dsId}`), 1000)
    } catch (e: any) {
      setError(e.message || 'Failed to create dataset')
    } finally {
      setCreating(false)
    }
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
        <h1 className="text-2xl font-bold text-[var(--text)]">Schema & Rules</h1>
        <div className="flex items-center gap-3">
          <Link to={`/projects/${projectId}`} className="text-[var(--primary)] hover:underline text-sm">Back</Link>
          <button
            disabled={role === 'viewer' || creating}
            className="btn-primary"
            onClick={handleCreateDataset}
          >
            {creating ? 'Creating…' : 'Create Dataset'}
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} />}

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
            <button
              onClick={handleSaveRules}
              disabled={role === 'viewer'}
              className="btn-primary"
            >
              Save Rules
            </button>
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
