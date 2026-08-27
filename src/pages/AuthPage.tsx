import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Button, Input, Card, Select } from '../components/ui';
import { supabase } from '../lib/supabase';
import { loadExamTree } from '../lib/exam-tree';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const { navigate, setAuthUser, showToast, state } = useApp();
  const preselectedRole = (state.navCtx?.role as string) || 'student';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(preselectedRole === 'admin' ? 'student' : preselectedRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Student hierarchy (from Exam Structure)
  const [tree, setTree] = useState<Record<string, any>>({});
  const [client, setClient] = useState('');
  const [org, setOrg] = useState('');
  const [batch, setBatch] = useState('');
  const [term, setTerm] = useState('');
  const [section, setSection] = useState('');

  useEffect(() => {
    if (state.navCtx?.role) {
      const r = state.navCtx.role as string;
      setRole(r === 'admin' ? 'student' : r);
      setMode('signup');
    }
  }, [state.navCtx?.role]);

  useEffect(() => {
    loadExamTree().then(setTree);
  }, []);

  const clients = Object.keys(tree);
  const orgs = client ? Object.keys(tree[client] || {}) : [];
  const batches = client && org ? Object.keys(tree[client]?.[org] || {}) : [];
  const terms =
    client && org && batch ? Object.keys(tree[client]?.[org]?.[batch] || {}) : [];
  const sections =
    client && org && batch && term
      ? Object.keys(tree[client]?.[org]?.[batch]?.[term] || {})
      : [];

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        const user = {
          id: data.user.id,
          email: data.user.email || email,
          name: profile?.name || data.user.email || 'User',
          role: (profile?.role || 'student') as 'student' | 'faculty' | 'admin',
          avatarInitials:
            profile?.avatar_initials ||
            (profile?.name || 'U').slice(0, 2).toUpperCase(),
          studentId: profile?.student_id,
          facultyId: profile?.faculty_id,
          department: profile?.department,
          calibrated: profile?.calibrated || false,
          client: profile?.client,
          organisation: profile?.organisation,
          batch: profile?.batch,
          term: profile?.term,
          section: profile?.section,
        };
        setAuthUser(user);
        showToast(`Welcome, ${user.name}`, 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (role === 'student') {
      if (!client || !section) {
        setError('Students must select Client and Section (and Batch/Term if listed).');
        setLoading(false);
        return;
      }
    }

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
      if (!data.user) throw new Error('Signup failed');

      const initials = name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const profileRow: Record<string, any> = {
        id: data.user.id,
        email,
        name,
        role,
        avatar_initials: initials,
        calibrated: false,
      };

      if (role === 'student') {
        profileRow.client = client;
        profileRow.organisation = org || null;
        profileRow.batch = batch || null;
        profileRow.term = term || null;
        profileRow.section = section;
        profileRow.department = [client, org, batch, term, section]
          .filter(Boolean)
          .join(' › ');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profileRow);
      if (profileError) console.error(profileError);

      const user = {
        id: data.user.id,
        email,
        name,
        role: role as 'student' | 'faculty' | 'admin',
        avatarInitials: initials,
        calibrated: false,
        client: role === 'student' ? client : undefined,
        organisation: role === 'student' ? org : undefined,
        batch: role === 'student' ? batch : undefined,
        term: role === 'student' ? term : undefined,
        section: role === 'student' ? section : undefined,
        department: profileRow.department,
      };
      setAuthUser(user);
      showToast('Account created', 'success');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="px-6 py-4 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-navy-900 text-white font-bold flex items-center justify-center text-sm">
          E
        </div>
        <span className="font-semibold text-slate-900">EvalScript</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              {mode === 'login' ? 'Sign in' : 'Create your account'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Access your portal'
                : 'Register as Student or Faculty'}
            </p>
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
              onClick={() => setMode('signup')}
            >
              Register
            </button>
          </div>

          <Card>
            <form
              onSubmit={mode === 'login' ? handleLogin : handleSignup}
              className="space-y-4"
            >
              {mode === 'signup' && (
                <>
                  <Input
                    label="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                  />
                  <Select
                    label="Role"
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'faculty', label: 'Faculty' },
                    ]}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />

                  {role === 'student' && (
                    <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-medium text-slate-600">
                        Your batch / section (from Admin structure)
                      </p>
                      <Select
                        label="Client / Vertical *"
                        options={[
                          { value: '', label: 'Select…' },
                          ...clients.map((c) => ({ value: c, label: c })),
                        ]}
                        value={client}
                        onChange={(e) => {
                          setClient(e.target.value);
                          setOrg('');
                          setBatch('');
                          setTerm('');
                          setSection('');
                        }}
                      />
                      {orgs.length > 0 && (
                        <Select
                          label="Organisation"
                          options={[
                            { value: '', label: 'Select…' },
                            ...orgs.map((c) => ({ value: c, label: c })),
                          ]}
                          value={org}
                          onChange={(e) => {
                            setOrg(e.target.value);
                            setBatch('');
                            setTerm('');
                            setSection('');
                          }}
                        />
                      )}
                      <Select
                        label="Batch"
                        options={[
                          { value: '', label: 'Select…' },
                          ...batches.map((c) => ({ value: c, label: c })),
                        ]}
                        value={batch}
                        onChange={(e) => {
                          setBatch(e.target.value);
                          setTerm('');
                          setSection('');
                        }}
                      />
                      <Select
                        label="Term"
                        options={[
                          { value: '', label: 'Select…' },
                          ...terms.map((c) => ({ value: c, label: c })),
                        ]}
                        value={term}
                        onChange={(e) => {
                          setTerm(e.target.value);
                          setSection('');
                        }}
                      />
                      <Select
                        label="Section *"
                        options={[
                          { value: '', label: 'Select…' },
                          ...sections.map((c) => ({ value: c, label: c })),
                        ]}
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                      />
                    </div>
                  )}
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

          <p className="text-center text-sm text-slate-500 mt-4">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  className="text-navy-700 font-medium"
                  onClick={() => setMode('signup')}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-navy-700 font-medium"
                  onClick={() => setMode('login')}
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