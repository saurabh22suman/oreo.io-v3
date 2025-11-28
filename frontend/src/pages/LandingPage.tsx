import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  Table, ShieldCheck, History, 
  ArrowRight, CheckCircle2, Database, GitBranch, Lock
} from 'lucide-react'

export default function LandingPage() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('show')
          io.unobserve(e.target as Element)
        }
      })
    }, { threshold: 0.15 })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-surface-1 text-text-primary font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        {/* Animated Background per spec */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Gradient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] opacity-40" />
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(123, 75, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(123, 75, 255, 0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        <div className="relative z-10 max-w-content mx-auto px-4 sm:px-6 text-center">
          <div className="reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-divider mb-6">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-text-secondary">Simple for Users. Powerful for Data</span>
          </div>

          <h1 className="reveal text-4xl md:text-6xl font-bold tracking-tight mb-6 text-text-primary leading-tight">
            Your Data, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-glow">Validated & Editable.</span>
          </h1>

          <p className="reveal text-lg text-text-secondary max-w-xl mx-auto mb-10 leading-relaxed">
            Oreo provides an intuitive spreadsheet interface for business users, with built-in validation, governance, and full change tracking.
          </p>

          <div className="reveal flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="/register" className="btn btn-primary btn-primary-pulse px-6 py-3 text-base group">
              Get Started <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a href="#features" className="px-6 py-3 rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
              Learn More
            </a>
          </div>

          {/* Hero Visual - Editor Mockup */}
          <div className="reveal mt-16 max-w-4xl mx-auto">
            <div className="bg-surface-2 rounded-card border border-divider shadow-elevated overflow-hidden">
              {/* Mockup Header */}
              <div className="h-10 bg-surface-3 border-b border-divider flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-4 border border-divider">
                    <Lock size={10} className="text-success" />
                    <span className="text-[11px] text-text-muted font-mono">oreo.io/editor/transactions</span>
                  </div>
                </div>
              </div>

              {/* Mockup Grid */}
              <div className="p-px bg-surface-3">
                <div className="bg-surface-2">
                  {/* Header Row */}
                  <div className="grid grid-cols-4 text-xs font-medium text-text-secondary border-b border-divider">
                    <div className="px-4 py-2.5 border-r border-divider">user_id</div>
                    <div className="px-4 py-2.5 border-r border-divider">status</div>
                    <div className="px-4 py-2.5 border-r border-divider">amount</div>
                    <div className="px-4 py-2.5">validation</div>
                  </div>
                  {/* Data Rows */}
                  {[
                    { id: 'u_8392', status: 'active', statusColor: 'success', amount: '$1,240.00', valid: true },
                    { id: 'u_8393', status: 'pending', statusColor: 'warning', amount: '$450.00', valid: true, highlight: true },
                    { id: 'u_8394', status: 'failed', statusColor: 'danger', amount: '$0.00', valid: false },
                  ].map((row, i) => (
                    <div 
                      key={i} 
                      className={`grid grid-cols-4 text-sm border-b border-divider last:border-b-0 ${row.highlight ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                    >
                      <div className="px-4 py-3 border-r border-divider font-mono text-text-muted">{row.id}</div>
                      <div className="px-4 py-3 border-r border-divider">
                        <span className={`badge badge-${row.statusColor}`}>{row.status}</span>
                      </div>
                      <div className="px-4 py-3 border-r border-divider font-mono">{row.amount}</div>
                      <div className="px-4 py-3">
                        {row.valid ? (
                          <CheckCircle2 size={16} className="text-success" />
                        ) : (
                          <span className="text-danger text-xs">Invalid</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-surface-2">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Why Oreo?</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Built for data teams who need control, and business users who need simplicity.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Table size={24} />,
                title: "Spreadsheet Interface",
                desc: "Familiar grid view for editing data. Copy, paste, filter—just like Excel."
              },
              {
                icon: <ShieldCheck size={24} />,
                title: "Quality Gates",
                desc: "Define schema rules and business logic. Invalid data is flagged immediately."
              },
              {
                icon: <History size={24} />,
                title: "Audit Trails",
                desc: "Every change is versioned. Rollback to any point in time."
              },
              {
                icon: <Database size={24} />,
                title: "Delta Lake Native",
                desc: "Built on Delta Lake. ACID transactions and scalable metadata."
              },
              {
                icon: <GitBranch size={24} />,
                title: "Change Requests",
                desc: "Work on data in isolation. Submit changes for approval."
              },
              {
                icon: <Lock size={24} />,
                title: "Enterprise Security",
                desc: "Role-based access control and detailed audit logs."
              }
            ].map((feature, i) => (
              <div 
                key={i} 
                className="reveal bg-surface-1 border border-divider rounded-card p-6 hover:border-primary/30 hover:shadow-card-hover transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">How It Works</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Simple workflow for safe, governed data editing.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Upload', desc: 'Connect your data source or upload files' },
              { step: '2', title: 'Edit', desc: 'Make changes in the spreadsheet interface' },
              { step: '3', title: 'Validate', desc: 'Automatic validation against your rules' },
              { step: '4', title: 'Approve', desc: 'Submit for review and merge changes' },
            ].map((item, i) => (
              <div key={i} className="reveal text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-content mx-auto px-4 sm:px-6 text-center">
          <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">Ready to get started?</h2>
          <p className="reveal text-text-secondary mb-8 max-w-md mx-auto">
            Join teams using Oreo to manage their data with confidence.
          </p>
          <a href="/register" className="reveal btn btn-primary px-8 py-3 text-base inline-flex group">
            Start for Free <ArrowRight size={18} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
