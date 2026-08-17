import { useState } from "react";
import { useApp } from "../context/AppContext"; // path correct ga undali
import { uploadAnswerPage, uploadCalibrationImage } from "../lib/storage";
import type { Submission } from "../types";

export default function EvaluateUpload() {
  const { state, submitExam, addCalibration, processEvaluation, showToast } = useApp();
  const [calibration, setCalibration] = useState<File | null>(null);
  const [pages, setPages] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.currentUser || state.currentUser.role !== "student") {
      setError("Please login as a student to submit");
      return;
    }

    if (!calibration || !pages || pages.length === 0) {
      setError("Calibration image and at least one answer page required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const studentId = state.currentUser.id;
      const submissionId = `sub-${Date.now()}`;

      // 1. Upload calibration
      const calibrationUrl = await uploadCalibrationImage(calibration, studentId);

      addCalibration({
        id: `cal-${Date.now()}`,
        studentId,
        imageUrl: calibrationUrl,
        uploadedAt: new Date().toISOString(),
        qualityScore: 0.9,
        status: "APPROVED",
      });

      // 2. Upload all answer pages
      const uploadedPages = [];
      for (let i = 0; i < pages.length; i++) {
        const pageNumber = i + 1;
        const imageUrl = await uploadAnswerPage(pages[i], submissionId, pageNumber);

        uploadedPages.push({
          id: `page-${submissionId}-${pageNumber}`,
          pageNumber,
          imageUrl,
          thumbnailUrl: imageUrl,
        });
      }

      // 3. Create real Submission
      const newSubmission: Submission = {
        id: submissionId,
        studentId,
        studentName: state.currentUser.name,
        examId: "exam-001", // temporary - later exam select cheyinchali
        submittedAt: new Date().toISOString(),
        pages: uploadedPages,
        status: "SUBMITTED",
        pageCount: uploadedPages.length,
      };

      // 4. Add to App state
      submitExam(newSubmission);

      // 5. Optionally trigger AI evaluation (demo)
      // processEvaluation(submissionId);

      showToast("Submission uploaded successfully with real images!", "success");
      
      // Reset form
      setCalibration(null);
      setPages(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
      showToast("Upload failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Handwritten Exam Evaluation</h1>

      {!state.currentUser && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded">
          Please login as a student first (e.g. alice.johnson@student.edu / demo123)
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-medium mb-2">
            1. Upload Handwriting Calibration Sample
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCalibration(e.target.files?.[0] || null)}
            className="block w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block font-medium mb-2">
            2. Upload Answer Script Pages (multiple allowed)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPages(e.target.files)}
            className="block w-full border rounded p-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !state.currentUser}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Uploading to Supabase..." : "Submit Answer Script"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>
      )}
    </div>
  );
}