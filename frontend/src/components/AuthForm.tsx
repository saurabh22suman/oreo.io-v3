import { useState, useMemo } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'

export default function AuthForm({ type, onSubmit, switchForm }: { type: 'login' | 'register'; onSubmit: (data: any) => void; switchForm: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', remember: false })
  const [showPw, setShowPw] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

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
      className="p-8 w-full max-w-md mx-auto flex flex-col gap-5 rounded-2xl bg-surface-1 border border-divider backdrop-blur-xl shadow-xl"
      onSubmit={e => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="text-center mb-2">
        <h3 className="text-2xl font-bold text-text">{type === 'login' ? 'Welcome back' : 'Create your account'}</h3>
        <div className="text-sm text-text-secondary mt-1">{type === 'login' ? 'Sign in to continue' : 'Join and start managing your data'}</div>
      </div>

      {type === 'register' && (
        <input
          type="text"
          id="full-name"
          name="name"
          placeholder="Full name"
          autoComplete="name"
          aria-label="Full name"
          className="input"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
      )}

      <input
        type="email"
        id="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        inputMode="email"
        aria-label="Email"
        className="input"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        required
      />

      <div>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder="Password"
            autoComplete={type === 'login' ? 'current-password' : 'new-password'}
            aria-label="Password"
            className="input pr-10"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onBlur={() => setPasswordTouched(true)}
            required
          />
          <button type="button" className="absolute right-3 top-3.5 text-text-muted hover:text-text transition-colors" onClick={() => setShowPw(s => !s)} aria-label="Toggle password">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {type === 'register' && form.password && (
          <div className="mt-3 p-3 rounded-lg bg-surface-2 border border-divider text-xs space-y-2">
            <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-success' : 'text-text-muted'}`}>
              {passwordValidation.minLength ? <Check size={14} /> : <X size={14} />}
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasUppercase ? 'text-success' : 'text-text-muted'}`}>
              {passwordValidation.hasUppercase ? <Check size={14} /> : <X size={14} />}
              <span>1 uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasLowercase ? 'text-success' : 'text-text-muted'}`}>
              {passwordValidation.hasLowercase ? <Check size={14} /> : <X size={14} />}
              <span>1 lowercase letter (a-z)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-success' : 'text-text-muted'}`}>
              {passwordValidation.hasNumber ? <Check size={14} /> : <X size={14} />}
              <span>1 number (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasSpecial ? 'text-success' : 'text-text-muted'}`}>
              {passwordValidation.hasSpecial ? <Check size={14} /> : <X size={14} />}
              <span>1 special character (!@#$%^&*)</span>
            </div>
          </div>
        )}
      </div>

      {type === 'register' && (
        <div>
          <input
            type="password"
            id="confirm-password"
            name="confirm"
            placeholder="Confirm password"
            autoComplete="new-password"
            aria-label="Confirm password"
            className="input"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
          />
          {form.confirm && form.password !== form.confirm && (
            <div className="mt-2 text-xs text-danger flex items-center gap-1">
              <X size={14} />
              <span>Passwords do not match</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-text-secondary cursor-pointer hover:text-text transition-colors">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
            className="w-4 h-4 rounded border-divider bg-surface-2 text-primary focus:ring-primary/50"
          />
          Remember me
        </label>
        <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">Forgot password?</button>
      </div>

      <button
        type="submit"
        className={`btn ${type === 'login' || canSubmit
            ? 'btn-primary shadow-lg shadow-primary/25'
            : 'bg-surface-3 text-text-muted cursor-not-allowed opacity-50'
          }`}
        disabled={type === 'register' && !canSubmit}
      >
        {type === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="text-center text-sm text-text-secondary">
        <button type="button" className="text-primary hover:text-primary/80 transition-colors font-medium" onClick={switchForm}>
          {type === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </div>
    </form>
  )
}
