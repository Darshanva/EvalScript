import React from 'react';
import { useApp } from '../../context/AppContext';
import { Card, StatCard, ProgressBar, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

export default function UsagePage() {
  const { state } = useApp();
  const { aiUsage, systemSettings, submissions } = state;
  const usage = aiUsage || [];

  const totalRequests = usage.reduce((sum, u) => sum + (u.requestCount || 0), 0);
  const totalPages = usage.reduce((sum, u) => sum + (u.pageCount || 0), 0);
  const totalSuccess = usage.reduce((sum, u) => sum + (u.successCount || 0), 0);
  const totalFailure = usage.reduce((sum, u) => sum + (u.failureCount || 0), 0);
  const successRate =
    totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;
  const maxBar = Math.max(...usage.map((u) => u.requestCount || 0), 1);

  const livePages = (submissions || []).reduce(
    (sum, s) => sum + (s.pageCount || s.pages?.length || 0),
    0
  );

  return (
    <PageContainer>
      <PageHeader
        title="AI Usage Report"
        subtitle="Usage counters + live submission page totals from the database."
        breadcrumb="Admin Console"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Recorded Requests"
          value={totalRequests}
          icon={<span>⚡</span>}
          accent="bg-navy-50 text-navy-700"
        />
        <StatCard
          label="Recorded Pages"
          value={totalPages}
          icon={<span>◎</span>}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Live submitted pages"
          value={livePages}
          icon={<span>↑</span>}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Failures"
          value={totalFailure}
          icon={<span>✕</span>}
          accent={
            totalFailure > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-400'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <h2 className="font-semibold text-slate-900 mb-4">Configured Limits</h2>
            <div className="space-y-5">
              {[
                {
                  label: 'Daily requests',
                  used: usage[0]?.requestCount ?? 0,
                  max: systemSettings.maxAiRequestsPerDay || 50,
                },
                {
                  label: 'Student daily limit',
                  used: 0,
                  max: systemSettings.maxAiRequestsPerStudentPerDay || 5,
                },
                {
                  label: 'Pages per submission (max)',
                  used: 0,
                  max: systemSettings.maxPagesPerSubmission || 30,
                },
              ].map((item) => {
                const pct =
                  item.max > 0 ? Math.round((item.used / item.max) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-mono text-slate-800">
                        {item.used} / {item.max}
                      </span>
                    </div>
                    <ProgressBar
                      value={item.used}
                      max={item.max}
                      color={pct > 80 ? 'red' : pct > 60 ? 'amber' : 'navy'}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-slate-900 mb-5">History</h2>
            {usage.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No usage records yet.
              </p>
            ) : (
              <div className="space-y-3">
                {usage.slice(0, 14).map((day) => {
                  const barW = Math.round(
                    ((day.requestCount || 0) / maxBar) * 100
                  );
                  return (
                    <div key={day.id} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-16 shrink-0">
                        {formatDate(day.date)}
                      </span>
                      <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-navy-700 rounded-lg flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.max(
                              barW,
                              (day.requestCount || 0) > 0 ? 8 : 0
                            )}%`,
                          }}
                        >
                          {(day.requestCount || 0) > 0 && (
                            <span className="text-white text-xs font-mono">
                              {day.requestCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 w-20 shrink-0 text-right">
                        {day.pageCount || 0} pages
                      </div>
                      {(day.failureCount || 0) > 0 && (
                        <Badge variant="danger">{day.failureCount} failed</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4">
              AI Configuration
            </h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Mode</dt>
                <dd>
                  <Badge
                    variant={
                      systemSettings.aiMode === 'demo' ? 'warning' : 'success'
                    }
                  >
                    {systemSettings.aiMode === 'demo'
                      ? 'Demo Mode'
                      : 'Production (Groq)'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Provider</dt>
                <dd className="font-medium text-slate-700 capitalize">
                  {systemSettings.aiProvider}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Model</dt>
                <dd className="font-mono text-xs text-slate-600">
                  {systemSettings.groqModel || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 mb-0.5">Success rate</dt>
                <dd className="font-mono text-slate-700">{successRate}%</dd>
              </div>
            </dl>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">Note</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              User counts, exams, and submissions come from Supabase in real time.
              AI request history uses recorded usage rows. Switch AI mode to Groq
              in Settings and add a server-side API key for live model calls.
            </p>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}