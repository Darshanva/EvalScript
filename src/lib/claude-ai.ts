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

/** Force one scored row per rubric question; never allow single collapsed total */
function alignQuestionsToRubric(
  parsedQuestions: any[],
  rubric: Rubric,
  overallTotal: number
): any[] {
  const rqs = rubric.questions || [];
  if (!rqs.length) {
    return (parsedQuestions || []).map((q, i) => ({
      questionId: q.questionId || q.id || `q-${i + 1}`,
      id: q.questionId || q.id || `q-${i + 1}`,
      questionNumber: String(q.questionNumber ?? i + 1),
      awardedMarks: Number(q.awardedMarks ?? q.totalAwarded ?? 0),
      totalAwarded: Number(q.awardedMarks ?? q.totalAwarded ?? 0),
      maxMarks: Number(q.maxMarks) || 0,
      feedback: String(q.feedback || ''),
      confidence: Number(q.confidence) || 0.7,
      marksGained: Array.isArray(q.marksGained) ? q.marksGained : [],
      marksLost: Array.isArray(q.marksLost) ? q.marksLost : [],
      criteriaScores: Array.isArray(q.criteriaScores) ? q.criteriaScores : [],
    }));
  }

  const byId = new Map<string, any>();
  const byNum = new Map<string, any>();
  for (const q of parsedQuestions || []) {
    if (q.questionId) byId.set(String(q.questionId), q);
    if (q.id) byId.set(String(q.id), q);
    if (q.questionNumber != null) byNum.set(String(q.questionNumber), q);
  }

  // If model returned only 1 blob for multi-question rubric, split proportionally as last resort
  const collapsed =
    (parsedQuestions?.length || 0) <= 1 && rqs.length > 1
      ? parsedQuestions?.[0]
      : null;

  return rqs.map((rq, i) => {
    let q =
      byId.get(String(rq.id)) ||
      byNum.get(String(rq.number)) ||
      byNum.get(String(i + 1));

    if (!q && collapsed) {
      const share =
        (Number(rq.maxMarks) || 0) /
        Math.max(
          1,
          rqs.reduce((s, x) => s + (x.maxMarks || 0), 0)
        );
      const awarded = Math.round(
        (Number(collapsed.awardedMarks ?? collapsed.totalAwarded ?? overallTotal) ||
          0) * share
      );
      q = {
        ...collapsed,
        awardedMarks: awarded,
        feedback:
          collapsed.feedback ||
          `Portion of overall answer mapped to Q${rq.number}.`,
        marksGained: collapsed.marksGained || [],
        marksLost: collapsed.marksLost || [],
      };
    }

    const maxMarks = Number(rq.maxMarks) || 0;
    let awarded = Number(q?.awardedMarks ?? q?.totalAwarded ?? 0);
    if (awarded > maxMarks) awarded = maxMarks;
    if (awarded < 0) awarded = 0;

    const marksGained: string[] = Array.isArray(q?.marksGained)
      ? q.marksGained.map(String)
      : [];
    const marksLost: string[] = Array.isArray(q?.marksLost)
      ? q.marksLost.map(String)
      : [];

    // Build criteriaScores from rubric criteria when model skipped them
    let criteriaScores = Array.isArray(q?.criteriaScores)
      ? q.criteriaScores.map((cs: any) => ({
          criterionId: cs.criterionId || cs.id,
          criterion: cs.criterion || cs.description || '',
          awarded: Number(cs.awarded ?? cs.awardedMarks ?? 0),
          max: Number(cs.max ?? cs.maxMarks ?? 0),
        }))
      : [];

    if (!criteriaScores.length && (rq.criteria || []).length) {
      // Distribute question marks across criteria proportionally if AI omitted them
      const crits = rq.criteria || [];
      const critMax = crits.reduce((s, c) => s + (c.maxMarks || 0), 0) || maxMarks;
      criteriaScores = crits.map((c) => {
        const cmax = Number(c.maxMarks) || 0;
        const cAward = Math.round(awarded * (cmax / Math.max(1, critMax)));
        return {
          criterionId: c.id,
          criterion: c.description || c.id,
          awarded: Math.min(cmax, cAward),
          max: cmax,
        };
      });
    }

    return {
      questionId: rq.id,
      id: rq.id,
      questionNumber: String(rq.number ?? i + 1),
      awardedMarks: awarded,
      totalAwarded: awarded,
      maxMarks,
      feedback: String(q?.feedback || ''),
      confidence: Number(q?.confidence) || 0.7,
      marksGained,
      marksLost,
      criteriaScores,
    };
  });
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
        id: q.id,
        questionNumber: q.number,
        awardedMarks: Math.round((q.maxMarks || 0) * 0.6),
        totalAwarded: Math.round((q.maxMarks || 0) * 0.6),
        maxMarks: q.maxMarks || 0,
        feedback: 'Configure Claude API key for real scoring.',
        confidence: 0.3,
        marksGained: [],
        marksLost: [],
      })),
      aiGeneratedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as Evaluation;
  }

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
      continue;
    }
    const b64 = await urlToBase64(url);
    if (b64) {
      answerImages.push({
        ...b64,
        label: `Answer page ${page.pageNumber}`,
      });
    }
  }

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

  const rubricText = (rubric.questions || [])
    .map((q, i) => {
      const crit = (q.criteria || [])
        .map((c) => `    - ${c.description} [max ${c.maxMarks}]`)
        .join('\n');
      return `Q${q.number || i + 1} | id=${q.id} | maxMarks=${q.maxMarks}
  Text: ${q.questionText}
  Criteria:\n${crit || '    (no sub-criteria)'}`;
    })
    .join('\n\n');

  const qCount = (rubric.questions || []).length || 1;

  const prompt = `You are a strict exam marker for handwritten answer scripts.

CRITICAL RULES:
1. You MUST return exactly ${qCount} items in "questions" — one for EACH rubric question below. Never merge into one overall score.
2. Each questions[i].questionId MUST match the rubric id. Each maxMarks MUST match the rubric.
3. totalMarks MUST equal the sum of all questions[].awardedMarks.
4. Score ONLY from answer page images. Calibration is handwriting reference only — do not score it.
5. Ignore student name/identity.
6. For every question provide:
   - marksGained: array of specific content points that earned marks (concrete, not vague)
   - marksLost: array of specific missing/wrong/incomplete points that lost marks
7. Return ONLY valid JSON.

Exam: ${examTitle}
Rubric max total: ${maxMarks}

RUBRIC (score each question separately):
${rubricText}

Answer pages: ${answerImages.length}
Calibration attached: ${calibrationB64 ? 'yes (reference only)' : 'no'}

JSON schema:
{
  "transcription": "full text from answer pages",
  "totalMarks": number,
  "maxMarks": ${maxMarks},
  "overallConfidence": 0.0-1.0,
  "questions": [
    {
      "questionId": "must match rubric id",
      "questionNumber": "1",
      "awardedMarks": number,
      "maxMarks": number,
      "feedback": "2-4 sentence summary for this question only",
      "confidence": 0.0-1.0,
      "marksGained": ["specific point that earned marks", "..."],
      "marksLost": ["specific point missing or weak", "..."],
      "criteriaScores": [
        { "criterionId": "...", "criterion": "...", "awarded": number, "max": number }
      ]
    }
  ],
  "flags": []
}`;

  const content: any[] = [{ type: 'text', text: prompt }];

  if (calibrationB64) {
    content.push({
      type: 'text',
      text: 'CALIBRATION SAMPLE (handwriting style only — do not score):',
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
    max_tokens: 5000,
    temperature: 0,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('Claude raw (no JSON):', text.slice(0, 500));
    throw new Error('Claude did not return JSON');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('Claude returned invalid JSON');
  }

  const conf = Number(parsed.overallConfidence) || 0.7;
  let questions = alignQuestionsToRubric(
    Array.isArray(parsed.questions) ? parsed.questions : [],
    rubric,
    Number(parsed.totalMarks) || 0
  );

  let totalMarks = questions.reduce(
    (s: number, q: any) => s + (Number(q.awardedMarks) || 0),
    0
  );
  totalMarks = Math.max(0, Math.min(maxMarks, Math.round(totalMarks)));

  console.log(
    '[Claude eval] Q count',
    questions.length,
    'rubric Qs',
    rubric.questions?.length,
    'total',
    totalMarks
  );

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