import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Card,
  Button,
  Badge,
  Avatar,
  Table,
  TableRow,
  Td,
  Tabs,
  EmptyState,
  Input,
  Select,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function UsersPage() {
  const { state, showToast } = useApp();
  const { users, calibrations, submissions, evaluations } = state;
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const list = users || [];

  const filtered = list.filter((u) => {
    const matchesTab = tab === 'all' || u.role === tab;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.studentId ?? '').toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const roleColor: Record<string, string> = {
    student: 'bg-navy-100 text-navy-700',
    faculty: 'bg-gold-100 text-gold-700',
    admin: 'bg-slate-200 text-slate-700',
  };

  async function changeRole(userId: string, role: string) {
    setUpdatingId(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);
      if (error) throw error;
      showToast(`Role updated to ${role}`, 'success');
      // soft update local list
      const u = list.find((x) => x.id === userId);
      if (u) u.role = role as any;
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Failed to update role', 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="User Management"
        subtitle="Live users from Supabase profiles table."
        breadcrumb="Admin Console"
      />

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'all', label: 'All Users', count: list.length },
          {
            key: 'student',
            label: 'Students',
            count: list.filter((u) => u.role === 'student').length,
          },
          {
            key: 'faculty',
            label: 'Faculty',
            count: list.filter((u) => u.role === 'faculty').length,
          },
          {
            key: 'admin',
            label: 'Admins',
            count: list.filter((u) => u.role === 'admin').length,
          },
        ]}
        active={tab}
        onChange={setTab}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No users found"
            description="Register users from the app, or adjust search. Profiles load from Supabase."
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            headers={[
              'User',
              'Role',
              'ID',
              'Department',
              'Calibrated',
              'Activity',
              'Joined',
              'Change role',
            ]}
          >
            {filtered.map((user) => {
              const subs = (submissions || []).filter(
                (s) => s.studentId === user.id
              ).length;
              const pubResults = (evaluations || []).filter(
                (e) => e.studentId === user.id && e.status === 'PUBLISHED'
              ).length;
              return (
                <TableRow key={user.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={user.avatarInitials || 'U'}
                        size="sm"
                        color={
                          user.role === 'faculty'
                            ? 'gold'
                            : user.role === 'admin'
                              ? 'slate'
                              : 'navy'
                        }
                      />
                      <div>
                        <p className="font-medium text-slate-800">
                          {user.name || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        roleColor[user.role] || roleColor.student
                      }`}
                    >
                      {user.role}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-500">
                      {user.studentId ?? user.facultyId ?? '—'}
                    </span>
                  </Td>
                  <Td className="text-slate-500">{user.department || '—'}</Td>
                  <Td>
                    {user.role === 'student' ? (
                      <Badge variant={user.calibrated ? 'success' : 'warning'}>
                        {user.calibrated ? 'Yes' : 'No'}
                      </Badge>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                  <Td>
                    {user.role === 'student' ? (
                      <span className="text-slate-600 text-sm">
                        {subs} sub · {pubResults} result
                        {pubResults !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                  <Td className="text-slate-400 text-xs">
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td>
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                      value={user.role}
                      disabled={updatingId === user.id}
                      onChange={(e) => changeRole(user.id, e.target.value)}
                    >
                      <option value="student">student</option>
                      <option value="faculty">faculty</option>
                      <option value="admin">admin</option>
                    </select>
                  </Td>
                </TableRow>
              );
            })}
          </Table>
        </Card>
      )}
    </PageContainer>
  );
}