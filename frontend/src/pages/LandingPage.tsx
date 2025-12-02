import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  Table, ShieldCheck, History, 
  ArrowRight, Database, GitBranch, Lock, CheckCircle2
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

          {/* Hero Visual - The "Live Editor" Mockup */}
          <div className="reveal mt-16 relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-glow rounded-2xl blur opacity-20"></div>
            <div className="relative rounded-2xl bg-surface-2 border border-divider shadow-2xl overflow-hidden">
              {/* Mockup Header */}
              <div className="h-12 bg-surface-3 border-b border-divider flex items-center px-6 gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="flex-1 text-center text-xs font-mono text-text-secondary">user_transactions.data — Oreo Editor</div>
              </div>

              {/* Mockup Body */}
              <div className="p-8 grid md:grid-cols-3 gap-8">
                {/* Left: The Editor UI */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                      <Table className="w-5 h-5 text-primary" /> Data Grid
                    </h3>
                    <span className="text-xs px-2 py-1 rounded bg-success/20 text-success border border-success/30">Live Mode</span>
                  </div>
                  {/* Fake Table */}
                  <div className="border border-divider rounded-lg overflow-hidden bg-surface-1">
                    <div className="grid grid-cols-3 bg-surface-3 text-xs font-medium text-text-secondary p-3 border-b border-divider">
                      <div>user_id</div>
                      <div>status</div>
                      <div>amount</div>
                    </div>
                    <div className="divide-y divide-divider text-sm text-text">
                      <div className="grid grid-cols-3 p-3 hover:bg-surface-2 transition-colors cursor-text group">
                        <div className="font-mono text-text-secondary">u_8392</div>
                        <div className="text-success">active</div>
                        <div>$1,240.00</div>
                      </div>
                      <div className="grid grid-cols-3 p-3 hover:bg-surface-2 transition-colors cursor-text group bg-primary/10">
                        <div className="font-mono text-text-secondary">u_8393</div>
                        <div className="text-warning flex items-center gap-2">
                          pending
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-primary px-1 rounded text-white">EDIT</span>
                        </div>
                        <div className="border border-primary rounded px-1 bg-surface-1">$450.50|</div>
                      </div>
                      <div className="grid grid-cols-3 p-3 hover:bg-surface-2 transition-colors cursor-text group">
                        <div className="font-mono text-text-secondary">u_8394</div>
                        <div className="text-error">blocked</div>
                        <div>$0.00</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: The Mascot/Validator */}
                <div className="relative flex flex-col items-center justify-center text-center space-y-4 border-l border-divider pl-8">
                  <div className="w-32 h-32 relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <img src="/images/oreo_rabbit.png" alt="Oreo" className="relative z-10 w-full h-full object-contain" />
                  </div>
                  <div>
                    <h4 className="text-text font-medium">Oreo Validator</h4>
                    <p className="text-xs text-text-secondary mt-1">Schema enforcement active.</p>
                  </div>
                  <div className="w-full bg-surface-3 rounded-lg p-3 text-left space-y-2">
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="w-3 h-3" /> Type check passed
                    </div>
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="w-3 h-3" /> Constraints satisfied
                    </div>
                  </div>
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
