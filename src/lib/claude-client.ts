import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

const LS_KEY = 'evalscript_system_settings';
const CLOUD_KEY = 'claude_config';

type ClaudeConfig = {
  claudeApiKey?: string;
  claudeModel?: string;
  claudeWorkspaceId?: string;
  aiMode?: string;
  aiProvider?: string;
};

function readLocal(): ClaudeConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function writeLocal(partial: ClaudeConfig) {
  try {
    const cur = readLocal();
    const next = { ...cur, ...partial };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export async function loadClaudeConfigFromCloud(): Promise<ClaudeConfig> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', CLOUD_KEY)
      .maybeSingle();
    if (error || !data?.value) return readLocal();
    const v = data.value as ClaudeConfig;
    writeLocal(v);
    return v;
  } catch {
    return readLocal();
  }
}

export async function saveClaudeConfigToCloud(cfg: ClaudeConfig): Promise<void> {
  writeLocal(cfg);
  const { error } = await supabase.from('app_settings').upsert({
    key: CLOUD_KEY,
    value: {
      claudeApiKey: cfg.claudeApiKey || '',
      claudeModel: cfg.claudeModel || DEFAULT_CLAUDE_MODEL,
      claudeWorkspaceId: cfg.claudeWorkspaceId || '',
      aiMode: cfg.aiMode || 'claude',
      aiProvider: cfg.aiProvider || 'claude',
    },
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('saveClaudeConfigToCloud', error);
    throw error;
  }
}

export function getClaudeApiKey(): string {
  const s = readLocal();
  if (s.claudeApiKey && String(s.claudeApiKey).trim()) {
    return String(s.claudeApiKey).trim();
  }
  return (
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY ||
    (import.meta as any).env?.VITE_CLAUDE_API_KEY ||
    ''
  );
}

export function getClaudeWorkspaceId(): string {
  const s = readLocal();
  if (s.claudeWorkspaceId) return String(s.claudeWorkspaceId).trim();
  return (import.meta as any).env?.VITE_ANTHROPIC_WORKSPACE_ID || '';
}

export function getClaudeModel(): string {
  const s = readLocal();
  const m = (s.claudeModel || '').trim();
  if (!m || m.includes('20250514')) return DEFAULT_CLAUDE_MODEL;
  return m;
}

export function createClaudeClient(): Anthropic | null {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;
  const workspaceId = getClaudeWorkspaceId();
  const opts: any = { apiKey, dangerouslyAllowBrowser: true };
  if (workspaceId) {
    opts.defaultHeaders = { 'anthropic-workspace-id': workspaceId };
  }
  return new Anthropic(opts);
}

export function isClaudeConfigured(): boolean {
  return !!getClaudeApiKey();
}