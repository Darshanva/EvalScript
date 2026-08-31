import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import {
  saveClaudeConfigToCloud,
  isClaudeConfigured,
  getClaudeModel,
  DEFAULT_CLAUDE_MODEL,
} from '../../lib/claude-client';
import Anthropic from '@anthropic-ai/sdk';

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (faster)' },
];

function sanitizeModel(m: string | undefined): string {
  if (!m || m.includes('20250514') || m === 'claude-sonnet-4-20250514') {
    return DEFAULT_CLAUDE_MODEL;
  }
  return m;
}

export default function ClaudeSetupPage() {
  const { state, updateSystemSettings, showToast } = useApp();
  const s = state.systemSettings;

  const [apiKey, setApiKey] = useState(s.claudeApiKey || '');
  const [workspaceId, setWorkspaceId] = useState(s.claudeWorkspaceId || '');
  const [model, setModel] = useState(sanitizeModel(s.claudeModel));
  const [aiMode, setAiMode] = useState(s.aiMode || 'claude');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const configured = isClaudeConfigured() || !!apiKey.trim();

  async function handleSave() {
  setSaving(true);
  try {
    const cleanModel = model.includes('20250514') ? DEFAULT_CLAUDE_MODEL : model;
    const cfg = {
      claudeApiKey: apiKey.trim(),
      claudeWorkspaceId: workspaceId.trim(),
      claudeModel: cleanModel,
      aiMode: aiMode,
      aiProvider: aiMode === 'demo' ? 'demo' : 'claude',
    };
    updateSystemSettings({ ...s, ...cfg });
    await saveClaudeConfigToCloud(cfg);
    showToast('Claude settings saved (all users)', 'success');
  } catch (e: any) {
    showToast(e?.message || 'Cloud save failed — check app_settings table', 'error');
  } finally {
    setSaving(false);
  }
}

  async function handleTest() {
    const key = apiKey.trim();
    if (!key) {
      showToast('Paste API key first', 'error');
      return;
    }
    const useModel = sanitizeModel(model);
    setTesting(true);
    try {
      const opts: any = {
        apiKey: key,
        dangerouslyAllowBrowser: true,
      };
      if (workspaceId.trim()) {
        opts.defaultHeaders = {
          'anthropic-workspace-id': workspaceId.trim(),
        };
      }
      const client = new Anthropic(opts);
      const msg = await client.messages.create({
        model: useModel,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      showToast(`Claude OK (${useModel}): ${text.slice(0, 40)}`, 'success');
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.error?.message ||
        e?.message ||
        (typeof e === 'string' ? e : 'Claude test failed');
      showToast(String(msg).slice(0, 180), 'error');
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

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Badge variant={configured ? 'navy' : 'muted'}>
          {configured ? 'Key present' : 'Key missing'}
        </Badge>
        <span className="text-xs text-slate-500">
          Use model like <code>claude-sonnet-4-6</code> — old{' '}
          <code>*20250514</code> retired
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

        <Input
          label="Workspace ID (only if API requires it)"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder="wrkspc_... (optional)"
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
          Key from{' '}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noreferrer"
            className="text-navy-700 underline"
          >
            console.anthropic.com
          </a>
          . Prefer workspace-scoped key.
        </p>

        <div className="flex gap-3">
          <Button loading={saving} onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" loading={testing} onClick={handleTest}>
            Test connection
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}