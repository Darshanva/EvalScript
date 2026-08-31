import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { isClaudeConfigured, getClaudeModel } from '../../lib/claude-client';
import Anthropic from '@anthropic-ai/sdk';

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (faster)' },
];

export default function GroqSetupPage() {
  const { state, updateSystemSettings, showToast } = useApp();
  const s = state.systemSettings;

  const [apiKey, setApiKey] = useState(s.claudeApiKey || '');
  const [model, setModel] = useState(
    s.claudeModel || 'claude-sonnet-4-20250514'
  );
  const [aiMode, setAiMode] = useState(s.aiMode || 'claude');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const configured = isClaudeConfigured() || !!apiKey.trim();

  function handleSave() {
    setSaving(true);
    updateSystemSettings({
      ...s,
      claudeApiKey: apiKey.trim(),
      claudeModel: model,
      aiMode: aiMode as any,
      aiProvider: aiMode === 'demo' ? 'demo' : 'claude',
    });
    showToast('Claude settings saved', 'success');
    setSaving(false);
  }

  async function handleTest() {
    const key = apiKey.trim();
    if (!key) {
      showToast('Paste API key first', 'error');
      return;
    }
    setTesting(true);
    try {
      const client = new Anthropic({
        apiKey: key,
        dangerouslyAllowBrowser: true,
      });
      const msg = await client.messages.create({
        model: model || getClaudeModel(),
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      });
      const text =
        msg.content[0].type === 'text' ? msg.content[0].text : '';
      showToast(`Claude OK: ${text.slice(0, 40)}`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Claude test failed', 'error');
    } finally {
      setTesting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Claude Setup"
        subtitle="Vision API for exam evaluation and handwriting calibration"
        breadcrumb="Admin"
        showBack
        backTo="/admin"
      />

      <div className="flex items-center gap-2 mb-6">
        <Badge variant={configured ? 'navy' : 'muted'}>
          {configured ? 'Key present' : 'Key missing'}
        </Badge>
        <span className="text-xs text-slate-500">
          Priority: saved key → VITE_ANTHROPIC_API_KEY
        </span>
      </div>

      <Card className="max-w-xl space-y-4">
        <Input
          label="Anthropic API key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          autoComplete="off"
        />
        <Select
          label="Model"
          options={MODELS}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Select
          label="AI mode"
          options={[
            { value: 'claude', label: 'Claude (live)' },
            { value: 'demo', label: 'Demo (no API calls)' },
          ]}
          value={aiMode}
          onChange={(e) => setAiMode(e.target.value)}
        />

        <p className="text-xs text-slate-500">
          Get a key from{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noreferrer"
            className="text-navy-700 underline"
          >
            console.anthropic.com
          </a>
          . Browser calls use <code>dangerouslyAllowBrowser</code> — for
          production prefer a backend proxy.
        </p>

        <div className="flex gap-3">
          <Button loading={saving} onClick={handleSave}>
            Save
          </Button>
          <Button
            variant="secondary"
            loading={testing}
            onClick={handleTest}
          >
            Test connection
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}