import React from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

const GROQ_MODELS = [
  { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', recommended: true, notes: 'Best accuracy for handwriting' },
  { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision', recommended: false, notes: 'Faster, lower cost' },
  { id: 'llava-v1.5-7b-4096-tokens', name: 'LLaVA 1.5 7B', recommended: false, notes: 'Legacy option' },
];

export default function GroqSetupPage() {
  const { state, navigate } = useApp();
  const { systemSettings } = state;

  const isDemo = systemSettings.aiMode === 'demo';

  return (
    <PageContainer>
      <PageHeader
        title="Groq API Setup"
        subtitle="Configure the Groq vision API for real handwriting evaluation."
        breadcrumb="Admin"
        action={
          <Button variant="secondary" onClick={() => navigate('a-settings')}>
            Go to Settings →
          </Button>
        }
      />

      {/* Current status */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">Current AI Mode</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {isDemo
                ? 'Demo mode is active — evaluations use simulated AI with deterministic results.'
                : 'Groq API mode is active — evaluations call the real Groq vision API.'}
            </p>
          </div>
          <Badge variant={isDemo ? 'warning' : 'success'} className="shrink-0">
            {isDemo ? 'Demo Mode' : 'Groq Active'}
          </Badge>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Setup steps */}
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Setup Steps</h2>

          {[
            {
              step: 1,
              title: 'Create a Groq Account',
              desc: 'Sign up at console.groq.com. Groq offers a free tier with generous rate limits for vision models.',
            },
            {
              step: 2,
              title: 'Generate an API Key',
              desc: 'In the Groq console, navigate to API Keys → Create New Key. Copy the key — it starts with "gsk_".',
            },
            {
              step: 3,
              title: 'Add to Environment Variables',
              desc: 'In your deployment (Vercel / Cloudflare Workers), add GROQ_API_KEY as an environment variable. Never expose it in client-side code.',
            },
            {
              step: 4,
              title: 'Switch Mode in Settings',
              desc: 'Go to Admin → Settings, change AI Mode to "Groq", and select your preferred model. Save changes.',
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

        {/* Supported models */}
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-900">Supported Vision Models</h2>
          {GROQ_MODELS.map((m) => (
            <Card key={m.id} className={m.recommended ? 'border-navy-300 bg-navy-50' : ''}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 text-sm">{m.name}</p>
                    {m.recommended && <Badge variant="navy">Recommended</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{m.id}</p>
                  <p className="text-xs text-slate-500 mt-1">{m.notes}</p>
                </div>
                {systemSettings.groqModel === m.id && (
                  <Badge variant="success" className="shrink-0">Active</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Capability checklist */}
      <Card className="mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">What Groq Vision Does</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Handwriting transcription', ok: true },
            { label: 'Per-criterion mark scoring', ok: true },
            { label: 'Confidence estimation', ok: true },
            { label: 'Diagram & equation detection', ok: true },
            { label: 'Multi-page answer sheets', ok: true },
            { label: 'Faculty mark override', ok: true },
            { label: 'Real-time evaluation', ok: false, note: '2-5s per page' },
            { label: 'Handwriting calibration matching', ok: false, note: 'Coming soon' },
          ].map(({ label, ok, note }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <span className={ok ? 'text-emerald-500' : 'text-amber-500'}>{ok ? '✓' : '○'}</span>
              <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
              {note && <span className="text-xs text-slate-400">({note})</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Security note */}
      <Card className="bg-red-50 border-red-200">
        <div className="flex gap-3">
          <span className="text-red-500 text-lg shrink-0">⚠</span>
          <div>
            <p className="font-semibold text-red-900 text-sm">Security Requirements</p>
            <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
              <li>Never expose GROQ_API_KEY in client-side JavaScript or browser-visible code.</li>
              <li>Only access the API key from server-side functions (API routes, Workers).</li>
              <li>Never commit .env files containing your API key to version control.</li>
              <li>Rotate your API key immediately if you suspect it has been exposed.</li>
              <li>Use Groq rate limits and quota alerts to detect unusual usage.</li>
            </ul>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
