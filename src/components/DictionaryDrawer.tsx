import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  BookOpen,
  Volume2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { DictionaryData } from '../types';
import { speakText } from '../utils/speech';

interface DictionaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialWord?: string;
  onAddGlossary?: (term: string, translation: string) => void;
  customApiKey?: string;
}

export const DictionaryDrawer: React.FC<DictionaryDrawerProps> = ({
  isOpen,
  onClose,
  initialWord = '',
  onAddGlossary,
  customApiKey,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialWord);
  const [data, setData] = useState<DictionaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupWord = async (wordToLookup: string) => {
    if (!wordToLookup.trim()) return;

    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customApiKey && customApiKey.trim()) {
        headers['x-gemini-api-key'] = customApiKey.trim();
      }

      const response = await fetch('/api/dictionary-lookup', {
        method: 'POST',
        headers,
        body: JSON.stringify({ word: wordToLookup, customApiKey }),
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('No dictionary definition found for this term.');
      }
    } catch (e: any) {
      setError(e.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialWord) {
      setSearchTerm(initialWord);
      lookupWord(initialWord);
    }
  }, [initialWord]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity font-mono">
      <div className="w-full max-w-lg bg-[#18181b] border-l border-[#e4e4e7]/10 h-full flex flex-col shadow-2xl text-[#e4e4e7]">
        {/* Header */}
        <div className="p-4 border-b border-[#e4e4e7]/10 flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#e4e4e7]">DICTIONARY_LEXICON (វចនានុក្រម)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#e4e4e7]/60 hover:text-[#e4e4e7] hover:bg-[#18181b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-[#e4e4e7]/10 bg-[#111113]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupWord(searchTerm);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Chinese word, Pinyin, or Khmer..."
                className="w-full bg-[#18181b] border border-[#e4e4e7]/10 rounded px-3.5 py-2 pl-9 text-xs text-[#e4e4e7] placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-[#e4e4e7]/40 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-[#111113] rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-[#e4e4e7]/40 space-y-3 font-mono">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs">ANALYZING_LINGUISTIC_ROOT_AND_DEFINITIONS...</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded text-xs text-rose-300 font-mono">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {/* Word Header Card */}
              <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-md">
                <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
                  <span>TERM_ENTRY</span>
                  <span>{data.partOfSpeech?.toUpperCase() || 'PHRASE'}</span>
                </div>
                <div className="p-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-black font-chinese text-[#e4e4e7] tracking-wide">
                      {data.word}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {data.pinyin && (
                        <span className="font-mono text-sm text-emerald-400 font-semibold">
                          {data.pinyin}
                        </span>
                      )}
                      {data.khmerPhonetic && (
                        <span className="font-['Kantumruy_Pro'] text-xs bg-[#111113] text-emerald-300 px-2 py-0.5 rounded border border-[#e4e4e7]/10">
                          សំឡេងអាន: {data.khmerPhonetic}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => speakText(data.word, 'zh')}
                      className="p-2 rounded bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7]/60 hover:text-[#e4e4e7] cursor-pointer"
                      title="Listen to Chinese word"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    {onAddGlossary && (
                      <button
                        onClick={() =>
                          onAddGlossary(
                            data.word,
                            data.definitions?.[0] || data.englishDefinition || ''
                          )
                        }
                        className="p-2 rounded bg-[#111113] border border-[#e4e4e7]/10 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        title="Add to Custom Glossary"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Definitions in Khmer */}
              <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-md">
                <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                  Khmer Meanings (និយមន័យ)
                </div>
                <div className="p-3.5 space-y-1.5">
                  {data.definitions?.map((def, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs font-['Kantumruy_Pro'] text-[#e4e4e7] bg-[#111113] p-2.5 rounded border border-[#e4e4e7]/10 leading-loose"
                    >
                      <span className="text-emerald-400 font-bold shrink-0">{idx + 1}.</span>
                      <span>{def}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* English Definition */}
              {data.englishDefinition && (
                <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-md">
                  <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 text-xs text-[#e4e4e7]/50 font-bold uppercase tracking-wider">
                    English Meaning
                  </div>
                  <div className="p-3.5 text-xs text-[#e4e4e7]/80 leading-relaxed">
                    {data.englishDefinition}
                  </div>
                </div>
              )}

              {/* Practical Bilingual Examples */}
              {data.examples && data.examples.length > 0 && (
                <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-md">
                  <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                    Context Examples (ឧទាហរណ៍)
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    {data.examples.map((ex, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#111113] rounded border border-[#e4e4e7]/10 space-y-1 text-xs"
                      >
                        <div className="font-chinese text-[#e4e4e7] text-xs font-medium flex items-center justify-between">
                          <span>{ex.source}</span>
                          <button
                            onClick={() => speakText(ex.source, 'zh')}
                            className="text-[#e4e4e7]/40 hover:text-emerald-400"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        </div>
                        {ex.pinyin && (
                          <div className="font-mono text-[10px] text-emerald-400/80">
                            {ex.pinyin}
                          </div>
                        )}
                        <div className="font-['Kantumruy_Pro'] text-[#e4e4e7] text-xs leading-relaxed pt-1 border-t border-[#e4e4e7]/10">
                          {ex.target}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cultural / Etymology Note */}
              {data.etymologyOrNote && (
                <div className="bg-emerald-950/20 border border-emerald-800/30 p-3.5 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5 uppercase text-[10px]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Linguistic &amp; Cultural Note</span>
                  </div>
                  <p className="text-[#e4e4e7]/80 leading-relaxed">
                    {data.etymologyOrNote}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
