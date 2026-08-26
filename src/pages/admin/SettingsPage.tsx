import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Button, Input, Select } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { SystemSettings } from '../../types';

export default function SettingsPage() {
  const { state, updateSystemSettings, showToast } = useApp();
  const [settings, setSettings] = useState<SystemSettings>({
    ...state.systemSettings,
    claudeModel:
      state.systemSettings.claudeModel || 'claude-sonnet-4-20250514',
  });
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<SystemSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    setSaving(true);
    try {
      updateSystemSettings(settings);
      localStorage.setItem(
        'evalscript_system_settings',
        JSON.stringify(settings)
      );
      showToast('Settings saved.', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  const modeValue =
    settings.aiMode === 'groq' ? 'claude' : settings.aiMode || 'claude';
  const providerValue =
    settings.aiProvider === 'groq'
      ? 'claude'
      : settings.aiProvider || 'claude';

  return (
    <PageContainer>
      <PageHeader
        title="System Settings"
        subtitle="AI limits, thresholds, and Claude configuration."
        breadcrumb="Admin Console"
      />

      <div className="max-w-2xl space-y-6">
        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">AI Configuration</h2>
          <div className="space-y-4">
            <Select
              label="AI Mode"
              value={modeValue}
              options={[
                { value: 'demo', label: 'Demo Mode (simulated, no API)' },
                {
                  value: 'claude',
                  label: 'Production (Claude via backend)',
                },
              ]}
              onChange={(e) =>
                update({
                  aiMode: e.target.value as 'demo' | 'claude',
                  aiProvider: e.target.value as 'demo' | 'claude',
                })
              }
            />
            <Select
              label="AI Provider"
              value={providerValue}
              options={[
                { value: 'demo', label: 'Demo Provider' },
                { value: 'claude', label: 'Claude (Anthropic)' },
              ]}
              onChange={(e) =>
                update({
                  aiProvider: e.target.value as 'demo' | 'claude',
                })
              }
            />
            <Input
              label="Claude Model"
              value={settings.claudeModel || 'claude-sonnet-4-20250514'}
              onChange={(e) => update({ claudeModel: e.target.value })}
              hint="Preferred model id. Backend should use CLAUDE_MODEL env."
            />
            <div className="px-4 py-3 bg-navy-50 border border-navy-200 rounded-lg text-xs text-navy-700">
              <p className="font-medium mb-1">Security</p>
              <p>
                Put ANTHROPIC_API_KEY only on Render/backend. Never in Vite
                client code or GitHub.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">Usage Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Max AI requests per day"
              type="number"
              min="1"
              value={settings.maxAiRequestsPerDay}
              onChange={(e) =>
                update({ maxAiRequestsPerDay: parseInt(e.target.value) || 50 })
              }
            />
            <Input
              label="Max AI requests per student/day"
              type="number"
              min="1"
              value={settings.maxAiRequestsPerStudentPerDay}
              onChange={(e) =>
                update({
                  maxAiRequestsPerStudentPerDay:
                    parseInt(e.target.value) || 5,
                })
              }
            />
            <Input
              label="Max pages per submission"
              type="number"
              min="1"
              max="100"
              value={settings.maxPagesPerSubmission}
              onChange={(e) =>
                update({
                  maxPagesPerSubmission: parseInt(e.target.value) || 30,
                })
              }
            />
            <Input
              label="Max upload size (MB)"
              type="number"
              min="1"
              value={settings.maxUploadSizeMb}
              onChange={(e) =>
                update({ maxUploadSizeMb: parseInt(e.target.value) || 100 })
              }
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">
            Confidence Thresholds
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="High confidence threshold (%)"
              type="number"
              min="50"
              max="100"
              value={Math.round(
                (settings.highConfidenceThreshold || 0.9) * 100
              )}
              onChange={(e) =>
                update({
                  highConfidenceThreshold: parseInt(e.target.value) / 100,
                })
              }
            />
            <Input
              label="Medium confidence threshold (%)"
              type="number"
              min="30"
              max="99"
              value={Math.round(
                (settings.mediumConfidenceThreshold || 0.75) * 100
              )}
              onChange={(e) =>
                update({
                  mediumConfidenceThreshold: parseInt(e.target.value) / 100,
                })
              }
            />
          </div>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              setSettings({
                ...state.systemSettings,
                claudeModel:
                  state.systemSettings.claudeModel ||
                  'claude-sonnet-4-20250514',
              })
            }
          >
            Reset
          </Button>
          <Button loading={saving} onClick={save}>
            Save Settings
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}