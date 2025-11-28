import { useState, useMemo } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'

export default function AuthForm({ type, onSubmit, switchForm }: { type: 'login' | 'register'; onSubmit: (data: any) => void; switchForm: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', remember: false })
  const [showPw, setShowPw] = useState(false)

  // Password validation rules
  const passwordValidation = useMemo(() => {
    const pw = form.password
    return {
      minLength: pw.length >= 8,
      hasUppercase: /[A-Z]/.test(pw),
      hasLowercase: /[a-z]/.test(pw),
      hasNumber: /[0-9]/.test(pw),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pw)
    }
  }, [form.password])

  const isPasswordValid = Object.values(passwordValidation).every(v => v)
  const canSubmit = type === 'login' || (isPasswordValid && form.password === form.confirm)

  return (
    <form
      className="p-6 w-full max-w-md mx-auto flex flex-col gap-4 rounded-card bg-surface-2 border border-divider"
      onSubmit={e => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold text-text-primary">
          {type === 'login' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          {type === 'login' ? 'Welcome back to Oreo' : 'Get started with Oreo'}
        </p>
      </div>

      {type === 'register' && (
        <div>
          <label htmlFor="full-name" className="block text-sm font-medium text-text-secondary mb-1.5">
            Full name
          </label>
          <input
            type="text"
            id="full-name"
            name="name"
            placeholder="Enter your name"
            autoComplete="name"
            className="input w-full"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          className="input w-full"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder="••••••••"
            autoComplete={type === 'login' ? 'current-password' : 'new-password'}
            className="input w-full pr-10"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
          />
          <button 
            type="button" 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors" 
            onClick={() => setShowPw(s => !s)} 
            aria-label="Toggle password visibility"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {type === 'register' && form.password && (
          <div className="mt-3 p-3 rounded-lg bg-surface-3 border border-divider text-xs space-y-1.5">
            {[
              { valid: passwordValidation.minLength, text: 'At least 8 characters' },
              { valid: passwordValidation.hasUppercase, text: 'One uppercase letter' },
              { valid: passwordValidation.hasLowercase, text: 'One lowercase letter' },
              { valid: passwordValidation.hasNumber, text: 'One number' },
              { valid: passwordValidation.hasSpecial, text: 'One special character' },
            ].map((rule, i) => (
              <div key={i} className={`flex items-center gap-2 ${rule.valid ? 'text-success' : 'text-text-muted'}`}>
                {rule.valid ? <Check size={12} /> : <X size={12} />}
                <span>{rule.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {type === 'register' && (
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-text-secondary mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            id="confirm-password"
            name="confirm"
            placeholder="••••••••"
            autoComplete="new-password"
            className="input w-full"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
          />
          {form.confirm && form.password !== form.confirm && (
            <div className="mt-1.5 text-xs text-danger flex items-center gap-1">
              <X size={12} />
              <span>Passwords do not match</span>
            </div>
          )}
        </div>
      )}

      {type === 'login' && (
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
              className="w-4 h-4 rounded border-divider bg-surface-3 text-primary focus:ring-primary/30"
            />
            Remember me
          </label>
          <button type="button" className="text-primary hover:text-primary-hover text-sm transition-colors">
            Forgot password?
          </button>
        </div>
      )}

      <button
        type="submit"
        className={`btn w-full py-2.5 mt-2 ${
          type === 'login' || canSubmit
            ? 'btn-primary'
            : 'bg-surface-4 text-text-muted cursor-not-allowed'
        }`}
        disabled={type === 'register' && !canSubmit}
      >
        {type === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="text-center text-sm text-text-secondary">
        {type === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button type="button" className="text-primary hover:text-primary-hover transition-colors" onClick={switchForm}>
          {type === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
