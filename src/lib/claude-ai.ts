import type { Evaluation, Rubric, Submission } from '../types';
import { createClaudeClient, getClaudeModel } from './claude-client';

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function urlToBase64(
  url: string
): Promise<{ mediaType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const mediaType = blob.type || 'image/jpeg';
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { mediaType, data: btoa(binary) };
  } catch (e) {
    console.error('urlToBase64', e);
    return null;
  }
}

export async function runClaudeEvaluation(input: {
  submission: Submission;
  rubric: Rubric;
  examTitle: string;
  studentName: string;
  calibrationImageUrl?: string;
}): Promise<Evaluation> {
  const client = createClaudeClient();
  const { submission, rubric, examTitle, studentName } = input;

  const maxMarks =
    rubric.questions?.reduce((s, q) => s + (q.maxMarks || 0), 0) ||
    100;

  if (!client) {
    // No key — honest fallback marks so pipeline doesn't die
    return {
      id: genId('eval'),
      submissionId: submission.id,
      examId: submission.examId,
      examTitle,
      studentId: submission.studentId,
      studentName,
      status: 'AI_COMPLETE',
      totalMarks: Math.round(maxMarks * 0.6),
      maxMarks,
      overallConfidence: 0.4,
      overallConfidenceLevel: 'LOW',
      flags: ['NO_CLAUDE_API_KEY'],
      transcription:
        'Claude API key not configured. Open Admin → Claude Setup and paste your key.',
      questions: (rubric.questions || []).map((q) => ({
        questionId: q.id,
        questionNumber: q.number,
        awardedMarks: Math.round((q.maxMarks || 0) * 0.6),
        maxMarks: q.maxMarks || 0,
        feedback: 'Configure Claude API key for real scoring.',
        confidence: 0.3,
      })),
      aiGeneratedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as Evaluation;
  }

  const pageImages: { mediaType: string; data: string }[] = [];
  for (const page of submission.pages || []) {
    const url = page.imageUrl || page.thumbnailUrl;
    if (!url || url.includes('unsplash') || url.includes('placeholder')) continue;
    const b64 = await urlToBase64(url);
    if (b64) pageImages.push(b64);
  }

  if (input.calibrationImageUrl) {
    const cal = await urlToBase64(input.calibrationImageUrl);
    if (cal) pageImages.unshift(cal);
  }

  const rubricText = (rubric.questions || [])
    .map(
      (q, i) =>
        `Q${q.number || i + 1} (${q.maxMarks} marks): ${q.questionText}\n  Criteria: ${(q.criteria || [])
          .map((c) => `${c.description} [${c.maxMarks}]`)
          .join('; ')}`
    )
    .join('\n');

  const prompt = `You are an exam evaluator for handwritten answer scripts.
Exam: ${examTitle}
Student: ${studentName}

Rubric:
${rubricText}

${pageImages.length ? 'Images: first may be calibration handwriting sample; rest are answer pages.' : 'No images available — score conservatively.'}

Return ONLY valid JSON:
{
  "transcription": "full readable text from answers",
  "totalMarks": number,
  "maxMarks": ${maxMarks},
  "overallConfidence": 0.0-1.0,
  "questions": [
    {
      "questionId": "id from rubric if known",
      "questionNumber": "1",
      "awardedMarks": number,
      "maxMarks": number,
      "feedback": "short",
      "confidence": 0.0-1.0
    }
  ],
  "flags": ["optional issue tags"]
}`;

  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of pageImages.slice(0, 8)) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.data,
      },
    });
  }

  const msg = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 4000,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude did not return JSON');

  const parsed = JSON.parse(match[0]);
  const conf = Number(parsed.overallConfidence) || 0.7;

  return {
    id: genId('eval'),
    submissionId: submission.id,
    examId: submission.examId,
    examTitle,
    studentId: submission.studentId,
    studentName,
    status: 'AI_COMPLETE',
    totalMarks: Number(parsed.totalMarks) || 0,
    maxMarks: Number(parsed.maxMarks) || maxMarks,
    overallConfidence: conf,
    overallConfidenceLevel:
      conf >= 0.85 ? 'HIGH' : conf >= 0.6 ? 'MEDIUM' : 'LOW',
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    transcription: String(parsed.transcription || ''),
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    aiGeneratedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as Evaluation;
}