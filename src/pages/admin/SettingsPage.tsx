import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Button, Input, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { SystemSettings } from '../../types';

export default function SettingsPage() {
  const { state, updateSystemSettings, showToast } = useApp();
  const [settings, setSettings] = useState<SystemSettings>({ ...state.systemSettings });
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<SystemSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    updateSystemSettings(settings);
    showToast('Settings saved successfully.', 'success');
    setSaving(false);
  }

  return (
    <PageContainer>
      <PageHeader
        title="System Settings"
        subtitle="Configure AI limits, thresholds, and platform behaviour."
        breadcrumb="Admin Console"
      />

      <div className="max-w-2xl space-y-6">
        {/* AI Configuration */}
        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">AI Configuration</h2>
          <div className="space-y-4">
            <Select
              label="AI Mode"
              value={settings.aiMode}
              options={[
                { value: 'demo', label: 'Demo Mode (no API key required)' },
                { value: 'groq', label: 'Production (Groq API)' },
              ]}
              onChange={(e) => update({ aiMode: e.target.value as 'demo' | 'groq' })}
            />
            <Select
              label="AI Provider"
              value={settings.aiProvider}
              options={[
                { value: 'demo', label: 'Demo Provider' },
                { value: 'groq', label: 'Groq' },
              ]}
              onChange={(e) => update({ aiProvider: e.target.value as 'demo' | 'groq' })}
            />
            <Input
              label="Groq Model"
              value={settings.groqModel}
              onChange={(e) => update({ groqModel: e.target.value })}
              hint="Must be a vision-capable model (e.g. llama-3.2-11b-vision-preview)"
            />
            <div className="px-4 py-3 bg-navy-50 border border-navy-200 rounded-lg text-xs text-navy-700">
              <p className="font-medium mb-1">Vision Requirement</p>
              <p>
                The selected model must support image input. If the model does not support vision,
                handwriting evaluation will fail. Always verify capability before switching models.
              </p>
            </div>
          </div>
        </Card>

        {/* Usage Limits */}
        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">Usage Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Max AI requests per day"
              type="number"
              min="1"
              value={settings.maxAiRequestsPerDay}
              onChange={(e) => update({ maxAiRequestsPerDay: parseInt(e.target.value) || 50 })}
              hint="Platform-wide daily limit"
            />
            <Input
              label="Max AI requests per student/day"
              type="number"
              min="1"
              value={settings.maxAiRequestsPerStudentPerDay}
              onChange={(e) =>
                update({ maxAiRequestsPerStudentPerDay: parseInt(e.target.value) || 5 })
              }
              hint="Per-student safety limit"
            />
            <Input
              label="Max pages per submission"
              type="number"
              min="1"
              max="100"
              value={settings.maxPagesPerSubmission}
              onChange={(e) => update({ maxPagesPerSubmission: parseInt(e.target.value) || 30 })}
            />
            <Input
              label="Max upload size (MB)"
              type="number"
              min="1"
              value={settings.maxUploadSizeMb}
              onChange={(e) => update({ maxUploadSizeMb: parseInt(e.target.value) || 100 })}
            />
          </div>
        </Card>

        {/* Confidence Thresholds */}
        <Card>
          <h2 className="font-semibold text-slate-900 mb-5">Confidence Thresholds</h2>
          <p className="text-sm text-slate-500 mb-4">
            Results with confidence below the medium threshold are automatically flagged for
            faculty attention.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="High confidence threshold (%)"
                type="number"
                min="50"
                max="100"
                value={Math.round(settings.highConfidenceThreshold * 100)}
                onChange={(e) =>
                  update({ highConfidenceThreshold: parseInt(e.target.value) / 100 })
                }
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-500">
                  ≥ {Math.round(settings.highConfidenceThreshold * 100)}% = HIGH
                </span>
              </div>
            </div>
            <div>
              <Input
                label="Medium confidence threshold (%)"
                type="number"
                min="30"
                max="99"
                value={Math.round(settings.mediumConfidenceThreshold * 100)}
                onChange={(e) =>
                  update({ mediumConfidenceThreshold: parseInt(e.target.value) / 100 })
                }
              />
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="text-xs text-slate-500">
                    {Math.round(settings.mediumConfidenceThreshold * 100)}% – {Math.round(settings.highConfidenceThreshold * 100) - 1}% = MEDIUM
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-xs text-slate-500">
                    {'<'} {Math.round(settings.mediumConfidenceThreshold * 100)}% = LOW (auto-flagged)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setSettings({ ...state.systemSettings })}
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
