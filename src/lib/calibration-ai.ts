import { createClaudeClient, getClaudeModel } from './claude-client';

export interface CalibrationAIResult {
  qualityScore: number;
  transcription: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
  paceNotes: { slow: string; medium: string; fast: string };
}

async function urlToBase64(
  url: string
): Promise<{ mediaType: string; data: string }> {
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
  imageUrl: string;
  studentName: string;
}): Promise<CalibrationAIResult> {
  const client = createClaudeClient();

  if (!client) {
    return {
      qualityScore: 70,
      transcription: 'API key not configured.',
      feedback:
        'Add Claude API key in Admin → Claude Setup for full handwriting feedback.',
      strengths: ['Sample uploaded'],
      improvements: ['Configure Claude API key'],
      paceNotes: { slow: '—', medium: '—', fast: '—' },
    };
  }

  const img = await urlToBase64(input.imageUrl);

  const prompt = `Handwriting analysis for exam AI.
Student: ${input.studentName}
One page with SLOW / MEDIUM / FAST sections of the same calibration passage.

Return ONLY JSON:
{
  "qualityScore": 0-100,
  "transcription": "...",
  "feedback": "paragraph",
  "strengths": ["..."],
  "improvements": ["..."],
  "paceNotes": { "slow": "...", "medium": "...", "fast": "..." }
}`;

  const msg = await client.messages.create({
    model: getClaudeModel(),
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
              media_type: img.mediaType as any,
              data: img.data,
            },
          },
        ],
      },
    ],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return JSON');
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