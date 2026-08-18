import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Badge, Table, TableRow, Td, Input } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

const ACTION_COLORS: Record<string, string> = {
  SUBMISSION_CREATED: 'bg-blue-100 text-blue-700',
  EVALUATION_REVIEWED: 'bg-gold-100 text-gold-700',
  EVALUATION_UPDATED: 'bg-gold-100 text-gold-700',
  RESULT_PUBLISHED: 'bg-emerald-100 text-emerald-700',
  AI_EVALUATION_COMPLETE: 'bg-navy-100 text-navy-700',
  EXAM_CREATED: 'bg-purple-100 text-purple-700',
  CALIBRATION_UPLOADED: 'bg-slate-100 text-slate-700',
  RESULT_VIEWED: 'bg-slate-100 text-slate-500',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const { state } = useApp();
  const { auditLogs } = state;
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter((log) => {
    if (!search) return true;
    return (
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <PageContainer>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all platform actions for academic compliance."
        breadcrumb="Admin Console"
      />

      <div className="mb-5 max-w-sm">
        <Input
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card padding={false}>
        <Table headers={['Timestamp', 'User', 'Role', 'Action', 'Details', 'IP']}>
          {filtered.map((log) => (
            <TableRow key={log.id}>
              <Td className="text-xs text-slate-400 font-mono whitespace-nowrap">
                {formatDateTime(log.timestamp)}
              </Td>
              <Td>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{log.userName}</p>
                </div>
              </Td>
              <Td>
                <span className="capitalize text-xs text-slate-500">{log.userRole}</span>
              </Td>
              <Td>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {log.action.replace(/_/g, ' ')}
                </span>
              </Td>
              <Td className="max-w-xs">
                <p className="text-sm text-slate-600 truncate" title={log.details}>
                  {log.details}
                </p>
              </Td>
              <Td className="font-mono text-xs text-slate-400">
                {log.ipAddress ?? '—'}
              </Td>
            </TableRow>
          ))}
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No logs match your search.</div>
        )}
      </Card>
    </PageContainer>
  );
}
