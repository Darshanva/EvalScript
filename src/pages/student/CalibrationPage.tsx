import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, Spinner } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { runCalibrationAnalysis } from '../../lib/calibration-ai';
import { CALIBRATION_PASSAGE } from '../../lib/seed-data';
import type { CalibrationSample } from '../../types';

const BUCKET = 'calibrations'; // your PUBLIC bucket

function genId() {
  return `cal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function testImageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    setTimeout(() => resolve(false), 8000);
  });
}

async function uploadCalFile(
  file: File,
  studentId: string
): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${studentId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });

  if (error) {
    console.error('calibration upload error', error);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) return null;

  const ok = await testImageLoads(url);
  if (!ok) {
    console.error('public URL did not load image', url);
    return null;
  }
  return url;
}

/** File → data URL for Claude when only blob exists */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CalibrationPage() {
  const navigate = useNavigate();
  const { state, addCalibration, showToast } = useApp();
  const user = state.currentUser;

  const existing = user
    ? state.calibrations.find((c) => c.studentId === user.id)
    : undefined;

  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    qualityScore: number;
    feedback: string;
    transcription: string;
    strengths: string[];
    improvements: string[];
    paceNotes: { slow: string; medium: string; fast: string };
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const blobRef = useRef<string | null>(null);

  // Restore score + try cloud image (only if it loads)
  useEffect(() => {
    if (!user) return;
    const cal = state.calibrations.find((c) => c.studentId === user.id);
    if (!cal) return;

    if (cal.qualityScore != null) {
      setResult({
        qualityScore: cal.qualityScore,
        feedback: cal.feedback || '',
        transcription: cal.transcription || '',
        strengths: cal.strengths || [],
        improvements: cal.improvements || [],
        paceNotes: { slow: '', medium: '', fast: '' },
      });
    }

    const raw = cal.imageUrl || cal.imageUrls?.slow;
    if (!raw || raw.startsWith('blob:')) return;

    let cancelled = false;
    (async () => {
      const ok = await testImageLoads(raw);
      if (!cancelled && ok) {
        setCloudUrl(raw);
        setDisplayUrl(raw);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, state.calibrations]);

  useEffect(() => {
    return () => {
      if (blobRef.current?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(blobRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  if (!user) return null;

  async function onPick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Please choose an image file', 'error');
      return;
    }

    if (blobRef.current?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(blobRef.current);
      } catch {
        /* ignore */
      }
    }

    const local = URL.createObjectURL(f);
    blobRef.current = local;
    setFile(f);
    setDisplayUrl(local); // ALWAYS show local photo first
    setCloudUrl(null);
    setResult(null);
    setUploading(true);

    try {
      const publicUrl = await uploadCalFile(f, user!.id);
      if (publicUrl) {
        setCloudUrl(publicUrl);
        // Keep showing blob (reliable). Cloud URL saved for DB + AI.
        showToast('Saved to cloud', 'success');
      } else {
        showToast(
          'Cloud save failed — photo still visible locally. Check bucket name: calibrations',
          'error'
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function clearSample() {
    if (blobRef.current?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(blobRef.current);
      } catch {
        /* ignore */
      }
    }
    blobRef.current = null;
    setFile(null);
    setDisplayUrl(null);
    setCloudUrl(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function runAnalysis() {
    if (!displayUrl && !file) {
      showToast('Upload your calibration page first', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      let imageForAi = cloudUrl || displayUrl!;

      // Claude cannot fetch blob: — send data URL
      if (imageForAi.startsWith('blob:') && file) {
        imageForAi = await fileToDataUrl(file);
      }

      const analysis = await runCalibrationAnalysis({
        imageUrl: imageForAi,
        studentName: user!.name,
      });

      const savedUrl = cloudUrl || displayUrl!;

      const sample: CalibrationSample = {
        id: existing?.id || genId(),
        studentId: user!.id,
        imageUrl: savedUrl,
        imageUrls: {
          slow: savedUrl,
          medium: savedUrl,
          fast: savedUrl,
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

      // Never clear displayUrl
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
        subtitle="Write SLOW / MEDIUM / FAST on one page, then upload the photo."
        breadcrumb="Student Portal"
      />

      <Card className="mb-6 border-2 border-navy-200 bg-navy-50/40">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-navy-900 text-sm">
              Reference — write this on paper
            </h3>
            <p className="text-xs text-navy-700 mt-1">
              One sheet · headings <strong>SLOW</strong>, <strong>MEDIUM</strong>
              , <strong>FAST</strong>
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
            <strong>SLOW</strong> — carefully and neatly
          </p>
          <p>
            <strong>MEDIUM</strong> — normal exam pace
          </p>
          <p>
            <strong>FAST</strong> — under time pressure
          </p>
        </div>
      </Card>

      <Card className="mb-6 max-w-xl">
        <h3 className="font-semibold text-slate-900 text-sm mb-1">
          Upload calibration page
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Photo stays on screen after analyse. Cloud bucket: <code>{BUCKET}</code>
        </p>

        {displayUrl ? (
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 mb-4">
            <img
              src={displayUrl}
              alt="Calibration"
              className="w-full max-h-[480px] object-contain block mx-auto"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full aspect-[4/3] mb-4 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-navy-400 hover:bg-slate-50"
          >
            <span className="text-3xl mb-2">↑</span>
            <span className="text-sm">Tap to take / choose photo</span>
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
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {displayUrl ? 'Replace photo' : 'Upload photo'}
          </Button>
          {displayUrl && (
            <Button variant="ghost" className="text-red-600" onClick={clearSample}>
              Clear
            </Button>
          )}
          <Button
            loading={analyzing}
            disabled={!displayUrl || analyzing || uploading}
            onClick={runAnalysis}
          >
            {analyzing ? 'AI analysing…' : 'Analyse handwriting'}
          </Button>
        </div>
        {cloudUrl && (
          <p className="text-xs text-emerald-600 mt-2">✓ Stored in Supabase</p>
        )}
      </Card>

      {analyzing && (
        <Card className="mb-6 flex items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-slate-600">Analysing handwriting…</p>
        </Card>
      )}

      {result && (
        <div className="space-y-4 max-w-3xl">
          {displayUrl && (
            <Card className="overflow-hidden p-0">
              <p className="text-xs font-medium text-slate-500 px-4 pt-3">
                Your uploaded page
              </p>
              <img
                src={displayUrl}
                alt="Uploaded page"
                className="w-full max-h-[360px] object-contain bg-slate-50"
              />
            </Card>
          )}

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