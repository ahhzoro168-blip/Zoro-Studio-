import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  Play,
  Pause,
  Film,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Sparkles,
  Edit3,
  Volume2,
  Zap,
  Gauge,
  Clock,
  Sliders,
  Check,
  Trash2,
  KeyRound,
  ExternalLink,
  X,
} from 'lucide-react';
import { SubtitleCue, SubtitleTone, TranslationStyle, AppSettings } from '../types';
import { parseSrt, serializeSrt, downloadFile } from '../utils/srtParser';
import { speakText } from '../utils/speech';
import { directTranslateChunks, getActiveApiKey, directVerifyKey, normalizeApiKey } from '../utils/geminiDirect';

interface SubtitleStudioProps {
  onSaveToHistory: (
    title: string,
    sourceText: string,
    translatedText: string,
    subtitles: SubtitleCue[]
  ) => void;
  style: TranslationStyle;
  targetLang: string;
  customApiKey?: string;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings?: () => void;
}

// Helper to compute duration in seconds from SRT timestamp string
function computeDurationSecs(startTime: string, endTime: string): number {
  try {
    const parseTime = (t: string) => {
      const [hms, ms] = t.split(',');
      const [h, m, s] = hms.split(':').map(Number);
      return h * 3600 + m * 60 + s + Number(ms || 0) / 1000;
    };
    const diff = parseTime(endTime) - parseTime(startTime);
    return Math.max(0.5, Math.round(diff * 10) / 10);
  } catch {
    return 2.5;
  }
}

export const SubtitleStudio: React.FC<SubtitleStudioProps> = ({
  onSaveToHistory,
  targetLang,
  customApiKey,
  onUpdateSettings,
  onOpenSettings,
}) => {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentChunkInfo, setCurrentChunkInfo] = useState<string>('');
  const [exportMode, setExportMode] = useState<'translated' | 'bilingual' | 'original'>('translated');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Subtitle Tone Selection
  const [subtitleTone, setSubtitleTone] = useState<SubtitleTone>('short');

  // Performance / Speed Mode
  const [speedMode, setSpeedMode] = useState<'turbo' | 'standard'>('turbo');
  const [stats, setStats] = useState<{ speed: number; elapsed: number } | null>(null);

  // Key prompt modal for hosted website setup
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [modalKeyInput, setModalKeyInput] = useState<string>('');
  const [isModalVerifying, setIsModalVerifying] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');

  const abortControllerRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear uploaded subtitle file and reset state
  const handleClearFile = () => {
    setCues([]);
    setFileName('');
    setProgress(0);
    setCurrentChunkInfo('');
    setStats(null);
    setIsProcessing(false);
    abortControllerRef.current = true;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseSrt(content);
        setCues(parsed);
        setProgress(0);
        setCurrentChunkInfo('');
        setStats(null);
      }
    };
    reader.readAsText(file);
  };

  const handleModalSaveAndStart = async () => {
    const clean = normalizeApiKey(modalKeyInput.trim());
    if (!clean) {
      setModalError('Please enter a valid Google AI Studio API key.');
      return;
    }
    setIsModalVerifying(true);
    setModalError('');
    try {
      const verifyRes = await directVerifyKey(clean);
      if (verifyRes.ok) {
        const finalKey = verifyRes.correctedKey || clean;
        onUpdateSettings?.({ customApiKey: finalKey });
        setShowKeyModal(false);
        setTimeout(() => {
          startBatchTranslation(finalKey);
        }, 100);
      } else {
        setModalError(verifyRes.error || 'Failed to verify key. Please check your key at aistudio.google.com and try again.');
      }
    } catch (e: any) {
      setModalError(e.message || 'Verification failed');
    } finally {
      setIsModalVerifying(false);
    }
  };

  // High-Speed Parallel Batch Translation
  const startBatchTranslation = async (overrideKey?: string) => {
    if (cues.length === 0 || isProcessing) return;

    const activeKey = getActiveApiKey(overrideKey || customApiKey);

    // If no active key is stored, check if backend server is running and has a key
    if (!activeKey) {
      let serverHasKey = false;
      try {
        const res = await fetch('/api/health');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          serverHasKey = !!data.hasApiKey;
        }
      } catch {}

      if (!serverHasKey) {
        setShowKeyModal(true);
        return;
      }
    }

    setIsProcessing(true);
    abortControllerRef.current = false;
    setProgress(0);
    startTimeRef.current = Date.now();

    // Ultra-fast batch size: translate up to 100 cues per call so almost all files finish in 1 single call
    const CHUNK_SIZE = 100;
    const totalCues = cues.length;
    const updatedCues = [...cues];

    // Build chunks
    const chunkList: Array<{ startIndex: number; items: Array<{ id: number; text: string }> }> = [];
    for (let i = 0; i < totalCues; i += CHUNK_SIZE) {
      const slice = updatedCues.slice(i, i + CHUNK_SIZE);
      chunkList.push({
        startIndex: i,
        items: slice.map((c) => ({ id: c.id, text: c.sourceText })),
      });
    }

    let completedCues = 0;

    for (let idx = 0; idx < chunkList.length; idx++) {
      if (abortControllerRef.current) {
        setCurrentChunkInfo('Translation paused by user');
        break;
      }

      const chunk = chunkList[idx];
      let success = false;
      let attempts = 0;

      while (!success && attempts < 3 && !abortControllerRef.current) {
        attempts++;
        setCurrentChunkInfo(`Translating cues ${chunk.startIndex + 1} - ${Math.min(chunk.startIndex + chunk.items.length, totalCues)} of ${totalCues}...`);

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (activeKey) {
            headers['x-gemini-api-key'] = activeKey;
          }

          const response = await fetch('/api/translate-chunks', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              chunks: chunk.items,
              sourceLang: 'zh',
              targetLang: targetLang || 'km',
              subtitleTone,
              isSubtitle: true,
              customApiKey: activeKey,
            }),
          });

          if (response.status === 429) {
            const errData = await response.json().catch(() => ({}));
            let waitSecs = Math.min(5, Number(errData.retryAfter) || 3);
            while (waitSecs > 0 && !abortControllerRef.current) {
              setCurrentChunkInfo(`Rate limit reached. Retrying automatically in ${waitSecs}s...`);
              await new Promise((r) => setTimeout(r, 1000));
              waitSecs--;
            }
            continue;
          }

          const ct = response.headers.get('content-type') || '';
          if (response.ok && ct.includes('application/json')) {
            const data = await response.json();
            if (Array.isArray(data.results)) {
              data.results.forEach((resItem: { id: number | string; translatedText: string }) => {
                const cueIdx = updatedCues.findIndex((c) => c.id === resItem.id);
                if (cueIdx !== -1) {
                  updatedCues[cueIdx].translatedText = resItem.translatedText;
                }
              });
              setCues([...updatedCues]);
              success = true;
            }
          }
        } catch {
          // Backend /api/translate-chunks not available (e.g. static hosting)
        }

        // If backend attempt did not succeed, try direct client-side translation if active key is available
        if (!success && activeKey) {
          try {
            setCurrentChunkInfo(`Translating cues ${chunk.startIndex + 1} - ${Math.min(chunk.startIndex + chunk.items.length, totalCues)} via Google API directly...`);
            const directResults = await directTranslateChunks({
              chunks: chunk.items,
              sourceLang: 'zh',
              targetLang: targetLang || 'km',
              style: 'natural',
              subtitleTone,
              customApiKey: activeKey,
            });

            if (Array.isArray(directResults) && directResults.length > 0) {
              directResults.forEach((resItem) => {
                const cueIdx = updatedCues.findIndex((c) => c.id === resItem.id);
                if (cueIdx !== -1) {
                  updatedCues[cueIdx].translatedText = resItem.translatedText;
                }
              });
              setCues([...updatedCues]);
              success = true;
            }
          } catch (directErr) {
            console.error('Direct chunk translation failed:', directErr);
          }
        }

        if (!success) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      completedCues += chunk.items.length;
      const currentProgress = Math.min(100, Math.round((completedCues / totalCues) * 100));
      setProgress(currentProgress);

      const elapsedSecs = Math.max(0.1, (Date.now() - startTimeRef.current) / 1000);
      const currentSpeed = Math.round((completedCues / elapsedSecs) * 10) / 10;
      setStats({
        speed: currentSpeed,
        elapsed: Math.round(elapsedSecs * 10) / 10,
      });

      // Quick pause between chunks
      if (idx < chunkList.length - 1 && !abortControllerRef.current) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setIsProcessing(false);
    const anyTranslated = updatedCues.some((c) => !!c.translatedText);
    if (anyTranslated) {
      setCurrentChunkInfo('⚡ Subtitle translation completed successfully!');
      // Save to history
      const allSource = updatedCues.map((c) => c.sourceText).join('\n');
      const allTranslated = updatedCues.map((c) => c.translatedText).join('\n');
      onSaveToHistory(
        fileName || 'Subtitle Translation',
        allSource,
        allTranslated,
        updatedCues
      );
    } else {
      setCurrentChunkInfo('⚠️ Subtitle translation could not complete. Please enter a valid Gemini API key.');
      setShowKeyModal(true);
    }
  };

  const handleStopTranslation = () => {
    abortControllerRef.current = true;
    setIsProcessing(false);
  };

  const handleExportSrt = () => {
    if (cues.length === 0) return;
    const content = serializeSrt(cues, exportMode);
    const modeSuffix =
      exportMode === 'bilingual' ? '_bilingual' : exportMode === 'original' ? '_orig' : '_khmer';
    const outName =
      (fileName ? fileName.replace(/\.srt$/i, '') : 'subtitles') + `${modeSuffix}.srt`;
    downloadFile(content, outName, 'application/x-subrip');
  };

  const handleUpdateCueText = (id: number, text: string) => {
    setCues((prev) =>
      prev.map((c) => (c.id === id ? { ...c, translatedText: text } : c))
    );
  };

  const filteredCues = cues.filter(
    (c) =>
      c.sourceText.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.translatedText.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.id.toString().includes(searchFilter)
  );

  const completedCount = cues.filter((c) => c.translatedText.trim().length > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Upload Zone & Tone Selectors */}
      <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg p-6 shadow-2xl space-y-6 font-mono">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#e4e4e7] flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <span>SRT_SUBTITLE_STUDIO</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>TURBO_GEMINI_ACTIVE</span>
              </span>
            </h2>
            <p className="text-xs text-[#e4e4e7]/50">
              High-speed subtitle translator with customizable tone profiles, timing checks, and timestamp preservation.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto font-mono">
            <label className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-[#10b981] text-[#111113] hover:bg-[#059669] shadow-md transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>UPLOAD .SRT FILE</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearFile}
              disabled={cues.length === 0 && !fileName}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-[#18181b] text-[#e4e4e7]/60 hover:text-[#e4e4e7] border border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear uploaded subtitle file and reset translation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>CLEAR FILE</span>
            </button>
          </div>
        </div>

        {/* Tone Selector Options */}
        <div className="pt-4 border-t border-[#e4e4e7]/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>SUBTITLE_TRANSLATION_TONE (ជ្រើសរើសទម្រង់សម្លេងអត្ថបទរង):</span>
            </label>

            {/* Speed mode toggle */}
            <div className="flex items-center gap-1 text-xs bg-[#111113] p-1 rounded border border-[#e4e4e7]/10">
              <button
                onClick={() => setSpeedMode('turbo')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  speedMode === 'turbo'
                    ? 'bg-[#10b981] text-[#111113] shadow-xs'
                    : 'text-[#e4e4e7]/60 hover:text-[#e4e4e7]'
                }`}
              >
                <Zap className="w-3 h-3 text-amber-300" />
                <span>TURBO_PARALLEL</span>
              </button>
              <button
                onClick={() => setSpeedMode('standard')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  speedMode === 'standard'
                    ? 'bg-[#10b981] text-[#111113] shadow-xs'
                    : 'text-[#e4e4e7]/60 hover:text-[#e4e4e7]'
                }`}
              >
                <Gauge className="w-3 h-3" />
                <span>STANDARD</span>
              </button>
            </div>
          </div>

          {/* Tone Cards / Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Short Sentence */}
            <button
              onClick={() => setSubtitleTone('short')}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                subtitleTone === 'short'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-[#111113] border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#e4e4e7]">Short Sentence</span>
                {subtitleTone === 'short' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[#e4e4e7]/50 leading-snug">
                ប្រយោគខ្លី • Crisp &amp; compact for fast screen reading limits.
              </p>
            </button>

            {/* 2. Natural / Colloquial */}
            <button
              onClick={() => setSubtitleTone('natural')}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                subtitleTone === 'natural'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-[#111113] border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#e4e4e7]">Natural Speech</span>
                {subtitleTone === 'natural' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[#e4e4e7]/50 leading-snug">
                ធម្មជាតិ • Authentic colloquial everyday movie dialogues.
              </p>
            </button>

            {/* 3. Creative / Cinematic */}
            <button
              onClick={() => setSubtitleTone('creative')}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                subtitleTone === 'creative'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-[#111113] border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#e4e4e7]">Creative / Cinema</span>
                {subtitleTone === 'creative' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[#e4e4e7]/50 leading-snug">
                ច្នៃប្រឌិត • Expressive, dramatic, cinematic phrasing &amp; punch.
              </p>
            </button>

            {/* 4. Formal / Documentary */}
            <button
              onClick={() => setSubtitleTone('formal')}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                subtitleTone === 'formal'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-[#111113] border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#e4e4e7]">Formal Document</span>
                {subtitleTone === 'formal' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[#e4e4e7]/50 leading-snug">
                ផ្លូវការ • Polished, dignified Khmer for documentaries &amp; news.
              </p>
            </button>

            {/* 5. Literal / Direct */}
            <button
              onClick={() => setSubtitleTone('literal')}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                subtitleTone === 'literal'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
                  : 'bg-[#111113] border-[#e4e4e7]/10 hover:border-[#e4e4e7]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[#e4e4e7]">Literal Direct</span>
                {subtitleTone === 'literal' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-[#e4e4e7]/50 leading-snug">
                តាមន័យដើម • Word-for-word direct translation for learners.
              </p>
            </button>
          </div>
        </div>

        {/* File & Live Progress Metrics */}
        {cues.length > 0 && (
          <div className="pt-4 border-t border-[#e4e4e7]/10 space-y-4 font-mono">
            <div className="flex flex-wrap items-center justify-between text-xs text-[#e4e4e7] gap-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-[#e4e4e7] uppercase">{fileName || 'Untitled.srt'}</span>
                <span className="text-[#e4e4e7]/50">
                  ({cues.length} CUES • {completedCount} TRANSLATED)
                </span>
                {stats && (
                  <span className="text-emerald-400 font-mono font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 text-[11px]">
                    ⚡ {stats.speed} CUES/S
                  </span>
                )}
              </div>

              {/* Start / Pause translation buttons */}
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <button
                    onClick={handleStopTranslation}
                    className="flex items-center gap-2 px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md transition cursor-pointer font-mono"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>PAUSE TRANSLATION</span>
                  </button>
                ) : (
                  <button
                    onClick={() => startBatchTranslation()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wider bg-[#10b981] hover:bg-[#059669] text-[#111113] shadow-md transition cursor-pointer font-mono"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {completedCount > 0 ? 'RETRANSLATE WITH CHOSEN TONE' : 'START FAST TRANSLATION'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Progress Bar */}
            {(isProcessing || progress > 0) && (
              <div className="space-y-2 bg-[#111113] p-3.5 rounded border border-[#e4e4e7]/10 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#e4e4e7] flex items-center gap-2">
                    {isProcessing && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
                    <span>{currentChunkInfo || 'Processing...'}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    {stats && (
                      <span className="text-[#e4e4e7]/50 text-[11px]">
                        ELAPSED: {stats.elapsed}s
                      </span>
                    )}
                    <span className="font-mono font-bold text-emerald-400 text-sm">{progress}%</span>
                  </div>
                </div>
                <div className="w-full bg-[#18181b] h-2 rounded border border-[#e4e4e7]/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#10b981] transition-all duration-300 rounded"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtitles Timeline & Editor */}
      {cues.length > 0 ? (
        <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl font-mono">
          {/* Subtitle toolbar */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#111113] border-b border-[#e4e4e7]/10 gap-3 text-xs text-[#e4e4e7]/50 font-mono">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Filter cues by text, timing, or ID..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#18181b] border border-[#e4e4e7]/10 text-xs text-[#e4e4e7] rounded p-2 w-48 sm:w-64 focus:outline-hidden focus:border-emerald-500 placeholder:text-[#e4e4e7]/30"
              />
              <span className="text-xs text-[#e4e4e7]/50">
                SHOWING {filteredCues.length} OF {cues.length}
              </span>
            </div>

            {/* Export options */}
            <div className="flex items-center gap-2">
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as any)}
                className="bg-[#18181b] border border-[#e4e4e7]/10 text-xs text-[#e4e4e7] rounded p-2 focus:outline-hidden cursor-pointer"
              >
                <option value="translated">Khmer Only (.srt)</option>
                <option value="bilingual">Bilingual Subtitles (ខ្មែរ + 中文)</option>
                <option value="original">Original Only (.srt)</option>
              </select>

              <button
                onClick={handleExportSrt}
                disabled={completedCount === 0 && exportMode !== 'original'}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded bg-[#10b981] hover:bg-[#059669] disabled:opacity-40 text-black transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT .SRT</span>
              </button>
            </div>
          </div>

          {/* Cues List */}
          <div className="divide-y divide-[#e4e4e7]/10 max-h-[620px] overflow-y-auto">
            {filteredCues.map((cue) => {
              const durationSecs = computeDurationSecs(cue.startTime, cue.endTime);
              const charCount = cue.translatedText.length;
              const charsPerSec = Math.round((charCount / durationSecs) * 10) / 10;
              const isFastPaced = charCount > 0 && charsPerSec > 16;

              return (
                <div
                  key={cue.id}
                  className="p-4 hover:bg-[#111113]/50 transition-colors flex flex-col md:flex-row gap-4 items-start"
                >
                  {/* Cue meta */}
                  <div className="w-full md:w-44 shrink-0 flex items-center md:flex-col md:items-start justify-between gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                        #{cue.id}
                      </span>
                      <span className="text-[10px] text-[#e4e4e7]/60 bg-[#111113] border border-[#e4e4e7]/10 px-1.5 py-0.5 rounded font-mono">
                        {durationSecs}s
                      </span>
                    </div>

                    <div className="font-mono text-[11px] text-slate-400">
                      {cue.startTime}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 hidden md:block">
                      ↓ {cue.endTime}
                    </div>

                    <button
                      onClick={() => speakText(cue.sourceText, 'zh')}
                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                      title="Listen to original line"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Source text (Chinese) */}
                  <div className="flex-1 font-chinese text-[#e4e4e7] text-sm leading-relaxed bg-[#111113] p-3 rounded border border-[#e4e4e7]/10">
                    {cue.sourceText}
                  </div>

                  {/* Translated text (Khmer, editable) */}
                  <div className="flex-1 w-full space-y-1.5">
                    <div className="relative">
                      <textarea
                        value={cue.translatedText}
                        onChange={(e) => handleUpdateCueText(cue.id, e.target.value)}
                        placeholder="Translation pending..."
                        rows={2}
                        className="w-full font-['Kantumruy_Pro'] text-sm leading-loose bg-[#111113] border border-[#e4e4e7]/10 focus:border-emerald-500 rounded p-3 text-emerald-300 placeholder:text-[#e4e4e7]/30 focus:outline-hidden resize-y font-mono"
                      />
                      {cue.translatedText && (
                        <button
                          onClick={() => speakText(cue.translatedText, 'km')}
                          className="absolute right-3 bottom-3 p-1.5 text-emerald-400 hover:text-emerald-300 bg-[#18181b] border border-[#e4e4e7]/10 rounded cursor-pointer"
                          title="Listen to Khmer translation"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Subtitle pacing advice if long */}
                    {charCount > 0 && (
                      <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                        <span>
                          {charCount} chars ({charsPerSec} c/s)
                        </span>
                        {isFastPaced && (
                          <span className="text-amber-400 text-[10px] bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.2 rounded">
                            Fast pacing — Consider 'Short Sentence' tone
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl font-mono">
          {/* Header bar matching INPUT_BUFFER / SOURCE_TEXT */}
          <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
            <span>INPUT_BUFFER / SUBTITLE_SOURCE</span>
            <span>SRT_UTF8</span>
          </div>

          {/* Central Body Content */}
          <div className="p-10 text-center flex flex-col items-center justify-center space-y-3.5 bg-transparent">
            <div className="w-12 h-12 rounded bg-[#111113] border border-[#e4e4e7]/10 flex items-center justify-center mb-1">
              <Film className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-[#e4e4e7] uppercase tracking-wider">
              No Subtitle File Loaded
            </h3>
            <p className="text-xs text-[#e4e4e7]/50 max-w-lg leading-relaxed">
              Upload your .srt file to begin high-speed subtitle translation with customizable Khmer tones (Short, Natural, Creative, Formal, Literal).
            </p>
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-black font-bold uppercase tracking-wider text-xs rounded transition shadow-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Select .SRT File to Translate</span>
                <input
                  type="file"
                  accept=".srt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Footer bar matching INPUT_BUFFER / SOURCE_TEXT */}
          <div className="px-4 py-2.5 bg-[#111113] border-t border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
            <span>METRICS: 0 CUES / 0 CHARS</span>
            <div className="flex items-center gap-3">
              <label className="hover:text-emerald-400 transition cursor-pointer flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>IMPORT .SRT</span>
                <input
                  type="file"
                  accept=".srt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Key Prompt Modal for Hosted Website Setup */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 font-mono">
          <div className="w-full max-w-lg bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg shadow-2xl overflow-hidden flex flex-col text-[#e4e4e7]">
            <div className="px-5 py-4 border-b border-[#e4e4e7]/10 flex items-center justify-between bg-[#111113]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#e4e4e7]">
                  API_KEY_REQUIRED_FOR_SUBTITLES
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded text-[#e4e4e7]/60 hover:text-[#e4e4e7] hover:bg-[#18181b] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-mono">
              <p className="text-[#e4e4e7]/70 leading-relaxed">
                When running on a hosted website, translating subtitles requires your Google AI Studio Gemini API key. Enter it below to start translation instantly.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-[#e4e4e7]/50 block">
                  Google AI Studio API Key (AIzaSy...)
                </label>
                <input
                  type="password"
                  value={modalKeyInput}
                  onChange={(e) => setModalKeyInput(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="w-full bg-[#111113] border border-[#e4e4e7]/20 rounded p-2.5 text-xs text-[#e4e4e7] placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              {modalError && (
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-[#e4e4e7]/50 pt-1">
                <span>Free tier includes fast generation</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="pt-3 border-t border-[#e4e4e7]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-2 rounded bg-[#111113] hover:bg-[#1f1f23] text-[#e4e4e7]/60 text-xs font-bold uppercase transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleModalSaveAndStart}
                  disabled={isModalVerifying || !modalKeyInput.trim()}
                  className="px-4 py-2 rounded bg-[#10b981] hover:bg-[#059669] text-black text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isModalVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Start Translating</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
