import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-[1.5rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>{children}</div>
  )
}
