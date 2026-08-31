import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import Anthropic from '@anthropic-ai/sdk';

const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
];

export default function ClaudeSetupPage() {
  const { state, updateSystemSettings, showToast } = useApp();
  const s = state.systemSettings || ({} as any);

  const [apiKey, setApiKey] = useState(s.claudeApiKey || '');
  const [workspaceId, setWorkspaceId] = useState(s.claudeWorkspaceId || '');
  const [model, setModel] = useState(
    (s.claudeModel || 'claude-sonnet-4-6').includes('20250514')
      ? 'claude-sonnet-4-6'
      : s.claudeModel || 'claude-sonnet-4-6'
  );
  const [aiMode, setAiMode] = useState(s.aiMode || 'claude');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const next = {
        ...s,
        claudeApiKey: apiKey.trim(),
        claudeWorkspaceId: workspaceId.trim(),
        claudeModel: model,
        aiMode,
        aiProvider: aiMode === 'demo' ? 'demo' : 'claude',
      };
      updateSystemSettings(next);
      // optional cloud — fail soft
      try {
        const { saveClaudeConfigToCloud } = await import('../../lib/claude-client');
        await saveClaudeConfigToCloud(next);
      } catch (e) {
        console.warn('cloud save optional', e);
      }
      showToast('Claude settings saved', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!apiKey.trim()) {
      showToast('Paste API key first', 'error');
      return;
    }
    setTesting(true);
    try {
      const opts: any = {
        apiKey: apiKey.trim(),
        dangerouslyAllowBrowser: true,
      };
      if (workspaceId.trim()) {
        opts.defaultHeaders = { 'anthropic-workspace-id': workspaceId.trim() };
      }
      const client = new Anthropic(opts);
      const msg = await client.messages.create({
        model,
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      showToast(`Claude OK (${model}): ${text.slice(0, 40)}`, 'success');
    } catch (e: any) {
      showToast(
        String(e?.error?.message || e?.message || 'Test failed').slice(0, 180),
        'error'
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Claude Setup"
        subtitle="Vision API for evaluation and calibration"
        breadcrumb="Admin"
        showBack
        backTo="/admin"
      />

      <div className="mb-4">
        <Badge variant={apiKey.trim() ? 'navy' : 'muted'}>
          {apiKey.trim() ? 'Key present' : 'Key missing'}
        </Badge>
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
          label="Workspace ID (optional)"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder="wrkspc_..."
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
            { value: 'demo', label: 'Demo' },
          ]}
          value={aiMode}
          onChange={(e) => setAiMode(e.target.value)}
        />
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