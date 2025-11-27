import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Props = {
  type?: 'success' | 'error' | 'info' | 'warning'
  message: string
  onClose: () => void
  autoDismiss?: boolean
}

export default function Alert({ type = 'info', message, onClose, autoDismiss = false }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in
    const t1 = setTimeout(() => setVisible(true), 10)
    let t2: any
    if (autoDismiss) {
      t2 = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 300) // Wait for fade-out before unmounting
      }, 5000)
    }
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [autoDismiss, onClose])

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  } as const

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full shadow-lg rounded-xl border px-4 py-3 text-sm flex items-start justify-between transition-all duration-300 transform
      ${colors[type]}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
    `}>
      <div className="pr-2 whitespace-pre-wrap break-words font-medium">{message}</div>
      <button
        aria-label="Dismiss"
        className="ml-4 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
        onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
