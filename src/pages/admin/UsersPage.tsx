import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UsersPage() {
  const { state } = useApp();
  const { users, calibrations, submissions, evaluations } = state;
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => {
    const matchesTab = tab === 'all' || u.role === tab;
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.studentId ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const roleColor: Record<string, string> = {
    student: 'bg-navy-100 text-navy-700',
    faculty: 'bg-gold-100 text-gold-700',
    admin: 'bg-slate-200 text-slate-700',
  };

  return (
    <PageContainer>
      <PageHeader
        title="User Management"
        subtitle="View and manage all platform users."
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
          { key: 'all', label: 'All Users', count: users.length },
          { key: 'student', label: 'Students', count: users.filter((u) => u.role === 'student').length },
          { key: 'faculty', label: 'Faculty', count: users.filter((u) => u.role === 'faculty').length },
          { key: 'admin', label: 'Admins', count: users.filter((u) => u.role === 'admin').length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="No users found" description="Try adjusting your search." />
        </Card>
      ) : (
        <Card padding={false}>
          <Table headers={['User', 'Role', 'ID', 'Department', 'Calibrated', 'Submissions', 'Joined', '']}>
            {filtered.map((user) => {
              const cal = calibrations.find((c) => c.studentId === user.id);
              const subs = submissions.filter((s) => s.studentId === user.id).length;
              const pubResults = evaluations.filter(
                (e) => e.studentId === user.id && e.status === 'PUBLISHED'
              ).length;
              return (
                <TableRow key={user.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar
                        initials={user.avatarInitials}
                        size="sm"
                        color={user.role === 'faculty' ? 'gold' : user.role === 'admin' ? 'slate' : 'navy'}
                      />
                      <div>
                        <p className="font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColor[user.role]}`}>
                      {user.role}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-500">
                      {user.studentId ?? user.facultyId ?? '—'}
                    </span>
                  </Td>
                  <Td className="text-slate-500">{user.department ?? '—'}</Td>
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
                      <span className="text-slate-600">
                        {subs} sub · {pubResults} result{pubResults !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                  <Td className="text-slate-400 text-xs">{formatDate(user.createdAt)}</Td>
                  <Td>
                    <Button size="sm" variant="ghost">
                      View →
                    </Button>
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
