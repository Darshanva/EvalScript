import { useState } from "react";
import axios from "axios";

export default function EvaluateUpload() {
  const [calibration, setCalibration] = useState<File | null>(null);
  const [pages, setPages] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!calibration || !pages || pages.length === 0) {
      setError("Calibration image and at least one answer page required");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("calibration", calibration);

      Array.from(pages).forEach((file) => {
        formData.append("pages", file);
      });

      const response = await axios.post(
        "https://evalscript-backend.onrender.com/api/evaluate",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(response.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Handwritten Exam Evaluation</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Calibration Upload */}
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

        {/* Answer Pages Upload */}
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
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Evaluating with Claude AI..." : "Start Evaluation"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="p-4 bg-green-50 rounded">
            <h2 className="text-xl font-semibold mb-2">
              Marks Awarded: {result.marks_awarded}
            </h2>
            <p>Confidence: {(result.confidence_score * 100).toFixed(1)}%</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Transcription:</h3>
            <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap text-sm">
              {result.transcription}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Detailed Evaluation:</h3>
            <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap text-sm">
              {JSON.stringify(result.evaluation, null, 2)}
            </pre>
          </div>

          {result.flagged_sections?.length > 0 && (
            <div className="p-4 bg-yellow-50 rounded">
              <h3 className="font-semibold mb-2">Flagged Sections:</h3>
              <pre className="text-sm">
                {JSON.stringify(result.flagged_sections, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}