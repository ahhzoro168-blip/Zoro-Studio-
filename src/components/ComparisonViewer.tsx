import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
  Layers,
  Search,
  BookOpen,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AlignedSegment } from '../types';
import { speakText, stopSpeaking } from '../utils/speech';

interface ComparisonViewerProps {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  phonetics?: string;
  culturalNotes?: string;
  segments?: AlignedSegment[];
  onWordLookup: (word: string) => void;
  onEditTranslation?: (newText: string) => void;
}

export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  sourceText,
  translatedText,
  sourceLang,
  targetLang,
  phonetics,
  culturalNotes,
  segments = [],
  onWordLookup,
  onEditTranslation,
}) => {
  const [layout, setLayout] = useState<'side-by-side' | 'segmented' | 'stacked'>('side-by-side');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [isSpeakingOriginal, setIsSpeakingOriginal] = useState(false);
  const [isSpeakingTranslated, setIsSpeakingTranslated] = useState(false);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [showPhonetics, setShowPhonetics] = useState(true);

  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const targetScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  // Synchronized scrolling between source and target panels
  const handleScroll = (scrolledPane: 'source' | 'target') => {
    if (layout !== 'side-by-side' || isSyncingScroll.current) return;
    isSyncingScroll.current = true;

    const sourceEl = sourceScrollRef.current;
    const targetEl = targetScrollRef.current;

    if (scrolledPane === 'source' && sourceEl && targetEl) {
      const percentage = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
      targetEl.scrollTop = percentage * (targetEl.scrollHeight - targetEl.clientHeight);
    } else if (scrolledPane === 'target' && targetEl && sourceEl) {
      const percentage = targetEl.scrollTop / (targetEl.scrollHeight - targetEl.clientHeight || 1);
      sourceEl.scrollTop = percentage * (sourceEl.scrollHeight - sourceEl.clientHeight);
    }

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const copyToClipboard = async (text: string, isOriginal: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isOriginal) {
        setCopiedOriginal(true);
        setTimeout(() => setCopiedOriginal(false), 2000);
      } else {
        setCopiedTranslated(true);
        setTimeout(() => setCopiedTranslated(false), 2000);
      }
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  const handleSpeak = async (text: string, lang: string, isOriginal: boolean) => {
    if (isOriginal ? isSpeakingOriginal : isSpeakingTranslated) {
      stopSpeaking();
      setIsSpeakingOriginal(false);
      setIsSpeakingTranslated(false);
      return;
    }

    if (isOriginal) {
      setIsSpeakingOriginal(true);
      await speakText(text, lang, speechRate);
      setIsSpeakingOriginal(false);
    } else {
      setIsSpeakingTranslated(true);
      await speakText(text, lang, speechRate);
      setIsSpeakingTranslated(false);
    }
  };

  const handleSelectionLookup = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length <= 40) {
      onWordLookup(sel);
    }
  };

  const sourceCharCount = sourceText.length;
  const targetCharCount = translatedText.length;
  const estimatedReadingSecs = Math.max(1, Math.round(sourceCharCount / 10));

  return (
    <div
      className={`flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-slate-950' : ''
      }`}
    >
      {/* Viewer Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800/80 gap-2">
        {/* Layout Modes */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setLayout('side-by-side')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
              layout === 'side-by-side'
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Side-by-side comparison with synced scrolling"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Side-by-Side</span>
          </button>

          <button
            onClick={() => setLayout('segmented')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
              layout === 'segmented'
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Interactive sentence-by-sentence alignment"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sentence Align</span>
          </button>

          <button
            onClick={() => setLayout('stacked')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
              layout === 'stacked'
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Stacked comparison"
          >
            <Rows className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Stacked</span>
          </button>
        </div>

        {/* Search & Tool Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Voice Speed */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            <span>Audio:</span>
            <select
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="0.75" className="bg-slate-900">0.75x</option>
              <option value="1.0" className="bg-slate-900">1.0x</option>
              <option value="1.25" className="bg-slate-900">1.25x</option>
            </select>
          </div>

          {phonetics && (
            <button
              onClick={() => setShowPhonetics(!showPhonetics)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                showPhonetics
                  ? 'bg-sky-950/50 text-sky-300 border-sky-800/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Phonetics {showPhonetics ? 'ON' : 'OFF'}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Comparison Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Phonetic Pronunciation Banner */}
      {phonetics && showPhonetics && (
        <div className="px-4 py-2.5 bg-sky-950/30 border-b border-sky-800/30 flex items-start gap-2.5 text-xs text-sky-200">
          <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-sky-300 mr-2">Pronunciation Guide / Transliteration:</span>
            <span className="font-mono text-sky-100">{phonetics}</span>
          </div>
        </div>
      )}

      {/* Cultural Nuance / Notes Banner */}
      {culturalNotes && (
        <div className="px-4 py-2 bg-indigo-950/30 border-b border-indigo-800/30 flex items-start gap-2 text-xs text-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-indigo-300 mr-1.5">Translation Note:</span>
            <span className="text-indigo-200/90">{culturalNotes}</span>
          </div>
        </div>
      )}

      {/* Comparison Body */}
      {layout === 'side-by-side' && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 flex-1 min-h-[380px]">
          {/* Source Column (Chinese / Original) */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  {sourceLang === 'zh' ? 'Original (中文)' : `Original (${sourceLang})`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {sourceCharCount} chars • ~{estimatedReadingSecs}s read
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSpeak(sourceText, sourceLang, true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Listen to original pronunciation"
                >
                  {isSpeakingOriginal ? <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(sourceText, true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Copy original text"
                >
                  {copiedOriginal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div
              ref={sourceScrollRef}
              onScroll={() => handleScroll('source')}
              onMouseUp={handleSelectionLookup}
              className="p-5 overflow-y-auto max-h-[500px] leading-relaxed text-slate-200 font-chinese text-base whitespace-pre-wrap select-text hover:cursor-text"
            >
              {sourceText || <span className="text-slate-600 italic">No source text provided</span>}
            </div>
          </div>

          {/* Target Column (Khmer / Translated) */}
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  {targetLang === 'km' ? 'Translation (ភាសាខ្មែរ)' : `Translation (${targetLang})`}
                </span>
                <span className="text-[11px] text-slate-500">
                  {targetCharCount} chars
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSpeak(translatedText, targetLang, false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Listen to translated speech"
                >
                  {isSpeakingTranslated ? <VolumeX className="w-3.5 h-3.5 text-sky-400 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(translatedText, false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Copy translated text"
                >
                  {copiedTranslated ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div
              ref={targetScrollRef}
              onScroll={() => handleScroll('target')}
              onMouseUp={handleSelectionLookup}
              className="p-5 overflow-y-auto max-h-[500px] leading-loose text-slate-100 font-khmer text-base whitespace-pre-wrap select-text"
            >
              {translatedText || <span className="text-slate-600 italic">Translation will appear here</span>}
            </div>
          </div>
        </div>
      )}

      {/* Segmented Sentence-by-Sentence View */}
      {layout === 'segmented' && (
        <div className="p-4 overflow-y-auto max-h-[550px] space-y-3">
          <p className="text-xs text-slate-400 mb-2">
            Click any sentence block to highlight alignment and view detailed linguistic notes.
          </p>
          {segments.length > 0 ? (
            segments.map((seg, idx) => {
              const isSelected = selectedSegmentIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedSegmentIdx(isSelected ? null : idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-900/10'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span className="font-semibold text-rose-400/80">Segment #{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(seg.source, sourceLang, true);
                        }}
                        className="hover:text-rose-300"
                        title="Play Chinese sentence audio"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeak(seg.target, targetLang, false);
                        }}
                        className="hover:text-sky-300"
                        title="Play Khmer sentence audio"
                      >
                        <Volume2 className="w-3 h-3 text-sky-400" />
                      </button>
                    </div>
                  </div>

                  {/* Original sentence */}
                  <div className="font-chinese text-slate-200 text-sm mb-2 leading-relaxed">
                    {seg.source}
                  </div>

                  {/* Translated sentence */}
                  <div className="font-khmer text-sky-100 text-sm leading-loose border-t border-slate-800/60 pt-2">
                    {seg.target}
                  </div>

                  {/* Segment Note if present */}
                  {seg.note && (
                    <div className="mt-2 text-xs text-amber-300/90 bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-800/30">
                      💡 {seg.note}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Single-block translation. Switch to "Side-by-Side" to view full text comparison.
            </div>
          )}
        </div>
      )}

      {/* Stacked View */}
      {layout === 'stacked' && (
        <div className="divide-y divide-slate-800 flex-1 overflow-y-auto max-h-[600px]">
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Original ({sourceLang})</span>
              <button
                onClick={() => handleSpeak(sourceText, sourceLang, true)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-chinese text-slate-200 leading-relaxed whitespace-pre-wrap">
              {sourceText}
            </div>
          </div>

          <div className="p-5 bg-slate-950/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Khmer Translation ({targetLang})</span>
              <button
                onClick={() => handleSpeak(translatedText, targetLang, false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-khmer text-slate-100 text-base leading-loose whitespace-pre-wrap">
              {translatedText}
            </div>
          </div>
        </div>
      )}

      {/* Tip footer */}
      <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>💡 Select any word in either column to look up dictionary definitions &amp; phonetics.</span>
        <button
          onClick={() => onWordLookup(sourceText.slice(0, 4) || '你好')}
          className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
        >
          <BookOpen className="w-3 h-3" />
          <span>Dictionary</span>
        </button>
      </div>
    </div>
  );
};
