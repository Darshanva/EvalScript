import type { Evaluation, Rubric, Submission } from '../types';
import { createClaudeClient, getClaudeModel } from './claude-client';
import { runTwoPassTranscription } from './two-pass-transcription';

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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
      marksGained: Array.isArray(q.marksGained) ? q.marksGained.map(String) : [],
      marksLost: Array.isArray(q.marksLost) ? q.marksLost.map(String) : [],
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
        (Number(
          collapsed.awardedMarks ?? collapsed.totalAwarded ?? overallTotal
        ) || 0) * share
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
    awarded = Math.max(0, Math.min(maxMarks, Math.round(awarded)));

    return {
      questionId: rq.id,
      id: rq.id,
      questionNumber: String(rq.number ?? i + 1),
      awardedMarks: awarded,
      totalAwarded: awarded,
      maxMarks,
      feedback: String(q?.feedback || ''),
      confidence: Number(q?.confidence) || 0.7,
      marksGained: Array.isArray(q?.marksGained)
        ? q.marksGained.map(String)
        : [],
      marksLost: Array.isArray(q?.marksLost) ? q.marksLost.map(String) : [],
      criteriaScores: Array.isArray(q?.criteriaScores)
        ? q.criteriaScores
        : [],
    };
  });
}

/** Grade from final transcript + rubric (text only — stable, no cal bias) */
async function gradeFromTranscript(input: {
  transcription: string;
  rubric: Rubric;
  examTitle: string;
  maxMarks: number;
}): Promise<{
  totalMarks: number;
  overallConfidence: number;
  questions: any[];
  flags: string[];
}> {
  const client = createClaudeClient();
  if (!client) {
    return {
      totalMarks: Math.round(input.maxMarks * 0.6),
      overallConfidence: 0.4,
      questions: [],
      flags: ['NO_CLAUDE_API_KEY'],
    };
  }

  const rqs = input.rubric.questions || [];
  const qCount = rqs.length || 1;

  const requiredShape = rqs
    .map(
      (q, i) =>
        `  {
    "questionId": "${q.id}",
    "questionNumber": "${q.number ?? i + 1}",
    "awardedMarks": <0-${q.maxMarks}>,
    "maxMarks": ${q.maxMarks},
    "feedback": "<for this question only>",
    "confidence": <0-1>,
    "marksGained": ["..."],
    "marksLost": ["..."]
  }`
    )
    .join(',\n');

  const rubricText = rqs
    .map(
      (q, i) =>
        `Q${q.number || i + 1} id=${q.id} max=${q.maxMarks}: ${q.questionText}`
    )
    .join('\n');

  const prompt = `You are a strict exam marker. Score ONLY from the transcript below (already transcribed from handwriting).

HARD RULES:
1. Exactly ${qCount} items in "questions" — one per rubric question. Never one overall score.
2. questionId and maxMarks must match the template.
3. totalMarks = sum of awardedMarks.
4. Ignore student identity.
5. marksGained / marksLost = concrete points per question.
6. JSON only.

Exam: ${input.examTitle}
Max total: ${input.maxMarks}

RUBRIC:
${rubricText}

REQUIRED questions shape:
[
${requiredShape}
]

TRANSCRIPT:
"""
${input.transcription}
"""

Return:
{
  "totalMarks": number,
  "maxMarks": ${input.maxMarks},
  "overallConfidence": 0.0-1.0,
  "questions": [ /* ${qCount} items */ ],
  "flags": []
}`;

  const msg = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 5000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Grade step did not return JSON');
  const parsed = JSON.parse(match[0]);

  const questions = alignQuestionsToRubric(
    Array.isArray(parsed.questions) ? parsed.questions : [],
    input.rubric,
    Number(parsed.totalMarks) || 0
  );
  let totalMarks = questions.reduce(
    (s: number, q: any) => s + (Number(q.awardedMarks) || 0),
    0
  );
  totalMarks = Math.max(0, Math.min(input.maxMarks, Math.round(totalMarks)));

  return {
    totalMarks,
    overallConfidence: Number(parsed.overallConfidence) || 0.7,
    questions,
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  };
}

export async function runClaudeEvaluation(input: {
  submission: Submission;
  rubric: Rubric;
  examTitle: string;
  studentName: string;
  calibrationImageUrl?: string;
}): Promise<Evaluation> {
  const { submission, rubric, examTitle, studentName } = input;
  const maxMarks =
    rubric.questions?.reduce((s, q) => s + (q.maxMarks || 0), 0) || 100;

  const client = createClaudeClient();
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
      transcription: 'Claude API key not configured.',
      questions: (rubric.questions || []).map((q) => ({
        questionId: q.id,
        id: q.id,
        questionNumber: q.number,
        awardedMarks: Math.round((q.maxMarks || 0) * 0.6),
        totalAwarded: Math.round((q.maxMarks || 0) * 0.6),
        maxMarks: q.maxMarks || 0,
        feedback: 'Configure API key.',
        confidence: 0.3,
        marksGained: [],
        marksLost: [],
      })),
      aiGeneratedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as Evaluation;
  }

  // ——— TWO-PASS TRANSCRIPTION ———
  const tp = await runTwoPassTranscription({
    pages: submission.pages || [],
    examTitle,
    calibrationImageUrl: input.calibrationImageUrl,
  });

  console.log(
    '[two-pass] done transcriptLen=',
    tp.fullTranscription.length,
    'flags=',
    tp.flaggedUncertainties.length,
    'pass2=',
    tp.pass2Ran
  );

  // ——— GRADE FROM TRANSCRIPT (per rubric Q) ———
  const graded = await gradeFromTranscript({
    transcription: tp.fullTranscription,
    rubric,
    examTitle,
    maxMarks,
  });

  const conf = graded.overallConfidence;
  const extraFlags = [
    ...graded.flags,
    ...(tp.pass2Ran ? ['TWO_PASS_CALIBRATION_USED'] : []),
    ...(tp.flaggedUncertainties.length
      ? [`UNCERTAINTIES_${tp.flaggedUncertainties.length}`]
      : []),
  ];

  let transcriptionOut = tp.fullTranscription;
  if (tp.flaggedUncertainties.length) {
    transcriptionOut +=
      '\n\n--- AI uncertainty notes ---\n' +
      tp.flaggedUncertainties
        .map((f) => `• "${f.guess}" @ ${f.location}: ${f.ambiguity_note}`)
        .join('\n');
    if (tp.resolvedUncertainties.length) {
      transcriptionOut +=
        '\n--- Resolved via calibration ---\n' +
        tp.resolvedUncertainties
          .map(
            (r) =>
              `• ${r.location} → "${r.final_answer}" (${r.resolved_via})`
          )
          .join('\n');
    }
  }

  console.log(
    '[Claude eval] Q count',
    graded.questions.length,
    'rubric Qs',
    rubric.questions?.length,
    'total',
    graded.totalMarks,
    'pass2',
    tp.pass2Ran
  );

  return {
    id: genId('eval'),
    submissionId: submission.id,
    examId: submission.examId,
    examTitle,
    studentId: submission.studentId,
    studentName,
    status: 'AI_COMPLETE',
    totalMarks: graded.totalMarks,
    maxMarks,
    overallConfidence: conf,
    overallConfidenceLevel:
      conf >= 0.85 ? 'HIGH' : conf >= 0.6 ? 'MEDIUM' : 'LOW',
    flags: extraFlags,
    transcription: transcriptionOut,
    questions: graded.questions,
    aiGeneratedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as Evaluation;
}