import React, { useEffect, useState } from 'react'
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

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

  const styles = {
    success: {
      bg: 'bg-success/10 border-success/20',
      text: 'text-success',
      icon: <CheckCircle className="w-5 h-5" />
    },
    error: {
      bg: 'bg-danger/10 border-danger/20',
      text: 'text-danger',
      icon: <XCircle className="w-5 h-5" />
    },
    info: {
      bg: 'bg-info/10 border-info/20',
      text: 'text-info',
      icon: <Info className="w-5 h-5" />
    },
    warning: {
      bg: 'bg-warning/10 border-warning/20',
      text: 'text-warning',
      icon: <AlertCircle className="w-5 h-5" />
    },
  } as const

  const { bg, text, icon } = styles[type]

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full shadow-lg rounded-card border px-4 py-3 text-sm flex items-start gap-3 transition-all duration-300 transform
      ${bg} ${text}
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
    `}>
      <div className="flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 pr-2 whitespace-pre-wrap break-words font-medium">{message}</div>
      <button
        aria-label="Dismiss"
        className="ml-auto p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
        onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
