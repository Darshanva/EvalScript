import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button, Input, Card, Select } from '../components/ui';
import { supabase } from '../lib/supabase';
import { loadExamTree } from '../lib/exam-tree';

type Mode = 'login' | 'signup';

/** All Organisation names under every Vertical (admin Exam Structure) */
function collectOrganisations(tree: Record<string, any>): string[] {
  const set = new Set<string>();
  if (!tree || typeof tree !== 'object') return [];

  for (const vertical of Object.keys(tree)) {
    const node = tree[vertical];
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    for (const org of Object.keys(node)) {
      if (org && org.trim()) set.add(org.trim());
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export default function AuthPage() {
  const { setAuthUser, showToast, state } = useApp();
  const preselectedRole = (state.navCtx?.role as string) || 'student';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(
    preselectedRole === 'admin' ? 'student' : preselectedRole
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tree, setTree] = useState<Record<string, any>>({});
  const [hodOrg, setHodOrg] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const t = await loadExamTree();
      if (!cancelled) setTree(t);
    }
    load();
    const onUpd = () => load();
    window.addEventListener('exam-tree-updated', onUpd);
    window.addEventListener('storage', onUpd);
    return () => {
      cancelled = true;
      window.removeEventListener('exam-tree-updated', onUpd);
      window.removeEventListener('storage', onUpd);
    };
  }, []);

  useEffect(() => {
    if (state.navCtx?.role) {
      const r = state.navCtx.role as string;
      if (r !== 'admin') setRole(r);
      setMode('signup');
    }
  }, [state.navCtx?.role]);

  const organisations = useMemo(() => collectOrganisations(tree), [tree]);

  async function mapAndSetUser(profile: any, fallbackEmail: string) {
    const user = {
      id: profile.id,
      email: profile.email || fallbackEmail,
      name: profile.name || 'User',
      role: (profile.role || 'student') as any,
      avatarInitials:
        profile.avatar_initials ||
        (profile.name || 'U').slice(0, 2).toUpperCase(),
      studentId: profile.student_id,
      facultyId: profile.faculty_id,
      department: profile.department,
      calibrated: !!profile.calibrated,
      client: profile.client,
      organisation: profile.organisation,
      batch: profile.batch,
      term: profile.term,
      section: profile.section,
    };
    setAuthUser(user);
    return user;
  }

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
        await mapAndSetUser(profile || { id: data.user.id, email }, email);
        showToast('Welcome back', 'success');
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

    if (role === 'hod' && !hodOrg) {
      setError('HOD must select an Organisation');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            organisation: role === 'hod' ? hodOrg : null,
            client: role === 'hod' ? hodOrg : null,
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

      if (role === 'hod') {
        // Scope = Organisation (also stored in client for existing HOD pages)
        profileRow.organisation = hodOrg;
        profileRow.client = hodOrg;
        profileRow.department = `HOD · ${hodOrg}`;
      }

      await supabase.from('profiles').upsert(profileRow);
      await mapAndSetUser({ ...profileRow, id: data.user.id }, email);
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
                ? 'Student · Faculty · HOD · Admin'
                : 'Register — students are assigned to sections by HOD'}
            </p>
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'login' ? 'bg-white shadow' : 'text-slate-500'
              }`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'signup' ? 'bg-white shadow' : 'text-slate-500'
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
                      { value: 'hod', label: 'HOD' },
                    ]}
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setHodOrg('');
                    }}
                  />

                  {role === 'hod' && (
                    <div className="space-y-1">
                      <Select
                        label="Organisation (you are HOD for) *"
                        options={[
                          { value: '', label: 'Select organisation…' },
                          ...organisations.map((o) => ({
                            value: o,
                            label: o,
                          })),
                        ]}
                        value={hodOrg}
                        onChange={(e) => setHodOrg(e.target.value)}
                      />
                      {organisations.length === 0 && (
                        <p className="text-xs text-amber-600">
                          No organisations yet. Admin must add them under Exam
                          Structure (Vertical → Organisation).
                        </p>
                      )}
                    </div>
                  )}

                  {role === 'student' && (
                    <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      After registration, your <strong>HOD</strong> will assign
                      you to a Batch / Section.
                    </p>
                  )}
                </>
              )}

              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
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