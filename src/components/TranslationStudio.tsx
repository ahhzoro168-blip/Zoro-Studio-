import React, { useState, useRef } from 'react';
import {
  Upload,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Send,
  Zap,
} from 'lucide-react';
import {
  LanguageCode,
  TranslationStyle,
  TranslationContext,
  TranslationResult,
  AlignedSegment,
} from '../types';

interface TranslationStudioProps {
  onTranslate: (
    text: string,
    sourceLang: string,
    targetLang: string,
    style: TranslationStyle,
    context: TranslationContext
  ) => Promise<TranslationResult | null>;
  onWordLookup: (word: string) => void;
  onOpenSrtTab: () => void;
  initialSourceText?: string;
  initialTranslatedText?: string;
}

const LANGUAGES: Array<{ code: LanguageCode; name: string; nativeName: string }> = [
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

export const TranslationStudio: React.FC<TranslationStudioProps> = ({
  onTranslate,
  onWordLookup,
  onOpenSrtTab,
  initialSourceText = '',
  initialTranslatedText = '',
}) => {
  const [sourceLang, setSourceLang] = useState<LanguageCode>('zh');
  const [targetLang, setTargetLang] = useState<LanguageCode>('km');
  const [sourceText, setSourceText] = useState<string>(
    initialSourceText || ''
  );
  const [translatedText, setTranslatedText] = useState<string>(initialTranslatedText || '');
  const [phonetics, setPhonetics] = useState<string>('');
  const [culturalNotes, setCulturalNotes] = useState<string>('');
  const [segments, setSegments] = useState<AlignedSegment[]>([]);
  const [style, setStyle] = useState<TranslationStyle>('natural');
  const [context, setContext] = useState<TranslationContext>('general');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Perform translation
  const handleTriggerTranslate = async () => {
    if (!sourceText.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await onTranslate(sourceText, sourceLang, targetLang, style, context);
      if (result) {
        setTranslatedText(result.translatedText || '');
        setPhonetics(result.phonetics || '');
        setCulturalNotes(result.culturalNotes || '');
        setSegments(result.segments || []);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick file drop/import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.srt')) {
      onOpenSrtTab();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSourceText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTriggerTranslate();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Translation Center */}
      <div className="lg:col-span-8 space-y-5">
        {/* Input Box Terminal Panel */}
        <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
          <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
            <span>INPUT_BUFFER / SOURCE_TEXT</span>
            <span>CH_UTF8</span>
          </div>

          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            rows={6}
            className="w-full bg-transparent p-4 font-['JetBrains_Mono'] text-[#e4e4e7] text-sm leading-relaxed placeholder:text-[#e4e4e7]/30 focus:outline-hidden resize-y"
          />

          <div className="px-4 py-2.5 bg-[#111113] border-t border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50">
            <span>METRICS: {sourceText.length} CHARS / {sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0} WORDS</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>IMPORT</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.srt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </button>
              {sourceText && (
                <button
                  onClick={() => setSourceText('')}
                  className="hover:text-rose-400 transition cursor-pointer"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleTriggerTranslate}
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-[#10b981] hover:bg-[#059669] text-black font-bold uppercase tracking-wider text-xs rounded-lg transition shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>TRANSLATING_VIA_GEMINI...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>EXECUTE_TRANSLATION</span>
            </>
          )}
        </button>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs rounded-lg font-mono">
            Error: {errorMsg}
          </div>
        )}

        {/* Output Result Area */}
        {translatedText && (
          <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-[#e4e4e7]/10 pb-3">
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-mono">
                OUTPUT_RESULT / TRANSLATED_TEXT
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(translatedText)}
                className="text-xs text-[#e4e4e7]/60 hover:text-emerald-400 flex items-center gap-1 font-mono cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>COPY</span>
              </button>
            </div>

            <div className="font-['Kantumruy_Pro'] text-base leading-relaxed text-[#e4e4e7] whitespace-pre-wrap">
              {translatedText}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls Pane */}
      <aside className="lg:col-span-4 bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg p-5 space-y-6">
        <div>
          <span className="text-[11px] text-[#10b981] font-bold uppercase tracking-wider block mb-3 font-mono">
            Configuration
          </span>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                Source Language
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value as LanguageCode)}
                className="w-full bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7] p-2.5 rounded text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#18181b]">
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                Target Language
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                className="w-full bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7] p-2.5 rounded text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#18181b]">
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e4e4e7]/10 pt-5">
          <span className="text-[11px] text-[#10b981] font-bold uppercase tracking-wider block mb-3 font-mono">
            Model Parameters
          </span>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                Translation Tone
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as TranslationStyle)}
                className="w-full bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7] p-2.5 rounded text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="natural">Natural / Standard</option>
                <option value="formal">Formal (ផ្លូវការ)</option>
                <option value="colloquial">Colloquial (សន្ទនា)</option>
                <option value="literary">Literary (អក្សរសិល្ប៍)</option>
                <option value="business">Business (ពាណិជ្ជកម្ម)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                Content Domain
              </label>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value as TranslationContext)}
                className="w-full bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7] p-2.5 rounded text-xs focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="general">General</option>
                <option value="subtitle">Subtitles / Film</option>
                <option value="technical">Technical / IT</option>
                <option value="tourism">Tourism &amp; Travel</option>
                <option value="business">Commercial / Trade</option>
              </select>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
