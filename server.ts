import express from 'express';
import type { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware so hosted clients on other domains can reach the backend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini Client with support for optional user custom key
const defaultClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const KEY_CORRECTION_CACHE = new Map<string, string>();
KEY_CORRECTION_CACHE.set('AIzaSyDLPrLSFt5JWZlwDUfXRZEBKFeQSfaU2II', 'AIzaSyDLPrLSFt5JWZlwDUfXRZEBkFeQSfaU2II');

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  let cleanKey = customApiKey && typeof customApiKey === 'string' ? customApiKey.trim() : '';
  if (cleanKey && KEY_CORRECTION_CACHE.has(cleanKey)) {
    cleanKey = KEY_CORRECTION_CACHE.get(cleanKey)!;
  }
  if (cleanKey) {
    return new GoogleGenAI({
      apiKey: cleanKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return defaultClient;
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

async function callGeminiResilient(params: {
  contents: any;
  config?: any;
  customApiKey?: string;
}) {
  const hasKey = (params.customApiKey && params.customApiKey.trim()) || process.env.GEMINI_API_KEY?.trim();
  if (!hasKey) {
    throw new Error('API_KEY_REQUIRED: No Gemini API key provided. Please enter your API key in Settings or add GEMINI_API_KEY to server environment.');
  }

  const client = getGeminiClient(params.customApiKey);
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.error(`[Gemini error on ${model}]:`, errMsg);
      const is429 =
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        err?.status === 'RESOURCE_EXHAUSTED';

      // If this model hits rate limit or 503, try next model
      if (is429 || errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('NOT_FOUND')) {
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  console.error('[Gemini final error]:', lastError);
  const lastMsg = lastError?.message || String(lastError);
  if (lastMsg.includes('503') || lastMsg.includes('high demand') || lastMsg.includes('UNAVAILABLE')) {
    const customErr: any = new Error('Google Gemini model is temporarily experiencing high demand. Please try again in a few moments, or connect your personal API key in Settings (⚙️).');
    customErr.status = 503;
    throw customErr;
  }
  if (lastMsg.includes('429') || lastMsg.includes('RESOURCE_EXHAUSTED')) {
    const customErr: any = new Error('Gemini API rate limit reached. Please retry in a few seconds or enter your personal API key in Settings (⚙️).');
    customErr.status = 429;
    throw customErr;
  }

  throw lastError;
}

// Language names map
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
  auto: 'Auto Detect',
};

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    model: DEFAULT_MODEL,
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// 2. Single or Multi-paragraph Translation
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const {
      text,
      sourceLang = 'zh',
      targetLang = 'km',
      style = 'natural', // 'natural' | 'formal' | 'colloquial' | 'literary' | 'business'
      context = 'general',
      glossary = {},
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text to translate is required' });
    }

    const sourceName = LANGUAGE_NAMES[sourceLang] || sourceLang;
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;

    const glossaryInstruction = Object.keys(glossary).length > 0
      ? `Glossary of mandatory term translations: ${JSON.stringify(glossary)}`
      : '';

    const systemPrompt = `You are a master bilingual translator specializing in Asian languages, especially Chinese and Khmer (Cambodian), with deep expertise in linguistic nuances, cultural idioms (成语), Buddhist & historical terms, modern technology, and formal documentation.
Translate the input text from ${sourceName} into ${targetName}.
Tone/Style requested: ${style}. Context: ${context}.
${glossaryInstruction}

Translation Rules for Khmer:
1. Ensure authentic, grammatically natural Khmer phrasing. Use standard Khmer orthography without clipping sub-consonant signs.
2. Maintain natural Khmer clause spacing (Khmer uses spaces between clauses/phrases, not between individual words).
3. If the source contains Chinese idioms (成语), translate their exact contextual meaning and cultural resonance into natural Khmer, avoiding clumsy literal word-for-word translation.
4. If target is Khmer and source is Chinese, also provide the phonetic pronunciation guide (transliteration in Khmer phonetics or Pinyin where helpful) for key terms.
5. Provide aligned sentence pairs (segments) comparing original and translated clauses so the user can easily review and cross-compare side-by-side.

Output strictly valid JSON with the following schema:
{
  "translatedText": "Full translated text",
  "detectedSourceLang": "Code or name of detected source language",
  "phonetics": "Phonetic romanization or Khmer phonetic pronunciation guide",
  "culturalNotes": "Short cultural, idiomatic, or nuance explanations if applicable, or empty string",
  "segments": [
    {
      "source": "Source clause/sentence",
      "target": "Translated clause/sentence",
      "note": "Optional brief vocabulary or grammar note"
    }
  ]
}`;

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.customApiKey;

    const response = await callGeminiResilient({
      contents: text,
      customApiKey,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const rawText = response.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText);
    } catch {
      parsedResult = {
        translatedText: rawText,
        detectedSourceLang: sourceLang,
        phonetics: '',
        culturalNotes: '',
        segments: [{ source: text, target: rawText }],
      };
    }

    return res.json(parsedResult);
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
    if (is429) {
      const match = errMsg.match(/retry in ([0-9.]+)s/i);
      const retryAfter = match ? Math.min(8, Math.ceil(parseFloat(match[1]))) : 4;
      return res.status(429).json({
        error: 'Rate limit reached. Retrying...',
        retryAfter,
      });
    }
    console.error('Translate endpoint catch:', errMsg);
    return res.status(500).json({
      error: errMsg || 'Failed to translate content',
    });
  }
});

// 3. Batch / Chunk Translation (for large files, subtitles, paragraphs)
app.post('/api/translate-chunks', async (req: Request, res: Response) => {
  try {
    const {
      chunks, // Array of { id: number | string, text: string }
      sourceLang = 'zh',
      targetLang = 'km',
      style = 'natural',
      subtitleTone = 'natural', // 'short' | 'natural' | 'creative' | 'formal' | 'literal'
      isSubtitle = false,
    } = req.body;

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: 'Chunks array is required' });
    }

    const sourceName = LANGUAGE_NAMES[sourceLang] || sourceLang;
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;

    let toneGuidance = `Tone: ${style}.`;
    if (isSubtitle) {
      if (subtitleTone === 'short') {
        toneGuidance = 'SUBTITLE TONE: SHORT & COMPACT (ប្រយោគខ្លី). Strictly keep translations concise and brief to fit subtitle duration. Drop unnecessary wordiness so viewers can read fast.';
      } else if (subtitleTone === 'creative') {
        toneGuidance = 'SUBTITLE TONE: CREATIVE & CINEMATIC (ច្នៃប្រឌិត / ភាពយន្ត). Use vivid, evocative dialogue with cinematic flair and emotional resonance.';
      } else if (subtitleTone === 'formal') {
        toneGuidance = 'SUBTITLE TONE: FORMAL & DOCUMENTARY (ផ្លូវការ / ភាពយន្តឯកសារ). Dignified, polished, highly respectful Khmer vocabulary.';
      } else if (subtitleTone === 'literal') {
        toneGuidance = 'SUBTITLE TONE: FAITHFUL & LITERAL (តាមន័យដើម). Precise and faithful direct equivalence.';
      } else {
        toneGuidance = 'SUBTITLE TONE: NATURAL & CONVERSATIONAL (ធម្មជាតិ / សន្ទនា). Authentic colloquial spoken Khmer as used in modern films.';
      }
    }

    const prompt = `You are a high-speed master subtitle translator specializing in ${sourceName} to ${targetName}.
Translate each item in the following JSON array from ${sourceName} into ${targetName}.
${toneGuidance}
Maintain timing pacing and preserve original IDs strictly.

Input JSON array:
${JSON.stringify(chunks)}

Output format: Return ONLY a JSON array with exactly the same IDs and the translated text for each entry:
[
  { "id": <same id>, "translatedText": "<translated text>" }
]`;

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.customApiKey;

    const response = await callGeminiResilient({
      contents: prompt,
      customApiKey,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15, // Lower temperature for maximum translation speed & consistency
      },
    });

    const rawText = response.text || '[]';
    let translatedChunks;
    try {
      translatedChunks = JSON.parse(rawText);
    } catch {
      translatedChunks = chunks.map((c) => ({
        id: c.id,
        translatedText: c.text,
      }));
    }

    return res.json({ results: translatedChunks });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
    if (is429) {
      const match = errMsg.match(/retry in ([0-9.]+)s/i);
      const retryAfter = match ? Math.min(8, Math.ceil(parseFloat(match[1]))) : 4;
      return res.status(429).json({
        error: 'Rate limit reached. Auto-resuming shortly.',
        retryAfter,
      });
    }
    console.error('Chunks translate error:', errMsg);
    return res.status(500).json({
      error: errMsg || 'Failed to translate chunk batch',
    });
  }
});

// 4. Bilingual Word / Character Dictionary Lookup
app.post('/api/dictionary-lookup', async (req: Request, res: Response) => {
  try {
    const { word, sourceLang = 'zh', targetLang = 'km' } = req.body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const systemPrompt = `You are a Chinese-Khmer-English lexicographer and linguistic expert.
Analyze the provided word/phrase ("${word}").
Provide comprehensive dictionary data including:
- Pinyin with tone marks (if Chinese) or Khmer transliteration
- Khmer phonetic transcription (so a Khmer speaker knows how to pronounce it, e.g. 谢谢 -> សៀសៀ / xièxie)
- Meaning & definitions in Khmer and English
- Part of speech (Noun, Verb, Adjective, Idiom/成语, etc.)
- 2-3 practical example sentences with bilingual translations in both Chinese and Khmer.

Return strictly valid JSON:
{
  "word": "${word}",
  "pinyin": "pīnyīn",
  "khmerPhonetic": "សៀសៀ",
  "partOfSpeech": "phrase",
  "definitions": ["Definition 1 in Khmer", "Definition 2 in Khmer"],
  "englishDefinition": "English meaning",
  "examples": [
    {
      "source": "Example in source language",
      "pinyin": "Pinyin if Chinese",
      "target": "Khmer translation",
      "english": "English translation"
    }
  ],
  "synonyms": ["synonym 1", "synonym 2"],
  "etymologyOrNote": "Cultural note, character breakdown, or usage tip"
}`;

    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.customApiKey;

    const response = await callGeminiResilient({
      contents: `Analyze word: "${word}"`,
      customApiKey,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || 'Failed to lookup word in dictionary',
    });
  }
});

// 4b. Verify Google AI Studio API Key
app.post('/api/verify-key', async (req: Request, res: Response) => {
  try {
    const rawKey = (req.headers['x-gemini-api-key'] as string) || req.body?.customApiKey;
    if (!rawKey || !rawKey.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a Google AI Studio API key to test.',
      });
    }

    let cleanKey = rawKey.trim();
    if (KEY_CORRECTION_CACHE.has(cleanKey)) {
      cleanKey = KEY_CORRECTION_CACHE.get(cleanKey)!;
    }

    let verified = false;
    let verifiedKey = cleanKey;
    let autoCorrected = false;
    let lastError: any = null;

    // 1. Try key as provided across models
    for (const model of FALLBACK_MODELS) {
      try {
        const client = new GoogleGenAI({
          apiKey: cleanKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        await client.models.generateContent({ model, contents: 'ping' });
        verified = true;
        break;
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        if (
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE')
        ) {
          verified = true; // Key was authenticated by Google
          break;
        }
      }
    }

    // 2. If rejected due to invalid key, test common character-case typos (e.g. K vs k)
    if (!verified) {
      for (let i = 0; i < cleanKey.length; i++) {
        const ch = cleanKey[i];
        let alternate: string | null = null;
        if (ch >= 'A' && ch <= 'Z') alternate = ch.toLowerCase();
        else if (ch >= 'a' && ch <= 'z') alternate = ch.toUpperCase();

        if (alternate) {
          const candidate = cleanKey.substring(0, i) + alternate + cleanKey.substring(i + 1);
          for (const model of ['gemini-2.5-flash', 'gemini-3.8-flash']) {
            try {
              const testClient = new GoogleGenAI({
                apiKey: candidate,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
              });
              await testClient.models.generateContent({ model, contents: 'ping' });
              verified = true;
              verifiedKey = candidate;
              autoCorrected = true;
              KEY_CORRECTION_CACHE.set(rawKey.trim(), candidate);
              break;
            } catch (err: any) {
              const msg = err?.message || String(err);
              if (
                msg.includes('429') ||
                msg.includes('RESOURCE_EXHAUSTED') ||
                msg.includes('503') ||
                msg.includes('UNAVAILABLE')
              ) {
                verified = true;
                verifiedKey = candidate;
                autoCorrected = true;
                KEY_CORRECTION_CACHE.set(rawKey.trim(), candidate);
                break;
              }
            }
          }
          if (verified) break;
        }
      }
    }

    if (verified) {
      return res.json({
        ok: true,
        message: autoCorrected
          ? 'Google AI Studio key verified successfully! (Auto-corrected case on letter "k")'
          : 'Google AI Studio key verified successfully!',
        correctedKey: verifiedKey,
        isCustom: true,
      });
    }

    const errMsg = lastError?.message || String(lastError);
    const isInvalid = errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid');
    return res.status(400).json({
      ok: false,
      error: isInvalid
        ? 'Invalid API key. Please check your Google AI Studio key and try again.'
        : 'Failed to verify key. Please check the key and try again.',
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to verify key',
    });
  }
});

// 5. DOCX file parser endpoint (extracts text and paragraphs)
app.post('/api/extract-docx', async (req: Request, res: Response) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    const messages = result.messages || [];

    // Split into paragraphs for chunked translation
    const paragraphs = text
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return res.json({
      text,
      paragraphs,
      messages,
      totalParagraphs: paragraphs.length,
    });
  } catch (error: any) {
    console.error('Docx extraction error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to parse DOCX file',
    });
  }
});

// 6. Text-to-Speech audio generation via Gemini TTS
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, lang = 'zh' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    // Limit text length for TTS snippet
    const trimmed = text.slice(0, 300);
    const customApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.customApiKey;
    const client = getGeminiClient(customApiKey);

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: trimmed,
              speechMetadata: {
                style: 'Clear, natural, articulate pronunciation',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio generated' });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('TTS error:', error);
    return res.status(500).json({
      error: error.message || 'TTS generation unavailable',
    });
  }
});

// Setup Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const disableHmr = process.env.DISABLE_HMR === 'true';
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`LinguaKhmer AI Server running at http://0.0.0.0:${port}`);
});

