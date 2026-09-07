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
    if (!res.ok) {
      console.error('urlToBase64 HTTP', res.status, url.slice(0, 80));
      return null;
    }
    const blob = await res.blob();
    const mediaType = blob.type || 'image/jpeg';
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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
    rubric.questions?.reduce((s, q) => s + (q.maxMarks || 0), 0) || 100;

  if (!client) {
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

  // Answer pages ONLY — stable order by pageNumber
  const sortedPages = [...(submission.pages || [])].sort(
    (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0)
  );

  const answerImages: { mediaType: string; data: string; label: string }[] =
    [];
  for (const page of sortedPages) {
    const url = page.imageUrl || page.thumbnailUrl;
    if (
      !url ||
      url.startsWith('blob:') ||
      url.includes('unsplash') ||
      url.includes('placeholder')
    ) {
      console.warn(
        'Skipping bad page URL',
        page.pageNumber,
        url?.slice(0, 60)
      );
      continue;
    }
    const b64 = await urlToBase64(url);
    if (b64) {
      answerImages.push({
        ...b64,
        label: `Answer page ${page.pageNumber}`,
      });
    } else {
      console.warn('Failed to load page image', page.pageNumber);
    }
  }

  // Optional calibration — handwriting reference only, not scored
  let calibrationB64: { mediaType: string; data: string } | null = null;
  if (
    input.calibrationImageUrl &&
    !input.calibrationImageUrl.startsWith('blob:') &&
    !input.calibrationImageUrl.includes('unsplash')
  ) {
    calibrationB64 = await urlToBase64(input.calibrationImageUrl);
  }

  if (answerImages.length === 0) {
    throw new Error(
      'No readable answer page images (check storage public URLs, not blob/local)'
    );
  }

  console.log(
    '[Claude eval]',
    'pages=',
    answerImages.length,
    'cal=',
    !!calibrationB64,
    'maxMarks=',
    maxMarks,
    'student=',
    studentName
  );

  const rubricText = (rubric.questions || [])
    .map(
      (q, i) =>
        `Q${q.number || i + 1} (id:${q.id}, max ${q.maxMarks}): ${q.questionText}\n  Criteria: ${(
          q.criteria || []
        )
          .map((c) => `${c.description} [${c.maxMarks}]`)
          .join('; ')}`
    )
    .join('\n');

  const prompt = `You are a strict exam marker for handwritten answer scripts.

RULES (must follow):
1. Score ONLY from the ANSWER PAGE images. Do not award marks from the calibration sample.
2. Ignore student name/identity. Same writing must get the same marks regardless of whose name is on the script.
3. Use the rubric exactly. totalMarks must equal the sum of question awardedMarks.
4. If handwriting is unclear, lower confidence but still score what is legible; do not invent answers.
5. Return ONLY valid JSON, no markdown fences.

Exam: ${examTitle}
Rubric max total: ${maxMarks}

Rubric:
${rubricText}

Answer pages attached: ${answerImages.length}
Calibration sample attached: ${
    calibrationB64
      ? 'yes (handwriting reference only, NOT answers)'
      : 'no'
  }

JSON schema:
{
  "transcription": "text from answer pages only",
  "totalMarks": number,
  "maxMarks": ${maxMarks},
  "overallConfidence": 0.0-1.0,
  "questions": [
    {
      "questionId": "from rubric",
      "questionNumber": "1",
      "awardedMarks": number,
      "maxMarks": number,
      "feedback": "short",
      "confidence": 0.0-1.0
    }
  ],
  "flags": []
}`;

  const content: any[] = [{ type: 'text', text: prompt }];

  if (calibrationB64) {
    content.push({
      type: 'text',
      text: 'CALIBRATION SAMPLE (handwriting style only — do not score this):',
    });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: calibrationB64.mediaType,
        data: calibrationB64.data,
      },
    });
  }

  for (const img of answerImages.slice(0, 20)) {
    content.push({ type: 'text', text: img.label });
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
    temperature: 0,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('Claude raw response (no JSON):', text.slice(0, 500));
    throw new Error('Claude did not return JSON');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.error('JSON parse failed', match[0].slice(0, 300));
    throw new Error('Claude returned invalid JSON');
  }

  const conf = Number(parsed.overallConfidence) || 0.7;
  let totalMarks = Number(parsed.totalMarks) || 0;
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (questions.length) {
    const sum = questions.reduce(
      (s: number, q: any) => s + (Number(q.awardedMarks) || 0),
      0
    );
    if (sum > 0) totalMarks = sum;
  }

  totalMarks = Math.max(0, Math.min(maxMarks, Math.round(totalMarks)));

  return {
    id: genId('eval'),
    submissionId: submission.id,
    examId: submission.examId,
    examTitle,
    studentId: submission.studentId,
    studentName,
    status: 'AI_COMPLETE',
    totalMarks,
    maxMarks: Number(parsed.maxMarks) || maxMarks,
    overallConfidence: conf,
    overallConfidenceLevel:
      conf >= 0.85 ? 'HIGH' : conf >= 0.6 ? 'MEDIUM' : 'LOW',
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    transcription: String(parsed.transcription || ''),
    questions,
    aiGeneratedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as Evaluation;
}