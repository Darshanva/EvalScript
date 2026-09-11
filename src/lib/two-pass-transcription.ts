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
      out.push({ ...b64, label: `Answer page ${page.pageNumber ?? out.length + 1}` });
    }
  }
  return out.slice(0, 20);
}

/** Pass 1 — context transcription, NO calibration image */
async function runPass1(
  answerImages: { mediaType: string; data: string; label: string }[],
  examTitle: string
): Promise<{ full_transcription: string; flagged_uncertainties: FlaggedUncertainty[] }> {
  const client = createClaudeClient();
  if (!client) throw new Error('Claude API key not configured');

  const prompt = `You are transcribing a handwritten exam answer script. You will see ONLY the student's answer script image(s). Do not assume anything about handwriting style in advance.

Exam context: ${examTitle} (banking/finance style answers possible).

Instructions:
1. Transcribe the full text using contextual understanding — vocabulary, grammar, sentence structure, and subject-matter logic to resolve unclear handwriting.
2. Produce your best-confidence transcription of the entire script.
3. Separately, list every word or short phrase where your confidence is genuinely low — i.e., you resolved it through guesswork rather than clear reading. For each flagged item, include:
   - guess: the transcribed guess
   - ambiguity_note: short description (e.g. "could be 'r' or 'v'")
   - location: line number or surrounding words
4. Do NOT flag words you are confident about, even if handwriting is messy — only flag genuine ambiguity where two or more readings seem plausible.

Return ONLY valid JSON:
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

/** Pass 2 — only flagged items + calibration sample */
async function runPass2(
  answerImages: { mediaType: string; data: string; label: string }[],
  calibrationB64: { mediaType: string; data: string },
  flagged: FlaggedUncertainty[]
): Promise<ResolvedUncertainty[]> {
  const client = createClaudeClient();
  if (!client) throw new Error('Claude API key not configured');

  const prompt = `You previously transcribed a student's answer script and flagged some words as uncertain. You will now see the student's calibration sample (text written in their handwriting) to help resolve ONLY those flagged items.

Flagged items from Pass 1:
${JSON.stringify(flagged, null, 2)}

Instructions:
1. Do NOT re-read or revise any part of the transcription that was NOT flagged. Treat the confident transcription as final and locked.
2. For each flagged item only, compare the ambiguous letter/stroke shape against the equivalent letter shapes in the calibration sample.
3. Choose the reading that best matches the student's known letter formation, but if the calibration sample doesn't clearly resolve it either, keep your original contextual best-guess rather than forcing a match.
4. Return only updates to the flagged items — do not re-output the full transcription.

Return ONLY valid JSON:
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
    {
      type: 'text',
      text: 'CALIBRATION SAMPLE (handwriting reference only):',
    },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: calibrationB64.mediaType,
        data: calibrationB64.data,
      },
    },
  ];

  // Include answer pages so model can see context of flagged locations
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

/** Apply Pass 2 resolutions onto Pass 1 transcript (best-effort replace) */
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
        f.guess === r.final_answer ||
        (r.location && f.location && r.location.includes(f.location))
    );
    const from = flag?.guess;
    if (from && r.final_answer && from !== r.final_answer) {
      // replace first occurrence of the guess word/phrase
      text = text.replace(from, r.final_answer);
    }
  }
  return text;
}

/**
 * Two-pass transcription:
 * Pass 1 always (no cal). Pass 2 only if flags + calibration URL available.
 */
export async function runTwoPassTranscription(input: {
  pages: { pageNumber?: number; imageUrl?: string; thumbnailUrl?: string }[];
  examTitle: string;
  calibrationImageUrl?: string;
}): Promise<TwoPassResult> {
  const answerImages = await loadAnswerImages(input.pages || []);
  if (answerImages.length === 0) {
    throw new Error(
      'No readable answer page images (check storage public URLs)'
    );
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