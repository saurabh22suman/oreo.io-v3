import React from 'react'

type Props = {
  type?: 'success' | 'error' | 'info' | 'warning'
  message: string
  onClose: () => void
}

export default function Alert({ type = 'info', message, onClose }: Props){
  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  } as const
  return (
    <div className={`mb-2 border rounded-md px-3 py-2 text-sm flex items-start justify-between ${colors[type]}`}>
      <div className="pr-2 whitespace-pre-wrap break-words">{message}</div>
      <button aria-label="Dismiss" className="ml-4 text-xs opacity-70 hover:opacity-100" onClick={onClose}>✕</button>
    </div>
  )
}
