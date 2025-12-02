/**
 * Theme Preview Page
 * 
 * A comprehensive showcase of all UI components in both light and dark modes.
 * Used for testing and validating the design system.
 */

import { useState } from 'react'
import { 
  Moon, Sun, Check, X, AlertTriangle, Info, 
  ArrowRight, ChevronDown, Search, Bell, Settings,
  User, Mail, Lock, Eye, EyeOff, Plus, Trash2,
  Edit3, Save, Download, Upload, Filter, MoreHorizontal,
  Table, Database, GitBranch, History, Shield
} from 'lucide-react'

export default function ThemePreviewPage() {
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark')
  })
  const [inputValue, setInputValue] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [checkboxValue, setCheckboxValue] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const toggleTheme = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    if (newMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text-primary p-8 transition-colors duration-300">
      {/* Sticky Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 bg-surface-2 border border-divider rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          <div className="relative w-5 h-5">
            <Sun 
              size={20} 
              className={`absolute inset-0 transition-all duration-300 text-warning ${darkMode ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`}
            />
            <Moon 
              size={20} 
              className={`absolute inset-0 transition-all duration-300 text-primary ${darkMode ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
            />
          </div>
          <span className="text-sm font-medium">{darkMode ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-16">
        {/* Header */}
        <header className="text-center space-y-4 pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            Design System Preview
          </div>
          <h1 className="text-display-lg font-bold">
            Oreo.io <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-glow">Theme Preview</span>
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            A comprehensive showcase of all UI components with the warm purple accent theme.
            Toggle between light and dark modes to see the full design system.
          </p>
        </header>

        {/* Color Palette */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Color Palette</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Brand Colors */}
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-semibold">Brand Colors</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-primary shadow-glow" />
                  <p className="text-xs text-text-muted text-center">Primary</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-primary-glow" />
                  <p className="text-xs text-text-muted text-center">Glow</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-gradient-to-r from-primary to-primary-glow" />
                  <p className="text-xs text-text-muted text-center">Gradient</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-primary-hover" />
                  <p className="text-xs text-text-muted text-center">Hover</p>
                </div>
              </div>
            </div>

            {/* Status Colors */}
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-semibold">Status Colors</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-success" />
                  <p className="text-xs text-text-muted text-center">Success</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-warning" />
                  <p className="text-xs text-text-muted text-center">Warning</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-danger" />
                  <p className="text-xs text-text-muted text-center">Danger</p>
                </div>
                <div className="space-y-2">
                  <div className="h-16 rounded-xl bg-info" />
                  <p className="text-xs text-text-muted text-center">Info</p>
                </div>
              </div>
            </div>

            {/* Surface Colors */}
            <div className="card p-6 space-y-4 md:col-span-2">
              <h3 className="text-lg font-semibold">Surface Hierarchy</h3>
              <div className="grid grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="space-y-2">
                    <div 
                      className={`h-20 rounded-xl border border-divider ${
                        level === 1 ? 'bg-surface-1' :
                        level === 2 ? 'bg-surface-2' :
                        level === 3 ? 'bg-surface-3' :
                        level === 4 ? 'bg-surface-4' :
                        'bg-surface-5'
                      }`} 
                    />
                    <p className="text-xs text-text-muted text-center">Surface {level}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Typography</h2>
          <div className="card p-6 space-y-6">
            <div className="space-y-4">
              <p className="text-display-xl font-bold">Display XL - 48px</p>
              <p className="text-display-lg font-bold">Display Large - 36px</p>
              <p className="text-headline-md font-semibold">Headline Medium - 28px</p>
              <p className="text-headline-sm font-semibold">Headline Small - 22px</p>
              <p className="text-body-md">Body Medium - 16px - The quick brown fox jumps over the lazy dog.</p>
              <p className="text-body-sm">Body Small - 14px - The quick brown fox jumps over the lazy dog.</p>
              <p className="text-xs text-text-muted">Caption - 12px - The quick brown fox jumps over the lazy dog.</p>
            </div>
            <div className="pt-4 border-t border-divider">
              <p className="text-text-secondary">Secondary text color for supporting content</p>
              <p className="text-text-muted">Muted text color for less important information</p>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Buttons</h2>
          <div className="card p-6 space-y-6">
            {/* Primary Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Primary</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary">
                  <Plus size={16} /> Create New
                </button>
                <button className="btn btn-primary btn-primary-pulse">
                  Get Started <ArrowRight size={16} />
                </button>
                <button className="btn btn-primary" disabled>
                  Disabled
                </button>
              </div>
            </div>

            {/* Secondary Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Secondary</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary">
                  <Filter size={16} /> Filter
                </button>
                <button className="btn btn-secondary">
                  <Download size={16} /> Export
                </button>
                <button className="btn btn-secondary" disabled>
                  Disabled
                </button>
              </div>
            </div>

            {/* Ghost Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Ghost</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-ghost">
                  <Settings size={16} /> Settings
                </button>
                <button className="btn btn-ghost">
                  Cancel
                </button>
              </div>
            </div>

            {/* Icon Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Icon Only</p>
              <div className="flex flex-wrap gap-3">
                <button className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors">
                  <Plus size={18} />
                </button>
                <button className="p-2.5 rounded-xl bg-surface-2 border border-divider text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                  <Edit3 size={18} />
                </button>
                <button className="p-2.5 rounded-xl bg-surface-2 border border-divider text-danger hover:bg-danger/10 transition-colors">
                  <Trash2 size={18} />
                </button>
                <button className="p-2.5 rounded-xl bg-surface-2 border border-divider text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Inputs */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Form Inputs</h2>
          <div className="card p-6 space-y-6">
            {/* Text Inputs */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Default Input</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Enter text..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">With Icon</label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="text" className="input pl-10" placeholder="Search..." />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="input pl-10 pr-10" 
                    placeholder="••••••••" 
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Select</label>
                <div className="relative">
                  <select 
                    className="input appearance-none pr-10"
                    value={selectValue}
                    onChange={(e) => setSelectValue(e.target.value)}
                  >
                    <option value="">Select option...</option>
                    <option value="1">Option 1</option>
                    <option value="2">Option 2</option>
                    <option value="3">Option 3</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Input States */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Error State</label>
                <input 
                  type="text" 
                  className="input border-danger focus:border-danger" 
                  placeholder="Invalid input"
                  style={{ boxShadow: '0 0 0 3px rgba(255, 83, 112, 0.2)' }}
                />
                <p className="text-xs text-danger">This field is required</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Success State</label>
                <input 
                  type="text" 
                  className="input border-success" 
                  value="Valid input"
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">Disabled</label>
                <input 
                  type="text" 
                  className="input opacity-50 cursor-not-allowed" 
                  placeholder="Disabled input"
                  disabled
                />
              </div>
            </div>

            {/* Checkbox & Toggle */}
            <div className="flex flex-wrap gap-8">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checkboxValue ? 'bg-primary border-primary' : 'border-divider group-hover:border-primary/50'}`}>
                  {checkboxValue && <Check size={14} className="text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="sr-only"
                  checked={checkboxValue}
                  onChange={(e) => setCheckboxValue(e.target.checked)}
                />
                <span className="text-sm">Checkbox option</span>
              </label>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Cards</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Basic Card */}
            <div className="card p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Table size={24} />
              </div>
              <h3 className="text-lg font-semibold">Basic Card</h3>
              <p className="text-sm text-text-secondary">
                A simple card component with hover effects and subtle border glow.
              </p>
            </div>

            {/* Interactive Card */}
            <div className="card p-6 space-y-4 cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Database size={24} />
              </div>
              <h3 className="text-lg font-semibold">Interactive Card</h3>
              <p className="text-sm text-text-secondary">
                Hover to see the icon color transition and card elevation change.
              </p>
            </div>

            {/* Status Card */}
            <div className="card p-6 space-y-4 border-l-4 border-l-success">
              <div className="flex items-center justify-between">
                <span className="badge badge-success">Active</span>
                <span className="text-xs text-text-muted">2 min ago</span>
              </div>
              <h3 className="text-lg font-semibold">Status Card</h3>
              <p className="text-sm text-text-secondary">
                Card with left border accent indicating status.
              </p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Badges & Pills</h2>
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-success">Approved</span>
              <span className="badge badge-warning">Pending</span>
              <span className="badge badge-danger">Rejected</span>
              <span className="badge badge-info">Info</span>
            </div>
            <div className="flex flex-wrap gap-3 pt-4 border-t border-divider">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-success" />
                Online
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-3 text-sm">
                <GitBranch size={14} />
                main
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-3 text-sm">
                <History size={14} />
                v2.4.1
              </span>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Alerts</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
              <Check size={20} className="text-success mt-0.5" />
              <div>
                <p className="font-medium text-success">Success!</p>
                <p className="text-sm text-text-secondary">Your changes have been saved successfully.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
              <AlertTriangle size={20} className="text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Warning</p>
                <p className="text-sm text-text-secondary">There are unsaved changes that may be lost.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20">
              <X size={20} className="text-danger mt-0.5" />
              <div>
                <p className="font-medium text-danger">Error</p>
                <p className="text-sm text-text-secondary">Something went wrong. Please try again.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-info/10 border border-info/20">
              <Info size={20} className="text-info mt-0.5" />
              <div>
                <p className="font-medium text-info">Info</p>
                <p className="text-sm text-text-secondary">Your session will expire in 5 minutes.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Table Preview */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Data Table</h2>
          <div className="card overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 bg-surface-2 border-b border-divider flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">Transactions</h3>
                <span className="text-xs text-text-muted bg-surface-3 px-2 py-0.5 rounded">24 rows</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost text-sm">
                  <Filter size={14} /> Filter
                </button>
                <button className="btn btn-ghost text-sm">
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider bg-surface-2">
                    <th className="px-6 py-3 border-b border-divider">ID</th>
                    <th className="px-6 py-3 border-b border-divider">User</th>
                    <th className="px-6 py-3 border-b border-divider">Status</th>
                    <th className="px-6 py-3 border-b border-divider">Amount</th>
                    <th className="px-6 py-3 border-b border-divider">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'TXN-001', user: 'john@example.com', status: 'success', statusLabel: 'Completed', amount: '$1,240.00', valid: true },
                    { id: 'TXN-002', user: 'jane@example.com', status: 'warning', statusLabel: 'Pending', amount: '$890.50', valid: true, edited: true },
                    { id: 'TXN-003', user: 'bob@example.com', status: 'danger', statusLabel: 'Failed', amount: '$0.00', valid: false },
                    { id: 'TXN-004', user: 'alice@example.com', status: 'success', statusLabel: 'Completed', amount: '$2,100.00', valid: true },
                  ].map((row, i) => (
                    <tr 
                      key={i} 
                      className={`
                        border-b border-divider last:border-b-0 
                        hover:bg-primary/[0.04] transition-colors
                        ${row.edited ? 'bg-primary/[0.06]' : ''}
                      `}
                    >
                      <td className={`px-6 py-4 font-mono text-sm ${row.edited ? 'border-l-2 border-l-primary' : ''}`}>
                        {row.id}
                      </td>
                      <td className="px-6 py-4 text-sm">{row.user}</td>
                      <td className="px-6 py-4">
                        <span className={`badge badge-${row.status}`}>{row.statusLabel}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm">{row.amount}</td>
                      <td className="px-6 py-4">
                        {row.valid ? (
                          <Check size={18} className="text-success" />
                        ) : (
                          <span className={`flex items-center gap-1.5 text-danger text-sm ${!row.valid ? 'cell-error-indicator' : ''}`}>
                            <X size={14} /> Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer */}
            <div className="px-6 py-3 bg-surface-2 border-t border-divider flex items-center justify-between text-sm">
              <span className="text-text-muted">Showing 1-4 of 24</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors">Prev</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-white">1</button>
                <button className="px-3 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors">2</button>
                <button className="px-3 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors">3</button>
                <button className="px-3 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 transition-colors">Next</button>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing Guide */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Spacing Grid</h2>
          <div className="card p-6">
            <div className="flex items-end gap-4 flex-wrap">
              {[4, 8, 12, 16, 24, 32, 48, 64].map((size) => (
                <div key={size} className="flex flex-col items-center gap-2">
                  <div 
                    className="bg-primary/20 border border-primary/40"
                    style={{ width: size, height: size }}
                  />
                  <span className="text-xs text-text-muted">{size}px</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Animation Preview */}
        <section className="space-y-6">
          <h2 className="text-headline-md font-semibold">Animations</h2>
          <div className="card p-6 space-y-6">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="p-4 bg-surface-2 rounded-xl text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary animate-pulse" />
                <p className="text-sm text-text-muted">Pulse</p>
              </div>
              <div className="p-4 bg-surface-2 rounded-xl text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary animate-fade-in" />
                <p className="text-sm text-text-muted">Fade In (180ms)</p>
              </div>
              <div className="p-4 bg-surface-2 rounded-xl text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary animate-slide-up" />
                <p className="text-sm text-text-muted">Slide Up (220ms)</p>
              </div>
              <div className="p-4 bg-surface-2 rounded-xl text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-text-muted">Spinner</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-divider">
          <p className="text-sm text-text-muted">
            Oreo.io Design System v0.3.1 • Built with 💜 using Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  )
}
