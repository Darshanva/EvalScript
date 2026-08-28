import Anthropic from '@anthropic-ai/sdk';

export interface CalibrationAIResult {
  qualityScore: number;
  transcription: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  paceNotes: {
    slow: string;
    medium: string;
    fast: string;
  };
}

function getApiKey(): string {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.claudeApiKey) return s.claudeApiKey;
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

async function urlToBase64(url: string): Promise<{ mediaType: string; data: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mediaType = blob.type || 'image/jpeg';
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { mediaType, data: btoa(binary) };
}

export async function runCalibrationAnalysis(input: {
  slowUrl: string;
  mediumUrl: string;
  fastUrl: string;
  studentName: string;
}): Promise<CalibrationAIResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    // Offline fallback — still no fake images; honest message
    return {
      qualityScore: 70,
      transcription:
        'API key not configured. Images were saved; analysis skipped.',
      feedback:
        'Add Claude API key in Admin → Claude Setup for full handwriting feedback.',
      strengths: ['Samples uploaded successfully'],
      improvements: ['Configure Claude to unlock detailed feedback'],
      paceNotes: {
        slow: 'Uploaded',
        medium: 'Uploaded',
        fast: 'Uploaded',
      },
    };
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const [slow, medium, fast] = await Promise.all([
    urlToBase64(input.slowUrl),
    urlToBase64(input.mediumUrl),
    urlToBase64(input.fastUrl),
  ]);

  const prompt = `You are a handwriting analysis expert for exam evaluation systems.
Student: ${input.studentName}

They uploaded THREE samples of the same calibration passage:
1) SLOW careful writing
2) MEDIUM natural pace
3) FAST hurried writing

Tasks:
- Transcribe what you can read from each (note unclear parts)
- Score overall handwriting quality for AI OCR readiness from 0-100
- List strengths and concrete improvements
- Comment on each pace sample

Respond ONLY valid JSON:
{
  "qualityScore": number,
  "transcription": "combined notes",
  "feedback": "paragraph for the student",
  "strengths": ["..."],
  "improvements": ["..."],
  "paceNotes": {
    "slow": "...",
    "medium": "...",
    "fast": "..."
  }
}`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: slow.mediaType as any,
              data: slow.data,
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: medium.mediaType as any,
              data: medium.data,
            },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: fast.mediaType as any,
              data: fast.data,
            },
          },
        ],
      },
    ],
  });

  const text =
    msg.content[0].type === 'text' ? msg.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    qualityScore: Number(parsed.qualityScore) || 0,
    transcription: String(parsed.transcription || ''),
    feedback: String(parsed.feedback || ''),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    paceNotes: {
      slow: parsed.paceNotes?.slow || '',
      medium: parsed.paceNotes?.medium || '',
      fast: parsed.paceNotes?.fast || '',
    },
  };
}