/**
 * Hero 3D Data Visualization
 * 
 * A rich 3D perspective animated visualization showing data flowing through
 * validation, editing, and approval stages. Uses CSS 3D transforms and
 * subtle animations for a premium, modern feel.
 */

import { useEffect, useState, useRef } from 'react'
import { 
  CheckCircle2, XCircle, Clock, Edit3, Shield, 
  GitBranch, Database, ArrowRight, Sparkles
} from 'lucide-react'

// Sample data rows for the visualization
const sampleData = [
  { id: 'TXN-001', user: 'john@acme.com', status: 'approved', amount: '$12,450.00', valid: true },
  { id: 'TXN-002', user: 'sarah@corp.io', status: 'pending', amount: '$8,920.50', valid: true, editing: true },
  { id: 'TXN-003', user: 'mike@startup.co', status: 'rejected', amount: '$0.00', valid: false },
  { id: 'TXN-004', user: 'lisa@enterprise.com', status: 'approved', amount: '$34,100.00', valid: true },
  { id: 'TXN-005', user: 'alex@data.io', status: 'pending', amount: '$5,670.25', valid: true },
]

// Floating particle component
function FloatingParticle({ delay, duration, size, left, top }: { 
  delay: number; duration: number; size: number; left: string; top: string 
}) {
  return (
    <div 
      className="absolute rounded-full bg-primary/20 blur-sm animate-float"
      style={{
        width: size,
        height: size,
        left,
        top,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    />
  )
}

// Data flow line animation
function DataFlowLine({ from, to, delay }: { from: string; to: string; delay: number }) {
  return (
    <div 
      className="absolute h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-data-flow"
      style={{
        left: from,
        right: to,
        top: '50%',
        animationDelay: `${delay}s`,
      }}
    />
  )
}

export default function Hero3DVisualization() {
  const [activeRow, setActiveRow] = useState(1)
  const [validationPulse, setValidationPulse] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Cycle through active rows
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRow(prev => (prev + 1) % sampleData.length)
      setValidationPulse(true)
      setTimeout(() => setValidationPulse(false), 500)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Subtle mouse parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height
      setMousePos({ x: x * 10, y: y * 10 })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-5xl mx-auto"
      style={{ perspective: '1500px' }}
    >
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingParticle delay={0} duration={8} size={6} left="10%" top="20%" />
        <FloatingParticle delay={1} duration={10} size={8} left="85%" top="15%" />
        <FloatingParticle delay={2} duration={7} size={4} left="70%" top="70%" />
        <FloatingParticle delay={3} duration={9} size={6} left="15%" top="80%" />
        <FloatingParticle delay={4} duration={11} size={5} left="50%" top="10%" />
        <FloatingParticle delay={5} duration={8} size={7} left="30%" top="60%" />
      </div>

      {/* Main 3D container */}
      <div 
        className="relative transition-transform duration-500 ease-out"
        style={{
          transform: `rotateX(${12 - mousePos.y}deg) rotateY(${mousePos.x}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Glow effect behind the card */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary-glow/20 to-transparent rounded-3xl blur-3xl opacity-60"
          style={{ transform: 'translateZ(-50px) scale(1.1)' }}
        />

        {/* Main data grid card */}
        <div 
          className="relative bg-surface-2/90 backdrop-blur-xl rounded-2xl border border-divider/50 shadow-2xl overflow-hidden"
          style={{ 
            transform: 'translateZ(0px)',
            boxShadow: '0 25px 80px -20px rgba(123, 75, 255, 0.25), 0 10px 40px -10px rgba(0, 0, 0, 0.2)'
          }}
        >
          {/* Window chrome */}
          <div className="h-12 bg-surface-3/80 border-b border-divider/50 flex items-center px-4 gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-danger/70 hover:bg-danger transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-warning/70 hover:bg-warning transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-success/70 hover:bg-success transition-colors cursor-pointer" />
            </div>
            
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-surface-2/80 border border-divider/50">
                <Shield size={12} className="text-success" />
                <span className="text-xs font-mono text-text-muted">oreo.io/datasets/transactions</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 border border-success/20">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-medium text-success">Live</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="h-10 bg-surface-3/50 border-b border-divider/30 flex items-center px-4 gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              <Edit3 size={12} />
              Edit Mode
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-surface-3 text-text-secondary text-xs font-medium transition-colors">
              <GitBranch size={12} />
              Changes
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-surface-3 text-text-secondary text-xs font-medium transition-colors">
              <Database size={12} />
              Schema
            </button>
            <div className="flex-1" />
            <div className="text-[10px] text-text-muted font-mono">5 rows • 4 columns</div>
          </div>

          {/* Data grid */}
          <div className="relative">
            {/* Header row */}
            <div className="grid grid-cols-12 text-xs font-semibold text-text-secondary border-b border-divider/50 bg-surface-3/30">
              <div className="col-span-2 px-4 py-3 border-r border-divider/30">ID</div>
              <div className="col-span-4 px-4 py-3 border-r border-divider/30">User</div>
              <div className="col-span-2 px-4 py-3 border-r border-divider/30">Status</div>
              <div className="col-span-2 px-4 py-3 border-r border-divider/30">Amount</div>
              <div className="col-span-2 px-4 py-3">Validation</div>
            </div>

            {/* Data rows */}
            {sampleData.map((row, i) => (
              <div 
                key={row.id}
                className={`
                  grid grid-cols-12 text-sm border-b border-divider/30 last:border-b-0
                  transition-all duration-500
                  ${i === activeRow ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-surface-3/50'}
                  ${row.editing && i === activeRow ? 'ring-1 ring-primary/30 ring-inset' : ''}
                `}
              >
                <div className="col-span-2 px-4 py-3 border-r border-divider/30 font-mono text-text-muted text-xs">
                  {row.id}
                </div>
                <div className="col-span-4 px-4 py-3 border-r border-divider/30 text-text-primary truncate">
                  {row.user}
                </div>
                <div className="col-span-2 px-4 py-3 border-r border-divider/30">
                  <StatusBadge status={row.status} active={i === activeRow} />
                </div>
                <div className="col-span-2 px-4 py-3 border-r border-divider/30 font-mono text-text-primary">
                  {row.amount}
                </div>
                <div className="col-span-2 px-4 py-3 flex items-center justify-center">
                  <ValidationIndicator valid={row.valid} active={i === activeRow && validationPulse} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer status bar */}
          <div className="h-8 bg-surface-3/50 border-t border-divider/30 flex items-center justify-between px-4">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-success" />
                4 valid
              </span>
              <span className="flex items-center gap-1">
                <XCircle size={10} className="text-danger" />
                1 error
              </span>
              <span className="flex items-center gap-1">
                <Clock size={10} className="text-warning" />
                2 pending
              </span>
            </div>
            <div className="text-[10px] text-text-muted flex items-center gap-1">
              <Sparkles size={10} className="text-primary" />
              Auto-validating...
            </div>
          </div>
        </div>

        {/* Floating validation card */}
        <div 
          className={`
            absolute -right-4 top-1/4 w-48 bg-surface-2/95 backdrop-blur-lg rounded-xl 
            border border-divider/50 shadow-xl p-3 transition-all duration-500
            ${validationPulse ? 'scale-105 border-primary/50' : 'scale-100'}
          `}
          style={{ 
            transform: `translateZ(40px) rotateY(-5deg)`,
            boxShadow: '0 15px 40px -10px rgba(123, 75, 255, 0.2)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-md ${validationPulse ? 'bg-success/20' : 'bg-primary/10'} transition-colors`}>
              <Shield size={14} className={validationPulse ? 'text-success' : 'text-primary'} />
            </div>
            <span className="text-xs font-semibold text-text-primary">Validation</span>
          </div>
          <div className="space-y-1.5">
            <ValidationRule label="Type checking" passed={true} />
            <ValidationRule label="Required fields" passed={true} />
            <ValidationRule label="Business rules" passed={sampleData[activeRow]?.valid} />
            <ValidationRule label="Schema match" passed={true} />
          </div>
        </div>

        {/* Floating change request card */}
        <div 
          className="absolute -left-4 bottom-1/4 w-44 bg-surface-2/95 backdrop-blur-lg rounded-xl border border-divider/50 shadow-xl p-3"
          style={{ 
            transform: 'translateZ(30px) rotateY(5deg)',
            boxShadow: '0 15px 40px -10px rgba(123, 75, 255, 0.15)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-md bg-warning/10">
              <GitBranch size={14} className="text-warning" />
            </div>
            <span className="text-xs font-semibold text-text-primary">Change Request</span>
          </div>
          <div className="text-[10px] text-text-secondary mb-2">2 rows modified</div>
          <div className="flex items-center gap-1.5">
            <button className="flex-1 px-2 py-1 text-[10px] font-medium bg-success/10 text-success rounded-md hover:bg-success/20 transition-colors">
              Approve
            </button>
            <button className="flex-1 px-2 py-1 text-[10px] font-medium bg-danger/10 text-danger rounded-md hover:bg-danger/20 transition-colors">
              Reject
            </button>
          </div>
        </div>

        {/* Audit trail indicator */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 -bottom-4 flex items-center gap-2 px-3 py-1.5 bg-surface-2/90 backdrop-blur rounded-full border border-divider/50 shadow-lg"
          style={{ transform: 'translateZ(20px) translateX(-50%)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-text-secondary">Every change tracked • Version 47</span>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          25% { transform: translateY(-15px) translateX(5px); opacity: 0.7; }
          50% { transform: translateY(-5px) translateX(-5px); opacity: 0.5; }
          75% { transform: translateY(-20px) translateX(3px); opacity: 0.6; }
        }
        
        @keyframes data-flow {
          0% { transform: scaleX(0); opacity: 0; }
          50% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0; }
        }
        
        .animate-float {
          animation: float var(--duration, 8s) ease-in-out infinite;
        }
        
        .animate-data-flow {
          animation: data-flow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// Status badge component
function StatusBadge({ status, active }: { status: string; active: boolean }) {
  const config = {
    approved: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
    pending: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
    rejected: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  }[status] || { bg: 'bg-surface-3', text: 'text-text-muted', border: 'border-divider' }

  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
      ${config.bg} ${config.text} border ${config.border}
      ${active ? 'ring-1 ring-offset-1 ring-offset-surface-2 ring-primary/30' : ''}
      transition-all duration-300
    `}>
      {status}
    </span>
  )
}

// Validation indicator
function ValidationIndicator({ valid, active }: { valid: boolean; active: boolean }) {
  if (valid) {
    return (
      <div className={`
        flex items-center justify-center w-6 h-6 rounded-full
        ${active ? 'bg-success/20 scale-110' : 'bg-success/10'}
        transition-all duration-300
      `}>
        <CheckCircle2 size={14} className={`text-success ${active ? 'animate-bounce' : ''}`} />
      </div>
    )
  }
  
  return (
    <div className={`
      flex items-center gap-1 px-2 py-0.5 rounded-full
      bg-danger/10 border border-danger/20
      ${active ? 'animate-pulse' : ''}
    `}>
      <XCircle size={12} className="text-danger" />
      <span className="text-[10px] font-medium text-danger">Invalid</span>
    </div>
  )
}

// Validation rule item
function ValidationRule({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-muted">{label}</span>
      {passed ? (
        <CheckCircle2 size={12} className="text-success" />
      ) : (
        <XCircle size={12} className="text-danger" />
      )}
    </div>
  )
}
