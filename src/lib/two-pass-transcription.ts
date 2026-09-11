import { createClaudeClient, getClaudeModel } from './claude-client';

export interface FlaggedUncertainty {
  guess: string;
  ambiguity_note: string;
  location: string;
}

export interface ResolvedUncertainty {
  location: string;
  final_answer: string;
  resolved_via: 'calibration' | 'unresolved_kept_original';
}

export interface TwoPassResult {
  fullTranscription: string;
  flaggedUncertainties: FlaggedUncertainty[];
  resolvedUncertainties: ResolvedUncertainty[];
  pass2Ran: boolean;
}

async function urlToBase64(
  url: string
): Promise<{ mediaType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mediaType = blob.type || 'image/jpeg';
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mediaType, data: btoa(binary) };
  } catch (e) {
    console.error('urlToBase64', e);
    return null;
  }
}

function parseJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in model response');
  return JSON.parse(match[0]);
}

async function loadAnswerImages(
  pages: { pageNumber?: number; imageUrl?: string; thumbnailUrl?: string }[]
): Promise<{ mediaType: string; data: string; label: string }[]> {
  const sorted = [...pages].sort(
    (a, b) => (a.pageNumber || 0) - (b.pageNumber || 0)
  );
  const out: { mediaType: string; data: string; label: string }[] = [];
  for (const page of sorted) {
    const url = page.imageUrl || page.thumbnailUrl;
    if (
      !url ||
      url.startsWith('blob:') ||
      url.includes('unsplash') ||
      url.includes('placeholder')
    ) {
      continue;
    }
    const b64 = await urlToBase64(url);
    if (b64) {
      out.push({
        ...b64,
        label: `Answer page ${page.pageNumber ?? out.length + 1}`,
      });
    }
  }
  return out.slice(0, 20);
}

async function runPass1(
  answerImages: { mediaType: string; data: string; label: string }[],
  examTitle: string
): Promise<{
  full_transcription: string;
  flagged_uncertainties: FlaggedUncertainty[];
}> {
  const client = createClaudeClient();
  if (!client) throw new Error('Claude API key not configured');

  const prompt = `You are transcribing a handwritten exam answer script. You see ONLY the answer page image(s). Do not assume handwriting style in advance.

Exam context: ${examTitle}

Instructions:
1. Transcribe the full text using context (vocabulary, grammar, subject logic).
2. Best-confidence full transcription.
3. List ONLY genuine low-confidence words/phrases (two readings plausible). For each:
   - guess, ambiguity_note, location
4. Do NOT flag words you are confident about.

Return ONLY JSON:
{
  "full_transcription": "complete text",
  "flagged_uncertainties": [
    { "guess": "...", "ambiguity_note": "...", "location": "..." }
  ]
}`;

  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of answerImages) {
    content.push({ type: 'text', text: img.label });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.data,
      },
    });
  }

  const msg = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const parsed = parseJson(text);
  return {
    full_transcription: String(parsed.full_transcription || ''),
    flagged_uncertainties: Array.isArray(parsed.flagged_uncertainties)
      ? parsed.flagged_uncertainties
      : [],
  };
}

async function runPass2(
  answerImages: { mediaType: string; data: string; label: string }[],
  calibrationB64: { mediaType: string; data: string },
  flagged: FlaggedUncertainty[]
): Promise<ResolvedUncertainty[]> {
  const client = createClaudeClient();
  if (!client) throw new Error('Claude API key not configured');

  const prompt = `You previously transcribed a script and flagged uncertain words. Use the calibration sample (student's handwriting) to resolve ONLY flagged items.

Flagged items:
${JSON.stringify(flagged, null, 2)}

Rules:
1. Do NOT revise non-flagged text.
2. For each flagged item, compare letter shapes to calibration.
3. If calibration does not resolve it, keep original guess.
4. Return only updates.

JSON only:
{
  "resolved_uncertainties": [
    {
      "location": "...",
      "final_answer": "...",
      "resolved_via": "calibration" | "unresolved_kept_original"
    }
  ]
}`;

  const content: any[] = [
    { type: 'text', text: prompt },
    { type: 'text', text: 'CALIBRATION SAMPLE (handwriting reference):' },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: calibrationB64.mediaType,
        data: calibrationB64.data,
      },
    },
  ];

  for (const img of answerImages.slice(0, 10)) {
    content.push({ type: 'text', text: img.label });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.data,
      },
    });
  }

  const msg = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 2000,
    temperature: 0,
    messages: [{ role: 'user', content }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const parsed = parseJson(text);
  return Array.isArray(parsed.resolved_uncertainties)
    ? parsed.resolved_uncertainties
    : [];
}

function mergeTranscription(
  full: string,
  flagged: FlaggedUncertainty[],
  resolved: ResolvedUncertainty[]
): string {
  let text = full;
  for (const r of resolved) {
    const flag = flagged.find(
      (f) =>
        f.location === r.location ||
        (r.location && f.location && r.location.includes(f.location))
    );
    const from = flag?.guess;
    if (from && r.final_answer && from !== r.final_answer) {
      text = text.replace(from, r.final_answer);
    }
  }
  return text;
}

export async function runTwoPassTranscription(input: {
  pages: { pageNumber?: number; imageUrl?: string; thumbnailUrl?: string }[];
  examTitle: string;
  calibrationImageUrl?: string;
}): Promise<TwoPassResult> {
  const answerImages = await loadAnswerImages(input.pages || []);
  if (answerImages.length === 0) {
    throw new Error('No readable answer page images');
  }

  console.log('[two-pass] Pass 1 pages=', answerImages.length);
  const pass1 = await runPass1(answerImages, input.examTitle);
  const flagged = pass1.flagged_uncertainties || [];

  if (flagged.length === 0) {
    console.log('[two-pass] no flags — skip Pass 2');
    return {
      fullTranscription: pass1.full_transcription,
      flaggedUncertainties: [],
      resolvedUncertainties: [],
      pass2Ran: false,
    };
  }

  let calibrationB64: { mediaType: string; data: string } | null = null;
  if (
    input.calibrationImageUrl &&
    !input.calibrationImageUrl.startsWith('blob:') &&
    !input.calibrationImageUrl.includes('unsplash')
  ) {
    calibrationB64 = await urlToBase64(input.calibrationImageUrl);
  }

  if (!calibrationB64) {
    console.log('[two-pass] flags exist but no calibration — keep Pass 1');
    return {
      fullTranscription: pass1.full_transcription,
      flaggedUncertainties: flagged,
      resolvedUncertainties: [],
      pass2Ran: false,
    };
  }

  console.log('[two-pass] Pass 2 flags=', flagged.length);
  const resolved = await runPass2(answerImages, calibrationB64, flagged);
  const merged = mergeTranscription(
    pass1.full_transcription,
    flagged,
    resolved
  );

  return {
    fullTranscription: merged,
    flaggedUncertainties: flagged,
    resolvedUncertainties: resolved,
    pass2Ran: true,
  };
}