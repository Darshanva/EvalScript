import React from 'react';
import { useApp } from '../../context/AppContext';
import { Card, StatCard, ProgressBar, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function UsagePage() {
  const { state } = useApp();
  const { aiUsage, systemSettings } = state;

  const totalRequests = aiUsage.reduce((sum, u) => sum + u.requestCount, 0);
  const totalPages = aiUsage.reduce((sum, u) => sum + u.pageCount, 0);
  const totalSuccess = aiUsage.reduce((sum, u) => sum + u.successCount, 0);
  const totalFailure = aiUsage.reduce((sum, u) => sum + u.failureCount, 0);
  const successRate = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;

  const maxBar = Math.max(...aiUsage.map((u) => u.requestCount), 1);

  return (
    <PageContainer>
      <PageHeader
        title="AI Usage Report"
        subtitle="Monitor Groq API usage, costs, and limits."
        breadcrumb="Admin Console"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Requests" value={totalRequests} icon={<span>⚡</span>} accent="bg-navy-50 text-navy-700" />
        <StatCard label="Pages Processed" value={totalPages} icon={<span>◎</span>} accent="bg-blue-50 text-blue-700" />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<span>✓</span>} accent="bg-emerald-50 text-emerald-700" />
        <StatCard label="Failures" value={totalFailure} icon={<span>✕</span>} accent={totalFailure > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-400'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Limits */}
          <Card>
            <h2 className="font-semibold text-slate-900 mb-4">Usage Limits</h2>
            <div className="space-y-5">
              {[
                {
                  label: 'Daily requests',
                  used: aiUsage[0]?.requestCount ?? 0,
                  max: systemSettings.maxAiRequestsPerDay,
                },
                {
                  label: 'Student daily limit',
                  used: 2,
                  max: systemSettings.maxAiRequestsPerStudentPerDay,
                },
                {
                  label: 'Pages per submission',
                  used: 8,
                  max: systemSettings.maxPagesPerSubmission,
                },
              ].map((item) => {
                const pct = item.max > 0 ? Math.round((item.used / item.max) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-mono text-slate-800">
                        {item.used} / {item.max}
                        <span className="text-slate-400 ml-1">({pct}%)</span>
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

          {/* 7-day history */}
          <Card>
            <h2 className="font-semibold text-slate-900 mb-5">7-Day History</h2>
            <div className="space-y-3">
              {aiUsage.slice(0, 7).map((day) => {
                const barW = Math.round((day.requestCount / maxBar) * 100);
                return (
                  <div key={day.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-16 shrink-0">
                      {formatDate(day.date)}
                    </span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-navy-700 rounded-lg flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(barW, day.requestCount > 0 ? 8 : 0)}%` }}
                      >
                        {day.requestCount > 0 && (
                          <span className="text-white text-xs font-mono">{day.requestCount}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 w-20 shrink-0 text-right">
                      {day.pageCount} pages
                    </div>
                    {day.failureCount > 0 && (
                      <Badge variant="danger">{day.failureCount} failed</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Config info */}
        <div className="space-y-5">
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4">AI Configuration</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Mode</dt>
                <dd>
                  <Badge variant={systemSettings.aiMode === 'demo' ? 'warning' : 'success'}>
                    {systemSettings.aiMode === 'demo' ? 'Demo Mode' : 'Production (Groq)'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Provider</dt>
                <dd className="font-medium text-slate-700 capitalize">{systemSettings.aiProvider}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Model</dt>
                <dd className="font-mono text-xs text-slate-600">{systemSettings.groqModel}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">High confidence threshold</dt>
                <dd className="font-mono text-slate-700">{Math.round(systemSettings.highConfidenceThreshold * 100)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">Medium confidence threshold</dt>
                <dd className="font-mono text-slate-700">{Math.round(systemSettings.mediumConfidenceThreshold * 100)}%</dd>
              </div>
            </dl>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <h3 className="font-semibold text-amber-900 text-sm mb-2">Demo Mode Active</h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              The platform is running in demo mode. No Groq API calls are being made. Configure{' '}
              <code className="bg-amber-100 px-1 rounded">GROQ_API_KEY</code> and set{' '}
              <code className="bg-amber-100 px-1 rounded">AI_MODE=groq</code> to enable real AI
              evaluation.
            </p>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Groq Model Capabilities</h3>
            <div className="space-y-2">
              {[
                { name: 'Vision', ok: true, label: 'Image understanding' },
                { name: 'Structured Output', ok: true, label: 'JSON responses' },
                { name: 'Long Context', ok: true, label: '>32k tokens' },
              ].map((cap) => (
                <div key={cap.name} className="flex items-center gap-2">
                  <span className={`text-sm ${cap.ok ? 'text-emerald-500' : 'text-red-400'}`}>
                    {cap.ok ? '✓' : '✕'}
                  </span>
                  <span className="text-sm text-slate-700">{cap.name}</span>
                  <span className="text-xs text-slate-400">— {cap.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
