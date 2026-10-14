import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileCheck,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Volume2,
  FileText,
} from 'lucide-react';
import { TranslationStyle } from '../types';
import { exportToDocx, DocxParagraphItem } from '../utils/docxExport';
import { speakText } from '../utils/speech';

interface DocxStudioProps {
  onSaveToHistory: (
    title: string,
    sourceText: string,
    translatedText: string,
    fileType: 'docx' | 'text'
  ) => void;
  style: TranslationStyle;
  targetLang: string;
  customApiKey?: string;
}

const SAMPLE_DOCX_PARAGRAPHS = [
  '柬埔寨与中国之间的文化与经贸合作正在迈向崭新的高度。',
  '金边与暹粒不仅是著名的旅游目的地，更是东盟区域内极具投资活力的创新中心。',
  '双方企业在科技基础设施、可再生能源和现代农业领域的合作取得了丰硕的成果。',
  '为了促进双方青年与学者之间的深入交流，两国多所高等学府联合推出了学术奖学金计划。',
  '未来，两国将继续秉持互利共赢的原则，共同谱写和平与繁荣的崭新篇章。',
];

export const DocxStudio: React.FC<DocxStudioProps> = ({
  onSaveToHistory,
  style,
  targetLang,
  customApiKey,
}) => {
  const [items, setItems] = useState<DocxParagraphItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentChunkInfo, setCurrentChunkInfo] = useState<string>('');
  const [exportMode, setExportMode] = useState<'translated' | 'bilingual' | 'original'>('translated');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const abortControllerRef = useRef<boolean>(false);

  // Load sample paragraphs
  const handleLoadSample = () => {
    const sampleItems: DocxParagraphItem[] = SAMPLE_DOCX_PARAGRAPHS.map((text, idx) => ({
      id: idx + 1,
      sourceText: text,
      translatedText: '',
    }));
    setItems(sampleItems);
    setFileName('Cambodia_China_Cooperation_Report.docx');
    setProgress(0);
    setCurrentChunkInfo('');
  };

  // Handle DOCX / TXT upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProgress(0);
    setCurrentChunkInfo('');

    if (file.name.endsWith('.docx')) {
      setIsExtracting(true);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Data = btoa(binary);

          const res = await fetch('/api/extract-docx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data }),
          });

          if (res.ok) {
            const data = await res.json();
            const paragraphs: string[] = data.paragraphs || [];
            const docxItems: DocxParagraphItem[] = paragraphs.map((text, idx) => ({
              id: idx + 1,
              sourceText: text,
              translatedText: '',
            }));
            setItems(docxItems);
          }
          setIsExtracting(false);
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('Error reading docx:', err);
        setIsExtracting(false);
      }
    } else {
      // Plain text or markdown
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const textItems: DocxParagraphItem[] = lines.map((line, idx) => ({
          id: idx + 1,
          sourceText: line,
          translatedText: '',
        }));
        setItems(textItems);
      };
      reader.readAsText(file);
    }
  };

  // Start chunked translation
  const startTranslation = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    abortControllerRef.current = false;
    setProgress(0);

    const CHUNK_SIZE = 80;
    const total = items.length;
    const updated = [...items];

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      if (abortControllerRef.current) {
        setCurrentChunkInfo('Translation paused by user');
        break;
      }

      const chunk = updated.slice(i, i + CHUNK_SIZE).map((item) => ({
        id: item.id,
        text: item.sourceText,
      }));

      setCurrentChunkInfo(`Translating paragraphs ${i + 1} - ${Math.min(i + CHUNK_SIZE, total)} of ${total}...`);

      let success = false;
      let attempts = 0;

      while (!success && attempts < 3 && !abortControllerRef.current) {
        attempts++;
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (customApiKey && customApiKey.trim()) {
            headers['x-gemini-api-key'] = customApiKey.trim();
          }

          const response = await fetch('/api/translate-chunks', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              chunks: chunk,
              sourceLang: 'zh',
              targetLang: targetLang || 'km',
              style,
              isSubtitle: false,
              customApiKey,
            }),
          });

          if (response.status === 429) {
            const errData = await response.json().catch(() => ({}));
            let waitSecs = Math.min(5, Number(errData.retryAfter) || 3);
            while (waitSecs > 0 && !abortControllerRef.current) {
              setCurrentChunkInfo(`Rate limit reached. Retrying in ${waitSecs}s...`);
              await new Promise((r) => setTimeout(r, 1000));
              waitSecs--;
            }
            continue;
          }

          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.results)) {
              data.results.forEach((resItem: { id: number | string; translatedText: string }) => {
                const itemIdx = updated.findIndex((item) => item.id === resItem.id);
                if (itemIdx !== -1) {
                  updated[itemIdx].translatedText = resItem.translatedText;
                }
              });
              setItems([...updated]);
              success = true;
            }
          } else {
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      const p = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
      setProgress(p);

      if (i + CHUNK_SIZE < total && !abortControllerRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setIsProcessing(false);
    setCurrentChunkInfo('Document translation complete!');

    const allSource = updated.map((i) => i.sourceText).join('\n\n');
    const allTranslated = updated.map((i) => i.translatedText).join('\n\n');
    onSaveToHistory(
      fileName || 'Word Document Translation',
      allSource,
      allTranslated,
      'docx'
    );
  };

  const handleStop = () => {
    abortControllerRef.current = true;
    setIsProcessing(false);
  };

  const handleExportDocx = async () => {
    if (items.length === 0) return;
    const modeSuffix = exportMode === 'bilingual' ? '_bilingual' : exportMode === 'original' ? '_orig' : '_khmer';
    const outName = (fileName ? fileName.replace(/\.docx$/i, '').replace(/\.txt$/i, '') : 'document') + `${modeSuffix}.docx`;
    await exportToDocx(items, outName, exportMode, `Translation: ${fileName || 'Document'}`);
  };

  const handleUpdateItem = (id: number | string, text: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, translatedText: text } : item))
    );
  };

  const completedCount = items.filter((i) => i.translatedText.trim().length > 0).length;

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <span>Word (.docx) &amp; Text Document Processor</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Large File Support
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload Microsoft Word (.docx) or Text documents. Translate paragraphs into natural Khmer with batching and export back into a formatted .docx file.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <label className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Upload .DOCX or .TXT</span>
              <input
                type="file"
                accept=".docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700/80 hover:bg-slate-700 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Sample Document</span>
            </button>
          </div>
        </div>

        {/* Loading / Extraction indicator */}
        {isExtracting && (
          <div className="mt-4 flex items-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/40">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Extracting Word document paragraphs via Mammoth...</span>
          </div>
        )}

        {/* Progress & Controls */}
        {items.length > 0 && !isExtracting && (
          <div className="mt-5 pt-5 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white">{fileName || 'Document.docx'}</span>
                <span className="text-slate-500">
                  ({items.length} paragraphs • {completedCount} translated)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={startTranslation}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{completedCount > 0 ? 'Resume / Retranslate' : 'Translate All Paragraphs'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real-time Progress Bar */}
            {(isProcessing || progress > 0) && (
              <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    {isProcessing && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
                    <span>{currentChunkInfo || 'Processing paragraphs...'}</span>
                  </span>
                  <span className="font-mono font-bold text-indigo-400">{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-400 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paragraphs Display and Export Area */}
      {items.length > 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950/70 border-b border-slate-800 gap-3">
            <span className="text-xs font-semibold text-slate-300">
              Document Paragraphs ({items.length})
            </span>

            <div className="flex items-center gap-2">
              <select
                value={exportMode}
                onChange={(e) => setExportMode(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="translated">Khmer Only (.docx)</option>
                <option value="bilingual">Bilingual Document (ខ្មែរ + 中文)</option>
                <option value="original">Original Only (.docx)</option>
              </select>

              <button
                onClick={handleExportDocx}
                disabled={completedCount === 0 && exportMode !== 'original'}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Word (.docx)</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 hover:bg-slate-850/50 transition-colors flex flex-col md:flex-row gap-4 items-start"
              >
                <div className="w-12 shrink-0 flex items-center justify-between md:flex-col md:items-start">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    §{item.id}
                  </span>
                  <button
                    onClick={() => speakText(item.sourceText, 'zh')}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer mt-1"
                    title="Listen to Chinese paragraph"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 font-chinese text-slate-200 text-sm leading-relaxed bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
                  {item.sourceText}
                </div>

                <div className="flex-1 w-full relative">
                  <textarea
                    value={item.translatedText}
                    onChange={(e) => handleUpdateItem(item.id, e.target.value)}
                    placeholder="Translation will appear here..."
                    rows={3}
                    className="w-full font-khmer text-sm leading-loose bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 rounded-xl p-3 text-sky-100 placeholder:text-slate-600 focus:outline-hidden resize-y"
                  />
                  {item.translatedText && (
                    <button
                      onClick={() => speakText(item.translatedText, 'km')}
                      className="absolute right-3 bottom-3 p-1 text-sky-400 hover:text-sky-300 bg-slate-900 rounded-md cursor-pointer"
                      title="Listen to Khmer translation"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-950/30">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Document Uploaded</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Upload any .docx Word file or click "Load Sample Document" to test chunked paragraph translation and Word file export.
          </p>
          <button
            onClick={handleLoadSample}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Load Sample Cooperation Report
          </button>
        </div>
      )}
    </div>
  );
};
