import type { Evaluation } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEvaluation(evaluation: Evaluation): ValidationResult {
  const errors: string[] = [];

  if (evaluation.totalMarks > evaluation.maxMarks) {
    errors.push(
      `Total marks (${evaluation.totalMarks}) exceeds maximum (${evaluation.maxMarks}).`
    );
  }

  for (const question of evaluation.questions) {
    if (question.totalAwarded > question.maxMarks) {
      errors.push(
        `Q${question.questionNumber}: awarded ${question.totalAwarded} but max is ${question.maxMarks}.`
      );
    }

    for (const cs of question.criteriaScores) {
      if (cs.awarded > cs.max) {
        errors.push(
          `Q${question.questionNumber} criterion "${cs.criterion}": awarded ${cs.awarded} but max is ${cs.max}.`
        );
      }
      if (cs.awarded < 0) {
        errors.push(
          `Q${question.questionNumber} criterion "${cs.criterion}": negative marks not allowed.`
        );
      }
    }

    const criteriaTotal = question.criteriaScores.reduce((sum, cs) => sum + cs.awarded, 0);
    if (criteriaTotal !== question.totalAwarded) {
      errors.push(
        `Q${question.questionNumber}: criteria total (${criteriaTotal}) does not match question total (${question.totalAwarded}).`
      );
    }
  }

  const questionsTotal = evaluation.questions.reduce((sum, q) => sum + q.totalAwarded, 0);
  if (questionsTotal !== evaluation.totalMarks) {
    errors.push(
      `Sum of question marks (${questionsTotal}) does not match evaluation total (${evaluation.totalMarks}).`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateFacultyMarks(
  awarded: number,
  max: number,
  label: string
): string | null {
  if (isNaN(awarded)) return `${label}: Please enter a valid number.`;
  if (awarded < 0) return `${label}: Marks cannot be negative.`;
  if (awarded > max) return `${label}: Cannot exceed maximum of ${max}.`;
  return null;
}
