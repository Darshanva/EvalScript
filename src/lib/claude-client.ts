import Anthropic from '@anthropic-ai/sdk';

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

export function getClaudeModel(): string {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.claudeModel) return s.claudeModel;
    }
  } catch {
    /* ignore */
  }
  return 'claude-sonnet-4-20250514';
}

export function createClaudeClient(): Anthropic | null {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export function isClaudeConfigured(): boolean {
  return !!getClaudeApiKey();
}