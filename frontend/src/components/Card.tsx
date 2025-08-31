import React from 'react'

export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }){
  return (
    <div className={`bg-white border border-gray-200 rounded-md p-4 ${className}`}>{children}</div>
  )
}
