import React from 'react'

interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  badge?: React.ReactNode
}

export default function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps){
  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          {badge && (
            <span className="badge badge-primary">{badge}</span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-text font-display tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
