import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button, Input, Card, Select } from '../components/ui';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { navigate, setAuthUser, showToast, state } = useApp();
  const preselectedRole = (state.navCtx?.role as string) || 'student';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(preselectedRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (state.navCtx?.role) {
      setRole(state.navCtx.role as string);
      setMode('signup');
    }
  }, [state.navCtx?.role]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        setAuthUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          avatarInitials: profile.avatar_initials || profile.name.slice(0, 2).toUpperCase(),
          studentId: profile.student_id,
          department: profile.department,
          calibrated: profile.calibrated || false,
        });

        showToast(`Welcome back, ${profile.name}`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (authError) throw authError;

      if (data.user) {
        showToast('Account created! Please check your email to verify, then sign in.', 'success');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="border-b border-slate-200 bg-white px-6 h-14 flex items-center justify-between">
        <button onClick={() => navigate('landing')} className="flex items-center gap-2">
          <div className="w-7 h-7 bg-navy-900 rounded-lg flex items-center justify-center">
            <span className="text-gold-400 font-bold text-xs">E</span>
          </div>
          <span className="font-semibold text-navy-900">EvalScript</span>
        </button>
        <button
          onClick={() => navigate('landing')}
          className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          ← Back
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">
              {mode === 'login' ? 'Sign in to EvalScript' : 'Create your account'}
            </h1>
            <p className="text-sm text-slate-500">
              {mode === 'login'
                ? 'Use your university credentials to continue.'
                : 'Join as a student, faculty, or admin.'}
            </p>
          </div>

          <Card>
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <Input
                    label="Full Name"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <Select
                    label="Role"
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'faculty', label: 'Faculty' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
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
                minLength={6}
              />

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}