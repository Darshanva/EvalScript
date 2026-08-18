import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Spinner, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { CALIBRATION_PASSAGE } from '../../lib/seed-data';
import type { CalibrationSample } from '../../types';

type Step = 'instructions' | 'upload' | 'preview' | 'confirm';

const SAMPLE_CALIBRATION_IMAGE =
  'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=800&h=600&fit=crop&auto=format';

export default function CalibrationPage() {
  const { state, navigate, addCalibration, showToast, getCalibrationForStudent } = useApp();
  const { currentUser } = state;
  const [step, setStep] = useState<Step>('instructions');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [qualityScore] = useState(0.87);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;
  const existingCalibration = getCalibrationForStudent(currentUser.id);

  function simulateUpload(_file: File | null) {
    setUploading(true);
    setTimeout(() => {
      setPreviewUrl(SAMPLE_CALIBRATION_IMAGE);
      setUploading(false);
      setStep('preview');
    }, 1800);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    simulateUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) simulateUpload(file);
  }

  function handleConfirm() {
    if (!currentUser) return;
    setAnalysing(true);
    setTimeout(() => {
      const sample: CalibrationSample = {
        id: `cal-${currentUser!.id}-${Date.now()}`,
        studentId: currentUser!.id,
        imageUrl: SAMPLE_CALIBRATION_IMAGE,
        uploadedAt: new Date().toISOString(),
        qualityScore,
        status: 'APPROVED',
      };
      addCalibration(sample);
      showToast('Calibration uploaded successfully. You can now submit exams.', 'success');
      setAnalysing(false);
      navigate('s-dashboard');
    }, 2000);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Handwriting Calibration"
        subtitle="A one-time sample to help the AI read your handwriting more accurately."
        breadcrumb="Student Portal"
      />

      {existingCalibration && (
        <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <span className="text-emerald-500">✓</span>
          <div>
            <p className="text-sm font-medium text-emerald-800">Calibration on record</p>
            <p className="text-xs text-emerald-600">
              Quality: {Math.round(existingCalibration.qualityScore * 100)}% · You can retake
              at any time.
            </p>
          </div>
        </div>
      )}

      {/* Step: Instructions */}
      {step === 'instructions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="mb-5">
              <h3 className="font-semibold text-slate-900 mb-3">Why calibrate?</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                The AI uses your calibration sample as a visual reference when transcribing
                your exam answers. It learns the shapes of your letters and numbers, improving
                transcription accuracy — especially for ambiguous characters like 1 vs l, 0 vs O,
                or cursive joins.
              </p>
              <ul className="space-y-2">
                {[
                  'Write naturally — do not alter your handwriting',
                  'Use the same pen/pencil you will use in exams',
                  'Write on plain A4 white paper',
                  'Photograph in good lighting, keep the camera flat',
                  'Accepted formats: JPG, PNG, PDF (single page)',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-navy-600 mt-0.5 shrink-0">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>
            <Button onClick={() => setStep('upload')}>
              Begin Calibration →
            </Button>
          </div>

          <Card className="bg-navy-50 border-navy-200">
            <h3 className="font-semibold text-navy-900 mb-3 text-sm">Reference passage to write</h3>
            <p className="text-xs font-mono text-navy-800 leading-relaxed whitespace-pre-wrap bg-white/60 rounded-lg p-4 border border-navy-200">
              {CALIBRATION_PASSAGE}
            </p>
          </Card>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="max-w-xl">
          <Card className="bg-navy-50 border-navy-200 mb-5 text-sm text-navy-800">
            <p>
              Write the reference passage shown in the instructions, then photograph or scan it and
              upload the image below.
            </p>
          </Card>

          {uploading ? (
            <Card className="flex flex-col items-center justify-center py-16 gap-4">
              <Spinner size="lg" />
              <p className="text-sm text-slate-600">Uploading your calibration sample…</p>
            </Card>
          ) : (
            <div
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${dragging ? 'border-navy-500 bg-navy-50' : 'border-slate-300 bg-white hover:border-navy-400 hover:bg-slate-50'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center text-navy-500 text-3xl border border-navy-200">
                ↑
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-800">Drop your file here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                <p className="text-xs text-slate-400 mt-2">JPG, PNG, PDF · max 10MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Button variant="ghost" onClick={() => setStep('instructions')}>
              ← Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => simulateUpload(null)}
            >
              Use demo image
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && previewUrl && (
        <div className="max-w-2xl">
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Preview your calibration sample</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Quality:</span>
                <Badge variant={qualityScore >= 0.8 ? 'success' : 'warning'}>
                  {Math.round(qualityScore * 100)}%
                </Badge>
              </div>
            </div>
            <img
              src={previewUrl}
              alt="Calibration preview"
              className="w-full rounded-xl border border-slate-200 object-cover"
              style={{ maxHeight: 400 }}
            />
            {qualityScore < 0.75 && (
              <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Low quality detected.</span> Consider retaking in
                  better lighting or ensuring the image is in focus.
                </p>
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              ← Retake
            </Button>
            <Button onClick={() => setStep('confirm')}>
              Confirm sample →
            </Button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="max-w-xl">
          <Card className="mb-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-xl">
                ✓
              </div>
              <div>
                <p className="font-semibold text-slate-900">Ready to submit</p>
                <p className="text-sm text-slate-500">
                  Your calibration sample will be stored securely.
                </p>
              </div>
            </div>
            <ul className="space-y-2 mb-5">
              {[
                'This sample will be used as a visual reference during AI transcription.',
                'It is NOT used to train any AI model.',
                'You may retake this calibration at any time.',
                'Your original sample is stored privately and is never shared.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-navy-500 mt-0.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
            {analysing ? (
              <div className="flex items-center gap-3 py-3">
                <Spinner />
                <span className="text-sm text-slate-600">Analysing and storing your calibration…</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep('preview')}>
                  ← Back
                </Button>
                <Button onClick={handleConfirm}>
                  Submit Calibration
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
