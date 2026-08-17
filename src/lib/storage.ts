import { supabase } from './supabase';

const ANSWER_BUCKET = 'answer-scripts';
const CALIBRATION_BUCKET = 'calibrations';

/**
 * Upload one answer script page
 */
export async function uploadAnswerPage(
  file: File,
  submissionId: string,
  pageNumber: number
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${submissionId}/page-${pageNumber}.${fileExt}`;

  const { error } = await supabase.storage
    .from(ANSWER_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error.message);
    throw error;
  }

  const { data } = supabase.storage
    .from(ANSWER_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Upload multiple pages of a submission
 */
export async function uploadSubmissionPages(
  files: File[],
  submissionId: string
) {
  const pages = [];

  for (let i = 0; i < files.length; i++) {
    const pageNumber = i + 1;
    const imageUrl = await uploadAnswerPage(files[i], submissionId, pageNumber);

    pages.push({
      id: `page-${submissionId}-${pageNumber}`,
      pageNumber,
      imageUrl,
      thumbnailUrl: imageUrl, // later thumbnail generate cheyochu
    });
  }

  return pages;
}

/**
 * Upload calibration sample
 */
export async function uploadCalibrationImage(
  file: File,
  studentId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${studentId}/calibration.${fileExt}`;

  const { error } = await supabase.storage
    .from(CALIBRATION_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(CALIBRATION_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}