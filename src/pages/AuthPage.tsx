import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button, Input, Card } from '../components/ui';

const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    name: 'Alice Johnson',
    email: 'alice.johnson@student.edu',
    password: 'demo123',
    description: 'CS201 enrolled · Calibrated · 1 published result',
    icon: '◯',
    accent: 'border-navy-200 bg-navy-50 hover:border-navy-300',
    iconColor: 'text-navy-600',
  },
  {
    role: 'Faculty',
    name: 'Prof. Arjun Sharma',
    email: 'prof.sharma@university.edu',
    password: 'demo123',
    description: '2 exams · 1 pending review · 1 published',
    icon: '◎',
    accent: 'border-gold-200 bg-gold-50 hover:border-gold-300',
    iconColor: 'text-gold-600',
  },
  {
    role: 'Admin',
    name: 'Dr. Priya Nair',
    email: 'admin@university.edu',
    password: 'demo123',
    description: 'Full platform access · Usage & audit logs',
    icon: '⊞',
    accent: 'border-slate-200 bg-slate-50 hover:border-slate-300',
    iconColor: 'text-slate-600',
  },
  {
    role: 'Student (uncalibrated)',
    name: 'Carol White',
    email: 'carol.white@student.edu',
    password: 'demo123',
    description: 'MTH301 enrolled · Calibration required',
    icon: '◯',
    accent: 'border-amber-200 bg-amber-50 hover:border-amber-300',
    iconColor: 'text-amber-600',
  },
];

export default function AuthPage() {
  const { navigate, login, state } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    login(email, password);
    setLoading(false);
  }

  function handleQuickLogin(acc: (typeof DEMO_ACCOUNTS)[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setTimeout(() => {
      login(acc.email, acc.password);
    }, 100);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-slate-200 bg-white px-6 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('landing')}
          className="flex items-center gap-2 group"
        >
          <div className="w-7 h-7 bg-navy-900 rounded-lg flex items-center justify-center">
            <span className="text-gold-400 font-bold text-xs">E</span>
          </div>
          <span className="font-semibold text-navy-900">EvalScript</span>
        </button>
        <span className="text-xs text-slate-400 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium">
          Demo Mode
        </span>
      </nav>

      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">Sign in to EvalScript</h1>
            <p className="text-sm text-slate-500">
              Use your university credentials or select a demo account below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Login form */}
            <div className="lg:col-span-2">
              <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    autoComplete="current-password"
                  />
                  {state.loginError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {state.loginError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    loading={loading}
                  >
                    Sign In
                  </Button>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  <p className="text-xs text-center text-slate-400">
                    All demo accounts use password:{' '}
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">demo123</span>
                  </p>
                </div>
              </Card>
            </div>

            {/* Demo accounts */}
            <div className="lg:col-span-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Quick access — demo accounts
              </p>
              <div className="space-y-3">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${acc.accent} group`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className={`text-xl mt-0.5 ${acc.iconColor}`}>{acc.icon}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm text-slate-800">{acc.name}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-medium text-slate-500">{acc.role}</span>
                          </div>
                          <p className="text-xs text-slate-500">{acc.description}</p>
                          <p className="text-xs font-mono text-slate-400 mt-0.5">{acc.email}</p>
                        </div>
                      </div>
                      <span className="text-slate-400 group-hover:text-slate-600 text-sm transition-colors shrink-0 mt-1">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="mt-8 px-5 py-4 bg-navy-950 rounded-xl text-white/70 text-xs max-w-4xl">
            <p className="font-medium text-white mb-1">Demo Platform Notice</p>
            <p>
              This is a fully functional demo. AI evaluation uses Demo Mode (no Groq API key
              required). Configure <span className="font-mono text-white/90">GROQ_API_KEY</span> and{' '}
              <span className="font-mono text-white/90">AI_MODE=groq</span> in your environment to
              enable real handwriting AI. All data is pre-seeded for demonstration purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
