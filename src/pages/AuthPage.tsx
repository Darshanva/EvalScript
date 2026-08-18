import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button, Input, Card } from '../components/ui';

export default function AuthPage() {
  const { navigate, login, register, state } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    if (mode === 'login') {
      const ok = login(email, password);
      if (!ok) setError(state.loginError || 'Invalid email or password');
    } else {
      // Register
      if (!name.trim()) {
        setError('Name is required');
        setLoading(false);
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters');
        setLoading(false);
        return;
      }
      const result = register({ name: name.trim(), email: email.trim(), password, role });
      if (!result.success) {
        setError(result.message);
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <nav className="border-b border-slate-200 bg-white px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('landing')}
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 bg-navy-900 rounded-lg flex items-center justify-center">
            <span className="text-gold-400 font-bold text-xs">E</span>
          </div>
          <span className="font-semibold text-navy-900">EvalScript</span>
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">
              {mode === 'login' ? 'Sign in to EvalScript' : 'Create your account'}
            </h1>
            <p className="text-sm text-slate-500">
              {mode === 'login'
                ? 'Enter your credentials to continue'
                : 'Register as Student or Faculty'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Register
            </button>
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'student' | 'faculty')}
                      className="h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-navy-700"
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>
                </>
              )}

              <Input
                label="Email address"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />

              {(error || state.loginError) && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error || state.loginError}
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </Card>

          {mode === 'login' && (
            <div className="mt-6 p-4 bg-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700 mb-2">
                Demo accounts (password: demo123)
              </p>
              <p>Student → alice.johnson@student.edu</p>
              <p>Faculty → prof.sharma@university.edu</p>
              <p>Admin → admin@university.edu</p>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-navy-700 font-medium hover:underline"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-navy-700 font-medium hover:underline"
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}