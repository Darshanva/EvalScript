import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

export function getClaudeApiKey(): string {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.claudeApiKey && String(s.claudeApiKey).trim()) {
        return String(s.claudeApiKey).trim();
      }
    }
  } catch {
    /* ignore */
  }
  return (
    (import.meta as any).env?.VITE_ANTHROPIC_API_KEY ||
    (import.meta as any).env?.VITE_CLAUDE_API_KEY ||
    ''
  );
}

export function getClaudeWorkspaceId(): string {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.claudeWorkspaceId) return String(s.claudeWorkspaceId).trim();
    }
  } catch {
    /* ignore */
  }
  return (import.meta as any).env?.VITE_ANTHROPIC_WORKSPACE_ID || '';
}

export function getClaudeModel(): string {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.claudeModel && String(s.claudeModel).trim()) {
        const m = String(s.claudeModel).trim();
        // block retired ids
        if (m.includes('20250514') || m === 'claude-sonnet-4-20250514') {
          return DEFAULT_CLAUDE_MODEL;
        }
        return m;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CLAUDE_MODEL;
}

export function createClaudeClient(): Anthropic | null {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;

  const workspaceId = getClaudeWorkspaceId();
  const opts: ConstructorParameters<typeof Anthropic>[0] = {
    apiKey,
    dangerouslyAllowBrowser: true,
  };

  if (workspaceId) {
    (opts as any).defaultHeaders = {
      'anthropic-workspace-id': workspaceId,
    };
  }

  return new Anthropic(opts);
}

export function isClaudeConfigured(): boolean {
  return !!getClaudeApiKey();
}