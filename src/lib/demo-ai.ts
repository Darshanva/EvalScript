import type { Evaluation, EvaluationQuestion, Submission, Rubric, ConfidenceLevel, EvaluationFlag } from '../types';

function computeConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.9) return 'HIGH';
  if (score >= 0.75) return 'MEDIUM';
  return 'LOW';
}

function randomBetween(min: number, max: number, seed: number): number {
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function seededFloat(seed: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, randomBetween(min, max, seed)));
}

const SAMPLE_ANSWERS: Record<string, string[]> = {
  default: [
    'The student provided a comprehensive answer demonstrating solid understanding of the core concept.',
    'Answer addresses the main points but lacks depth in some areas.',
    'Partial answer — key elements are present but explanation is incomplete.',
    'Correct approach with minor computational errors.',
    'Demonstrates strong conceptual understanding with excellent examples.',
  ],
};

const FEEDBACK_TEMPLATES = [
  'Well-structured response demonstrating clear understanding.',
  'Good answer with room to expand on key concepts.',
  'Correct but overly brief — more explanation would strengthen the response.',
  'Solid understanding shown. Minor errors noted.',
  'Excellent response — comprehensive and well-explained.',
  'Partial credit awarded. The core concept is present but application needs work.',
];

export interface DemoEvaluationInput {
  submission: Submission;
  rubric: Rubric;
  examTitle: string;
  studentName: string;
}

export function runDemoEvaluation(input: DemoEvaluationInput): Evaluation {
  const { submission, rubric, examTitle, studentName } = input;
  const seed = submission.studentId.charCodeAt(submission.studentId.length - 1);

  const hasLowQualityImages = seed % 3 === 0;
  const hasDiagram = rubric.questions.some((q) =>
    q.questionText.toLowerCase().includes('draw') ||
    q.questionText.toLowerCase().includes('diagram')
  );

  const evaluatedQuestions: EvaluationQuestion[] = rubric.questions.map((rq, qi) => {
    const qSeed = seed + qi * 17;
    const confidence = seededFloat(qSeed + 1, hasLowQualityImages ? 0.6 : 0.75, 0.97);
    const flags: EvaluationFlag[] = [];

    if (confidence < 0.75) flags.push('UNCLEAR_HANDWRITING');
    if (hasLowQualityImages && qi === 0) flags.push('LOW_IMAGE_QUALITY');
    if (hasDiagram && qi === rubric.questions.length - 1) {
      flags.push('DIAGRAM_DETECTED');
      if (confidence < 0.85) flags.push('UNCLEAR_HANDWRITING');
    }
    if (rq.questionText.toLowerCase().includes('equation') || rq.questionText.includes('matrix')) {
      flags.push('EQUATION_DETECTED');
    }

    const criteriaScores = rq.criteria.map((criterion, ci) => {
      const cSeed = qSeed + ci * 7;
      const fraction = seededFloat(cSeed, 0.5, 1.0);
      const rawAwarded = fraction * criterion.maxMarks;
      const awarded = Math.min(criterion.maxMarks, Math.round(rawAwarded));
      return {
        criterionId: criterion.id,
        criterion: criterion.description,
        awarded,
        max: criterion.maxMarks,
      };
    });

    const totalAwarded = criteriaScores.reduce((sum, cs) => sum + cs.awarded, 0);
    const answerIdx = Math.abs(Math.floor(seededFloat(qSeed + 99) * SAMPLE_ANSWERS.default.length));
    const feedbackIdx = Math.abs(Math.floor(seededFloat(qSeed + 55) * FEEDBACK_TEMPLATES.length));

    return {
      id: `demo-eq-${submission.id}-${rq.id}`,
      questionNumber: rq.number,
      studentAnswer: SAMPLE_ANSWERS.default[answerIdx % SAMPLE_ANSWERS.default.length],
      answerSummary: `AI evaluation of question ${rq.number}. ${totalAwarded}/${rq.maxMarks} marks awarded based on rubric criteria.`,
      criteriaScores,
      totalAwarded,
      maxMarks: rq.maxMarks,
      feedback: FEEDBACK_TEMPLATES[feedbackIdx % FEEDBACK_TEMPLATES.length],
      confidence,
      confidenceLevel: computeConfidenceLevel(confidence),
      flags,
      pageStart: Math.max(1, qi + 1),
      pageEnd: Math.min(submission.pageCount, qi + 1),
    };
  });

  const totalMarks = evaluatedQuestions.reduce((sum, q) => sum + q.totalAwarded, 0);
  const maxMarks = rubric.questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const overallConf = evaluatedQuestions.reduce((sum, q) => sum + q.confidence, 0) / evaluatedQuestions.length;
  const allFlags = [...new Set(evaluatedQuestions.flatMap((q) => q.flags))];

  return {
    id: `eval-demo-${submission.id}`,
    submissionId: submission.id,
    studentId: submission.studentId,
    studentName,
    examId: submission.examId,
    examTitle,
    transcription: `[DEMO MODE] AI transcription for ${studentName}'s submission (${submission.pageCount} pages). Full transcription not available in demo mode — configure Groq API for real handwriting transcription.`,
    questions: evaluatedQuestions,
    totalMarks,
    maxMarks,
    overallConfidence: Math.round(overallConf * 100) / 100,
    overallConfidenceLevel: computeConfidenceLevel(overallConf),
    flags: allFlags as import('../types').EvaluationFlag[],
    status: 'AI_COMPLETE',
    aiGeneratedAt: new Date().toISOString(),
    version: 1,
  };
}
