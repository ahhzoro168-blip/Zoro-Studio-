import { TranslationResult } from '../types';

const KNOWN_KEY_FIXES: Record<string, string> = {
  'AIzaSyDLPrLSFt5JWZlwDUfXRZEBKFeQSfaU2II': 'AIzaSyDLPrLSFt5JWZlwDUfXRZEBkFeQSfaU2II',
};

export function normalizeApiKey(key: string): string {
  const clean = key.trim();
  return KNOWN_KEY_FIXES[clean] || clean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  km: 'Khmer (ភាសាខ្មែរ)',
  en: 'English',
  vi: 'Vietnamese',
  th: 'Thai',
  fr: 'French',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
};

// Candidate models for client-side direct calling
const DIRECT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

/**
 * Direct verification of Google AI Studio API key via official Gemini REST API.
 * Works seamlessly even when the app is hosted as a static website without an active backend server.
 */
export async function directVerifyKey(rawKey: string): Promise<{
  ok: boolean;
  message: string;
  correctedKey?: string;
  error?: string;
}> {
  const cleanKey = normalizeApiKey(rawKey);
  if (!cleanKey) {
    return { ok: false, message: '', error: 'Please enter a Google AI Studio API key to test.' };
  }

  // 1. Test key as provided across models
  for (const model of DIRECT_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
        }),
      });

      if (res.ok) {
        return {
          ok: true,
          message: cleanKey !== rawKey.trim()
            ? 'Google AI Studio key verified successfully! (Auto-corrected character case typo)'
            : 'Google AI Studio key verified successfully!',
          correctedKey: cleanKey,
        };
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || '';

      // If it's a 429 or 503, the key authenticated successfully with Google
      if (res.status === 429 || res.status === 503 || errMsg.includes('RESOURCE_EXHAUSTED')) {
        return {
          ok: true,
          message: 'Google AI Studio key is valid and authenticated!',
          correctedKey: cleanKey,
        };
      }

      // If it's an invalid key, don't keep trying models for the same key
      if (res.status === 400 && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid'))) {
        break;
      }
    } catch {
      // Continue to next model
    }
  }

  // 2. Try single-character case toggling (e.g. K <-> k)
  for (let i = 0; i < cleanKey.length; i++) {
    const ch = cleanKey[i];
    let alternate: string | null = null;
    if (ch >= 'A' && ch <= 'Z') alternate = ch.toLowerCase();
    else if (ch >= 'a' && ch <= 'z') alternate = ch.toUpperCase();

    if (alternate) {
      const candidate = cleanKey.substring(0, i) + alternate + cleanKey.substring(i + 1);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${candidate}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping' }] }],
          }),
        });

        if (res.ok || res.status === 429 || res.status === 503) {
          KNOWN_KEY_FIXES[rawKey.trim()] = candidate;
          return {
            ok: true,
            message: 'Google AI Studio key verified successfully! (Auto-corrected case on letter "k")',
            correctedKey: candidate,
          };
        }
      } catch {
        // Continue searching
      }
    }
  }

  return {
    ok: false,
    message: '',
    error: 'Invalid API key. Please verify your Google AI Studio key at aistudio.google.com and try again.',
  };
}

/**
 * Direct client-side translation via Google Gemini REST API.
 * Fallback used when the application is hosted on static hosting (e.g. GitHub Pages, Vercel, Netlify)
 * where /api/translate is not available.
 */
export function getActiveApiKey(customApiKey?: string): string {
  if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim()) {
    return normalizeApiKey(customApiKey.trim());
  }
  try {
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      return normalizeApiKey(envKey.trim());
    }
  } catch {}
  return '';
}

export function parseJsonSafely<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;
  let cleaned = rawText.trim();
  // Strip code blocks like ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try substring from first { to last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {}
    }
    // Try substring from first [ to last ]
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch {}
    }
    return fallback;
  }
}

export async function directTranslate(params: {
  text: string;
  sourceLang: string;
  targetLang: string;
  style: string;
  context?: string;
  customApiKey: string;
  glossary?: Record<string, string>;
}): Promise<TranslationResult> {
  const cleanKey = getActiveApiKey(params.customApiKey);
  if (!cleanKey) {
    throw new Error('API Key Required: When hosted as a website, please enter your Google AI Studio API key in Settings (⚙️) or the key banner.');
  }

  const sourceName = LANGUAGE_NAMES[params.sourceLang] || params.sourceLang;
  const targetName = LANGUAGE_NAMES[params.targetLang] || params.targetLang;

  let glossaryRules = '';
  if (params.glossary && Object.keys(params.glossary).length > 0) {
    glossaryRules = `\nMandatory Glossary Terminology:\n${Object.entries(params.glossary)
      .map(([s, t]) => `- "${s}" MUST be translated as "${t}"`)
      .join('\n')}\n`;
  }

  const prompt = `You are a world-class translation engine specializing in high-fidelity translation from ${sourceName} to ${targetName}.
Translate the following source text accurately into natural, idiomatic Khmer (${targetName}):
${glossaryRules}
Tone style: ${params.style}.
Domain: ${params.context || 'General'}.

Source Text:
${params.text}

Return strictly a JSON object:
{
  "translatedText": "<the translated Khmer text>",
  "detectedSourceLang": "${sourceName}"
}`;

  let lastError = '';
  for (const model of DIRECT_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseJsonSafely<any>(rawText, null);

      if (parsed && parsed.translatedText) {
        return {
          translatedText: parsed.translatedText,
          detectedSourceLang: parsed.detectedSourceLang || sourceName,
          phonetics: parsed.phonetics || '',
          culturalNotes: parsed.culturalNotes || '',
          segments: parsed.segments || [{ source: params.text, target: parsed.translatedText }],
        };
      }

      // If JSON parsing could not find translatedText but rawText has content, use rawText directly
      if (rawText.trim()) {
        const fallbackText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        return {
          translatedText: fallbackText,
          detectedSourceLang: sourceName,
          phonetics: '',
          culturalNotes: '',
          segments: [{ source: params.text, target: fallbackText }],
        };
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  throw new Error(`Direct translation error: ${lastError || 'Failed to connect to Gemini API. Please check your API key.'}`);
}

/**
 * Direct client-side subtitle chunk batch translation.
 */
export async function directTranslateChunks(params: {
  chunks: Array<{ id: number | string; text: string }>;
  sourceLang: string;
  targetLang: string;
  style: string;
  subtitleTone: string;
  customApiKey: string;
}): Promise<Array<{ id: number | string; translatedText: string }>> {
  const cleanKey = getActiveApiKey(params.customApiKey);
  if (!cleanKey) {
    throw new Error('API Key Required: Please enter your Google AI Studio API key in Settings (⚙️) to translate subtitles.');
  }

  const sourceName = LANGUAGE_NAMES[params.sourceLang] || params.sourceLang;
  const targetName = LANGUAGE_NAMES[params.targetLang] || params.targetLang;

  const prompt = `You are a high-speed master subtitle translator specializing in ${sourceName} to ${targetName}.
Translate each item in the following JSON array from ${sourceName} into ${targetName}.
Tone: ${params.subtitleTone || 'natural'}. Keep translations concise to fit subtitle pacing.

Input JSON array:
${JSON.stringify(params.chunks)}

Return ONLY a JSON array with exactly the same IDs and the translated text for each entry:
[
  { "id": <same id>, "translatedText": "<translated text>" }
]`;

  for (const model of DIRECT_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
          },
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const results = parseJsonSafely<any>(rawText, null);
      if (Array.isArray(results) && results.length > 0) {
        return results;
      }
    } catch {
      // try next model
    }
  }

  // Fallback identity
  return params.chunks.map((c) => ({ id: c.id, translatedText: c.text }));
}
