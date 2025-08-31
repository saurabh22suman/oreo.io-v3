import { useEffect, useState } from 'react'

export default function Mascot({ pose = 'happy', size = 160, className = '' }: { pose?: 'happy' | 'winking'; size?: number; className?: string }){
  const [animate, setAnimate] = useState(false)
  useEffect(()=>{ const t = setTimeout(()=>setAnimate(true), 80); return ()=>clearTimeout(t) }, [])
  const base = `inline-block rounded-lg bg-indigo-50 p-2 ${className}`
  return (
    <div className={`${base} ${animate? 'mascot-bounce' : ''}`} style={{ width: size, height: size }}>
      {pose === 'happy' ? (
        <svg viewBox="0 0 280 280" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gfur" x1="0" x2="1">
              <stop offset="0%" stopColor="#fff"/>
              <stop offset="100%" stopColor="#f3f4f6"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" rx="18" fill="none" />
          <ellipse cx="90" cy="48" rx="22" ry="60" transform="rotate(-18 90 48)" fill="#fff" stroke="#e6e9f8"/>
          <ellipse cx="160" cy="40" rx="22" ry="60" transform="rotate(10 160 40)" fill="#fff" stroke="#e6e9f8"/>
          <circle cx="125" cy="110" r="56" fill="url(#gfur)" stroke="#e6e9f8"/>
          <circle cx="110" cy="105" r="6" fill="#111827"/>
          <circle cx="140" cy="105" r="6" fill="#111827"/>
          <path d="M118 120 q7 8 14 0" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <ellipse cx="125" cy="188" rx="80" ry="48" fill="#fff" stroke="#e6e9f8" />
        </svg>
      ) : (
        <svg viewBox="0 0 280 280" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gfur2" x1="0" x2="1">
              <stop offset="0%" stopColor="#fff"/>
              <stop offset="100%" stopColor="#f3f4f6"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" rx="18" fill="none" />
          <ellipse cx="90" cy="48" rx="22" ry="60" transform="rotate(-18 90 48)" fill="#fff" stroke="#e6e9f8"/>
          <ellipse cx="160" cy="40" rx="22" ry="60" transform="rotate(10 160 40)" fill="#fff" stroke="#e6e9f8"/>
          <circle cx="125" cy="110" r="56" fill="url(#gfur2)" stroke="#e6e9f8"/>
          <circle cx="110" cy="102" r="6" fill="#111827"/>
          {/* winking eye */}
          <path d="M134 104 q6 6 12 0" stroke="#111827" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M118 120 q7 8 14 0" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <ellipse cx="125" cy="188" rx="80" ry="48" fill="#fff" stroke="#e6e9f8" />
        </svg>
      )}
    </div>
  )
}
