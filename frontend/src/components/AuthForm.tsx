import { useState } from 'react'
import { Eye, EyeOff, Info } from 'lucide-react'

export default function AuthForm({ type, onSubmit, switchForm }: { type: 'login' | 'register'; onSubmit: (data: any) => void; switchForm: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', remember: false })
  const [showPw, setShowPw] = useState(false)

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
        {type === 'register' && (
          <div className="flex items-center gap-2 mb-1 text-xs text-gray-600">
            <span>Password</span>
            <div className="group relative inline-block">
              <Info size={14} className="text-gray-400 cursor-help" />
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute z-10 left-0 top-6 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg w-64">
                <div className="font-semibold mb-2">Password Requirements:</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>At least 8 characters long</li>
                  <li>1 uppercase letter (A-Z)</li>
                  <li>1 lowercase letter (a-z)</li>
                  <li>1 number (0-9)</li>
                  <li>1 special character (!@#$%^&*)</li>
                </ul>
                <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
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
            required
          />
          <button type="button" className="absolute right-3 top-2.5 text-gray-500" onClick={() => setShowPw(s => !s)} aria-label="Toggle password">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {type === 'register' && (
        <input
          type="password"
          id="confirm-password"
          name="confirm"
          placeholder="Confirm password"
          autoComplete="new-password"
          aria-label="Confirm password"
          className="border rounded-xl px-4 py-2"
          value={form.confirm}
          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          required
        />
      )}

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 text-gray-600">
          <input type="checkbox" checked={form.remember} onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))} />
          Remember me
        </label>
        <button type="button" className="text-xs text-indigo-600 hover:underline">Forgot password?</button>
      </div>

  <button type="submit" className="btn-primary bold w-full">
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
