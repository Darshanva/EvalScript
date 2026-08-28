import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, Spinner } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { runCalibrationAnalysis } from '../../lib/calibration-ai';
import { CALIBRATION_PASSAGE } from '../../lib/seed-data';
import type { CalibrationSample } from '../../types';

type Pace = 'slow' | 'medium' | 'fast';

const PACE_META: { key: Pace; title: string; hint: string }[] = [
  {
    key: 'slow',
    title: '1 · Slow',
    hint: 'Copy the reference carefully and slowly, as neatly as you can.',
  },
  {
    key: 'medium',
    title: '2 · Medium',
    hint: 'Copy at your normal natural exam pace.',
  },
  {
    key: 'fast',
    title: '3 · Fast',
    hint: 'Copy quickly, as under time pressure.',
  },
];

function genId() {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function uploadCalFile(
  file: File,
  studentId: string,
  pace: Pace
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `calibration/${studentId}/${pace}-${Date.now()}.${ext}`;

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

  const [urls, setUrls] = useState<Record<Pace, string | null>>({
    slow: existing?.imageUrls?.slow || null,
    medium: existing?.imageUrls?.medium || null,
    fast: existing?.imageUrls?.fast || null,
  });
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

  const inputRefs = {
    slow: useRef<HTMLInputElement>(null),
    medium: useRef<HTMLInputElement>(null),
    fast: useRef<HTMLInputElement>(null),
  };

  if (!user) return null;

  const allReady = !!(urls.slow && urls.medium && urls.fast);

  async function onPick(pace: Pace, list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Image only', 'error');
      return;
    }

    const local = URL.createObjectURL(file);
    setUrls((u) => ({ ...u, [pace]: local }));
    setResult(null);

    try {
      const publicUrl = await uploadCalFile(file, user!.id, pace);
      setUrls((u) => ({ ...u, [pace]: publicUrl }));
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

  function clearPace(pace: Pace) {
    const prev = urls[pace];
    if (prev?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        /* ignore */
      }
    }
    setUrls((u) => ({ ...u, [pace]: null }));
    setResult(null);
  }

  async function runAnalysis() {
    if (!allReady) {
      showToast('Upload all 3 samples (slow, medium, fast)', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const analysis = await runCalibrationAnalysis({
        slowUrl: urls.slow!,
        mediumUrl: urls.medium!,
        fastUrl: urls.fast!,
        studentName: user!.name,
      });

      const sample: CalibrationSample = {
        id: existing?.id || genId(),
        studentId: user!.id,
        imageUrl: urls.slow!,
        imageUrls: {
          slow: urls.slow!,
          medium: urls.medium!,
          fast: urls.fast!,
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
        subtitle="Copy the reference text three times (slow, medium, fast), then upload photos."
        breadcrumb="Student Portal"
      />

      {/* ——— Reference passage (what to write) ——— */}
      <Card className="mb-6 border-2 border-navy-200 bg-navy-50/40">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-navy-900 text-sm">
              Reference — write this on paper
            </h3>
            <p className="text-xs text-navy-700 mt-1">
              Use plain paper and a pen. Write the full passage once for each pace
              (slow / medium / fast), then photograph each sheet.
            </p>
          </div>
          <Badge variant="navy">Sample</Badge>
        </div>
        <div className="rounded-xl bg-white border border-navy-100 p-4 sm:p-5">
          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
            {CALIBRATION_PASSAGE}
          </pre>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {PACE_META.map((p) => (
          <Card key={p.key} className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-slate-900">{p.title}</h3>
              {urls[p.key] && <Badge variant="success">Ready</Badge>}
            </div>
            <p className="text-xs text-slate-500 mb-3">{p.hint}</p>

            {urls[p.key] ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white aspect-[3/4] mb-3">
                <img
                  src={urls[p.key]!}
                  alt={p.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRefs[p.key].current?.click()}
                className="aspect-[3/4] mb-3 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-navy-400 hover:bg-slate-50"
              >
                <span className="text-2xl mb-1">↑</span>
                <span className="text-xs text-center px-2">
                  Photo of your {p.key} writing
                </span>
              </button>
            )}

            <input
              ref={inputRefs[p.key]}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPick(p.key, e.target.files)}
            />

            <div className="flex gap-2 mt-auto">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => inputRefs[p.key].current?.click()}
              >
                {urls[p.key] ? 'Replace' : 'Upload'}
              </Button>
              {urls[p.key] && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => clearPace(p.key)}
                >
                  ✕
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button
          loading={analyzing}
          disabled={!allReady || analyzing}
          onClick={runAnalysis}
        >
          {analyzing ? 'AI analysing…' : 'Analyse handwriting'}
        </Button>
        {(user.calibrated || result) && (
          <Badge variant="success">Calibrated</Badge>
        )}
      </div>

      {analyzing && (
        <Card className="mb-6 flex items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-slate-600">
            Transcribing samples and scoring handwriting quality…
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