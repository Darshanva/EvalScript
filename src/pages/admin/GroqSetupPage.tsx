import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

const GROQ_MODELS = [
  {
    id: 'llama-3.2-90b-vision-preview',
    name: 'Llama 3.2 90B Vision',
    recommended: true,
    notes: 'Best accuracy for handwriting',
  },
  {
    id: 'llama-3.2-11b-vision-preview',
    name: 'Llama 3.2 11B Vision',
    recommended: false,
    notes: 'Faster, lower cost',
  },
  {
    id: 'llava-v1.5-7b-4096-tokens',
    name: 'LLaVA 1.5 7B',
    recommended: false,
    notes: 'Legacy option',
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
        title="Groq API Setup"
        subtitle="Connect real handwriting evaluation (server-side key required)."
        breadcrumb="Admin"
        action={
          <Button variant="secondary" onClick={() => navigate('/admin/settings')}>
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
                ? 'Demo mode — simulated scores. Switch to Groq in Settings after adding a server key.'
                : 'Groq mode selected — ensure GROQ_API_KEY is set on the server/backend.'}
            </p>
          </div>
          <Badge variant={isDemo ? 'warning' : 'success'} className="shrink-0">
            {isDemo ? 'Demo Mode' : 'Groq Selected'}
          </Badge>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Setup Steps</h2>
          {[
            {
              step: 1,
              title: 'Create a Groq Account',
              desc: 'Sign up at console.groq.com.',
            },
            {
              step: 2,
              title: 'Generate an API Key',
              desc: 'API Keys → Create. Key starts with gsk_.',
            },
            {
              step: 3,
              title: 'Add to server env only',
              desc: 'Vercel / backend: GROQ_API_KEY. Never put the key in frontend code.',
            },
            {
              step: 4,
              title: 'Switch mode',
              desc: 'Admin → Settings → AI Mode = Groq → Save.',
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
          <h2 className="font-semibold text-slate-900">Supported Vision Models</h2>
          {GROQ_MODELS.map((m) => (
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
                {systemSettings?.groqModel === m.id && (
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
              <li>Never expose GROQ_API_KEY in browser / Vite client code.</li>
              <li>Call Groq only from a backend (API route / Edge Function).</li>
              <li>Do not commit .env files with secrets.</li>
            </ul>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}