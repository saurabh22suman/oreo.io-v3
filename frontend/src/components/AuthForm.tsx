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
      className="card p-8 w-full max-w-md mx-auto flex flex-col gap-4"
      onSubmit={e => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="text-center mb-1">
        <h3 className="text-xl font-semibold">{type === 'login' ? 'Welcome back' : 'Create your account'}</h3>
        <div className="text-sm text-gray-500">{type === 'login' ? 'Sign in to continue' : 'Join and start managing your data'}</div>
      </div>

      {type === 'register' && (
        <input
          type="text"
          id="full-name"
          name="name"
          placeholder="Full name"
          autoComplete="name"
          aria-label="Full name"
          className="border rounded-xl px-4 py-2"
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
        className="border rounded-xl px-4 py-2"
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
            className="border rounded-xl px-4 py-2 w-full"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onBlur={() => setPasswordTouched(true)}
            required
          />
          <button type="button" className="absolute right-3 top-2.5 text-gray-500" onClick={() => setShowPw(s => !s)} aria-label="Toggle password">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        
        {type === 'register' && passwordTouched && form.password && (
          <div className="mt-2 text-xs space-y-1">
            <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
              {passwordValidation.minLength ? <Check size={14} /> : <X size={14} />}
              <span>At least 8 characters</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasUppercase ? 'text-green-600' : 'text-red-600'}`}>
              {passwordValidation.hasUppercase ? <Check size={14} /> : <X size={14} />}
              <span>1 uppercase letter (A-Z)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasLowercase ? 'text-green-600' : 'text-red-600'}`}>
              {passwordValidation.hasLowercase ? <Check size={14} /> : <X size={14} />}
              <span>1 lowercase letter (a-z)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
              {passwordValidation.hasNumber ? <Check size={14} /> : <X size={14} />}
              <span>1 number (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-red-600'}`}>
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
            className="border rounded-xl px-4 py-2 w-full"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
          />
          {form.confirm && form.password !== form.confirm && (
            <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <X size={14} />
              <span>Passwords do not match</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-gray-600">
          <input type="checkbox" checked={form.remember} onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))} />
          Remember me
        </label>
        <button type="button" className="text-xs text-indigo-600 hover:underline">Forgot password?</button>
      </div>

  <button 
        type="submit" 
        className={`btn-primary bold w-full ${!canSubmit && type === 'register' ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!canSubmit && type === 'register'}
      >
        {type === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="text-center text-sm text-gray-600">
        <button type="button" className="text-indigo-600 hover:underline" onClick={switchForm}>
          {type === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </div>
    </form>
  )
}
