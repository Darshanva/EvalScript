import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

const CLAUDE_MODELS = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    recommended: true,
    notes: 'Best balance for handwriting + scoring',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    recommended: false,
    notes: 'Highest quality, slower / costlier',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    recommended: false,
    notes: 'Previous generation vision',
  },
];

export default function GroqSetupPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { systemSettings } = state;
  const isDemo = systemSettings?.aiMode === 'demo';

  return (
    <PageContainer>
      <PageHeader
        title="Claude API Setup"
        subtitle="Real handwriting evaluation via Anthropic Claude (server-side key)."
        breadcrumb="Admin"
        action={
          <Button
            variant="secondary"
            onClick={() => navigate('/admin/settings')}
          >
            Go to Settings →
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-slate-900">Current AI Mode</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {isDemo
                ? 'Demo mode — simulated scores. Switch to Claude in Settings after backend key is set.'
                : 'Claude mode selected — backend must have ANTHROPIC_API_KEY.'}
            </p>
          </div>
          <Badge variant={isDemo ? 'warning' : 'success'} className="shrink-0">
            {isDemo ? 'Demo Mode' : 'Claude Selected'}
          </Badge>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Setup Steps</h2>
          {[
            {
              step: 1,
              title: 'Anthropic account',
              desc: 'Create account at console.anthropic.com and generate an API key.',
            },
            {
              step: 2,
              title: 'Backend env only',
              desc: 'On Render (or your API server) set ANTHROPIC_API_KEY=sk-ant-... Never put this in the Vite app.',
            },
            {
              step: 3,
              title: 'Eval endpoint',
              desc: 'Backend POST /api/evaluate should accept pageUrls + rubric and call Claude Vision.',
            },
            {
              step: 4,
              title: 'Switch mode',
              desc: 'Admin → Settings → AI Mode = Production (Claude) → Save.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-navy-900 text-white text-sm font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">{title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Models</h2>
          {CLAUDE_MODELS.map((m) => (
            <Card
              key={m.id}
              className={m.recommended ? 'border-navy-300 bg-navy-50' : ''}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                    {m.recommended && <Badge variant="navy">Recommended</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{m.id}</p>
                  <p className="text-xs text-slate-500 mt-1">{m.notes}</p>
                </div>
                {(systemSettings?.claudeModel || '') === m.id && (
                  <Badge variant="success" className="shrink-0">
                    Active
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-red-50 border-red-200">
        <div className="flex gap-3">
          <span className="text-red-500 text-lg shrink-0">⚠</span>
          <div>
            <p className="font-semibold text-red-900 text-sm">Security</p>
            <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
              <li>Never expose ANTHROPIC_API_KEY in browser or GitHub.</li>
              <li>Call Claude only from Render / Edge Function / API route.</li>
              <li>Frontend only calls your backend URL (VITE_CLAUDE_EVAL_URL).</li>
            </ul>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}