import axios from 'axios';
import type { Submission, Rubric, Evaluation } from '../types';
import { runDemoEvaluation } from './demo-ai';

const CLAUDE_EVAL_URL =
  import.meta.env.VITE_CLAUDE_EVAL_URL ||
  'https://evalscript-backend.onrender.com/api/evaluate';

export async function runClaudeEvaluation(params: {
  submission: Submission;
  rubric: Rubric;
  examTitle: string;
  studentName: string;
  calibrationImageUrl?: string;
}): Promise<Evaluation> {
  const { submission, rubric, examTitle, studentName, calibrationImageUrl } =
    params;

  const pageUrls = (submission.pages || [])
    .map((p: any) => p.imageUrl || p.thumbnailUrl || p.url)
    .filter(Boolean);

  if (pageUrls.length === 0) {
    return runDemoEvaluation({
      submission,
      rubric,
      examTitle,
      studentName,
    });
  }

  try {
    const { data } = await axios.post(
      CLAUDE_EVAL_URL,
      {
        mode: 'claude',
        studentName,
        examTitle,
        rubric,
        pageUrls,
        calibrationImageUrl: calibrationImageUrl || null,
        submissionId: submission.id,
        examId: submission.examId,
        studentId: submission.studentId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );

    const confidence = data.confidence_score ?? data.confidence ?? 0.75;
    const maxFromRubric =
      rubric.questions?.reduce((s, q) => s + (q.maxMarks || 0), 0) || 100;

    const evaluation: Evaluation = {
      id: data.id || `eval-${Date.now()}`,
      submissionId: submission.id,
      studentId: submission.studentId,
      studentName,
      examId: submission.examId,
      examTitle,
      totalMarks: data.marks_awarded ?? data.totalMarks ?? 0,
      maxMarks: data.max_marks ?? data.maxMarks ?? maxFromRubric,
      status: 'AI_COMPLETE',
      overallConfidence: confidence,
      overallConfidenceLevel:
        confidence >= 0.9 ? 'HIGH' : confidence >= 0.75 ? 'MEDIUM' : 'LOW',
      transcription: data.transcription || '',
      evaluation: data.evaluation || data.detailed || null,
      flags: data.flagged_sections || data.flags || [],
      questionResults: data.questionResults || data.questions || [],
      aiGeneratedAt: new Date().toISOString(),
      facultyTotalMarks: undefined,
      facultyId: undefined,
      facultyName: undefined,
      facultyNotes: undefined,
      facultyReviewedAt: undefined,
      publishedAt: undefined,
    };

    return evaluation;
  } catch (err) {
    console.error('Claude evaluation failed → demo fallback', err);
    return runDemoEvaluation({
      submission,
      rubric,
      examTitle,
      studentName,
    });
  }
}