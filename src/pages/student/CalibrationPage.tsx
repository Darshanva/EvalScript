import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, Spinner } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { runCalibrationAnalysis } from '../../lib/calibration-ai';
import { CALIBRATION_PASSAGE } from '../../lib/seed-data';
import type { CalibrationSample } from '../../types';

function genId() {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function uploadCalFile(file: File, studentId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `calibration/${studentId}/sample-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('answer-scripts')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.warn('storage failed, blob URL', error);
    return URL.createObjectURL(file);
  }

  const { data } = supabase.storage.from('answer-scripts').getPublicUrl(path);
  if (
    !data.publicUrl ||
    data.publicUrl.includes('unsplash') ||
    data.publicUrl.includes('placeholder')
  ) {
    return URL.createObjectURL(file);
  }
  return data.publicUrl;
}

export default function CalibrationPage() {
  const navigate = useNavigate();
  const { state, addCalibration, showToast } = useApp();
  const user = state.currentUser;

  const existing = user
    ? state.calibrations.find((c) => c.studentId === user.id)
    : undefined;

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existing?.imageUrl || existing?.imageUrls?.slow || null
  );
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    qualityScore: number;
    feedback: string;
    transcription: string;
    strengths: string[];
    improvements: string[];
    paceNotes: { slow: string; medium: string; fast: string };
  } | null>(
    existing?.qualityScore != null
      ? {
          qualityScore: existing.qualityScore,
          feedback: existing.feedback || '',
          transcription: existing.transcription || '',
          strengths: existing.strengths || [],
          improvements: existing.improvements || [],
          paceNotes: { slow: '', medium: '', fast: '' },
        }
      : null
  );

  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function onPick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Image only', 'error');
      return;
    }

    if (previewUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        /* ignore */
      }
    }

    const local = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(local);
    setResult(null);

    try {
      const publicUrl = await uploadCalFile(f, user!.id);
      setPreviewUrl(publicUrl);
      if (publicUrl !== local) {
        try {
          URL.revokeObjectURL(local);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* keep local */
    }
  }

  function clearSample() {
    if (previewUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        /* ignore */
      }
    }
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function runAnalysis() {
    if (!previewUrl) {
      showToast('Upload your calibration page first', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const analysis = await runCalibrationAnalysis({
        imageUrl: previewUrl,
        studentName: user!.name,
      });

      const sample: CalibrationSample = {
        id: existing?.id || genId(),
        studentId: user!.id,
        imageUrl: previewUrl,
        imageUrls: {
          slow: previewUrl,
          medium: previewUrl,
          fast: previewUrl,
        },
        qualityScore: analysis.qualityScore,
        feedback: analysis.feedback,
        transcription: analysis.transcription,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        createdAt: new Date().toISOString(),
      };

      addCalibration(sample);

      await supabase
        .from('profiles')
        .update({ calibrated: true })
        .eq('id', user!.id);

      setResult({
        qualityScore: analysis.qualityScore,
        feedback: analysis.feedback,
        transcription: analysis.transcription,
        strengths: analysis.strengths,
        improvements: analysis.improvements,
        paceNotes: analysis.paceNotes,
      });
      showToast(`Handwriting score: ${analysis.qualityScore}%`, 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Handwriting Calibration"
        subtitle="Write slow, medium, and fast on ONE page under clear headings, then upload a photo."
        breadcrumb="Student Portal"
      />

      {/* Reference + how to layout the page */}
      <Card className="mb-6 border-2 border-navy-200 bg-navy-50/40">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-navy-900 text-sm">
              Reference — write this on paper
            </h3>
            <p className="text-xs text-navy-700 mt-1">
              Use one plain sheet. Write the full passage three times with these
              headings: <strong>SLOW</strong>, <strong>MEDIUM</strong>,{' '}
              <strong>FAST</strong>. Then photograph the whole page.
            </p>
          </div>
          <Badge variant="navy">Sample</Badge>
        </div>

        <div className="rounded-xl bg-white border border-navy-100 p-4 sm:p-5 mb-4">
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
            {CALIBRATION_PASSAGE}
          </pre>
        </div>

        <div className="rounded-xl bg-white border border-dashed border-navy-200 p-4 text-sm text-slate-700 space-y-2">
          <p className="font-medium text-slate-900">Page layout example</p>
          <p>
            <strong>SLOW</strong> — copy the passage carefully and neatly
          </p>
          <p>
            <strong>MEDIUM</strong> — copy at your normal exam pace
          </p>
          <p>
            <strong>FAST</strong> — copy quickly, as under time pressure
          </p>
        </div>
      </Card>

      {/* Single upload */}
      <Card className="mb-6 max-w-xl">
        <h3 className="font-semibold text-slate-900 text-sm mb-1">
          Upload calibration page
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          One image only — your real photo, not a demo image.
        </p>

        {previewUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white mb-4">
            <img
              src={previewUrl}
              alt="Calibration sample"
              className="w-full max-h-[420px] object-contain"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-[4/3] mb-4 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-navy-400 hover:bg-slate-50"
          >
            <span className="text-3xl mb-2">↑</span>
            <span className="text-sm">Photo of your one page</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? 'Replace photo' : 'Upload photo'}
          </Button>
          {previewUrl && (
            <Button variant="ghost" className="text-red-600" onClick={clearSample}>
              Clear
            </Button>
          )}
          <Button
            loading={analyzing}
            disabled={!previewUrl || analyzing}
            onClick={runAnalysis}
          >
            {analyzing ? 'AI analysing…' : 'Analyse handwriting'}
          </Button>
        </div>
      </Card>

      {analyzing && (
        <Card className="mb-6 flex items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-slate-600">
            Transcribing page and scoring slow / medium / fast sections…
          </p>
        </Card>
      )}

      {result && (
        <div className="space-y-4 max-w-3xl">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Overall score</h3>
              <span className="text-3xl font-bold text-navy-800">
                {result.qualityScore}
                <span className="text-lg text-slate-500">%</span>
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy-600 rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, result.qualityScore))}%`,
                }}
              />
            </div>
            <p className="text-sm text-slate-600 mt-4">{result.feedback}</p>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <h4 className="font-semibold text-sm text-emerald-800 mb-2">
                Strengths
              </h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc pl-4">
                {result.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h4 className="font-semibold text-sm text-amber-800 mb-2">
                Improve
              </h4>
              <ul className="text-sm text-slate-700 space-y-1 list-disc pl-4">
                {result.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>
          </div>

          {(result.paceNotes.slow ||
            result.paceNotes.medium ||
            result.paceNotes.fast) && (
            <Card>
              <h4 className="font-semibold text-sm mb-2">By pace</h4>
              <div className="space-y-2 text-sm text-slate-600">
                {result.paceNotes.slow && (
                  <p>
                    <strong>Slow:</strong> {result.paceNotes.slow}
                  </p>
                )}
                {result.paceNotes.medium && (
                  <p>
                    <strong>Medium:</strong> {result.paceNotes.medium}
                  </p>
                )}
                {result.paceNotes.fast && (
                  <p>
                    <strong>Fast:</strong> {result.paceNotes.fast}
                  </p>
                )}
              </div>
            </Card>
          )}

          {result.transcription && (
            <Card>
              <h4 className="font-semibold text-sm mb-2">Transcription notes</h4>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                {result.transcription}
              </pre>
            </Card>
          )}

          <Button onClick={() => navigate('/student')}>Go to Dashboard</Button>
        </div>
      )}
    </PageContainer>
  );
}