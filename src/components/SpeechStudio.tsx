import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Radio,
  BookOpen,
} from 'lucide-react';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
  VoiceRecognitionController,
  speakText,
} from '../utils/speech';
import { TranslationStyle } from '../types';

interface SpeechStudioProps {
  onSaveToHistory: (
    title: string,
    sourceText: string,
    translatedText: string,
    fileType: 'voice'
  ) => void;
  style: TranslationStyle;
  targetLang: string;
}

const QUICK_VOICE_PROMPTS = [
  '您好，请问吴哥窟的日出几点开始？',
  '我想去金边皇宫参观，请问门票多少钱？',
  '祝你在柬埔寨旅行愉快，生活幸福美满！',
  '这家餐厅的阿莫克鱼（Amok）非常地道美味。',
  '很高兴认识你，欢迎来到美丽的柬埔寨！',
];

export const SpeechStudio: React.FC<SpeechStudioProps> = ({
  onSaveToHistory,
  style,
  targetLang,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [sourceLang, setSourceLang] = useState<'zh' | 'zh-TW' | 'km' | 'en'>('zh');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);

  const recognizerRef = useRef<VoiceRecognitionController | null>(null);
  const isSupported = isSpeechRecognitionSupported();

  const handleTranslate = async (textToTranslate: string) => {
    if (!textToTranslate.trim() || isTranslating) return;

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLang,
          targetLang: targetLang || 'km',
          style,
          context: 'conversation',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranslatedText(data.translatedText || '');
        onSaveToHistory(
          'Live Voice Translation',
          textToTranslate,
          data.translatedText || '',
          'voice'
        );
      }
    } catch (e: any) {
      console.error('Speech translation failed:', e);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      if (autoTranslate && transcript.trim()) {
        handleTranslate(transcript);
      }
    } else {
      setErrorMsg('');
      const recognizer = createSpeechRecognizer(
        sourceLang,
        (text, isFinal) => {
          if (isFinal) {
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${text}` : text;
              if (autoTranslate) {
                handleTranslate(updated);
              }
              return updated;
            });
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        (err) => {
          setErrorMsg(err);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );

      if (recognizer) {
        recognizerRef.current = recognizer;
        recognizer.start();
        setIsListening(true);
      } else {
        setErrorMsg('Microphone access or speech recognition is not supported in this browser.');
      }
    }
  };

  const handleSelectQuickPrompt = (prompt: string) => {
    setTranscript(prompt);
    handleTranslate(prompt);
  };

  const handleCopy = async (text: string, isOrig: boolean) => {
    await navigator.clipboard.writeText(text);
    if (isOrig) {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedTranslated(true);
      setTimeout(() => setCopiedTranslated(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-rose-500" />
              <span>Real-Time Voice Dictation &amp; Speech Translation</span>
            </h2>
            <p className="text-xs text-slate-400">
              Speak in Chinese (or other supported languages) to receive live speech transcription and instant spoken Khmer translations.
            </p>
          </div>

          {/* Language selector & Auto-translate toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span>Spoken Language:</span>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value as any)}
                className="bg-transparent text-white font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="zh" className="bg-slate-900">Chinese (Mandarin)</option>
                <option value="zh-TW" className="bg-slate-900">Chinese (Traditional)</option>
                <option value="km" className="bg-slate-900">Khmer (ភាសាខ្មែរ)</option>
                <option value="en" className="bg-slate-900">English</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <input
                type="checkbox"
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
                className="rounded text-rose-600 focus:ring-0"
              />
              <span>Auto-translate</span>
            </label>
          </div>
        </div>

        {/* Microphone action button & Waveform */}
        <div className="mt-8 flex flex-col items-center justify-center space-y-4 py-4">
          <button
            onClick={toggleListening}
            className={`relative p-6 rounded-full transition-all duration-300 shadow-xl cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white shadow-rose-600/50 scale-105'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-rose-500/40 animate-ping" />
            )}
            {isListening ? <MicOff className="w-8 h-8 relative z-10" /> : <Mic className="w-8 h-8 relative z-10" />}
          </button>

          <div className="text-center space-y-1">
            <div className="text-sm font-semibold text-white flex items-center justify-center gap-2">
              {isListening ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Listening... Speak into microphone</span>
                </>
              ) : (
                <span>Tap microphone to start speaking</span>
              )}
            </div>
            <div className="text-xs text-slate-400">
              Supports continuous voice recognition with noise reduction
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-800/40">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Quick test prompts */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Or click a quick spoken phrase to test:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_VOICE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectQuickPrompt(prompt)}
                className="text-xs font-chinese px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300 hover:border-rose-500 hover:text-white transition cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-Side Live Voice Transcripts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spoken Transcription (Original) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col min-h-[260px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-500" />
              <span>Voice Transcript ({sourceLang.toUpperCase()})</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => speakText(transcript, sourceLang)}
                disabled={!transcript}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Listen to transcription"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCopy(transcript, true)}
                disabled={!transcript}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Copy transcript"
              >
                {copiedOriginal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex-1 font-chinese text-slate-100 text-base leading-relaxed overflow-y-auto max-h-[300px]">
            {transcript ? (
              <span>{transcript}</span>
            ) : (
              <span className="text-slate-600 italic">Spoken words will appear here in real time...</span>
            )}
            {interimText && (
              <span className="text-slate-400 italic ml-1">...{interimText}</span>
            )}
          </div>

          {transcript && (
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => {
                  setTranscript('');
                  setTranslatedText('');
                }}
                className="text-xs text-slate-500 hover:text-rose-400"
              >
                Clear
              </button>
              <button
                onClick={() => handleTranslate(transcript)}
                disabled={isTranslating}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
              >
                {isTranslating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                <span>Translate to Khmer</span>
              </button>
            </div>
          )}
        </div>

        {/* Real-time Khmer Translation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col min-h-[260px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Khmer Translation (ភាសាខ្មែរ)</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => speakText(translatedText, 'km')}
                disabled={!translatedText}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Speak Khmer translation"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCopy(translatedText, false)}
                disabled={!translatedText}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Copy translation"
              >
                {copiedTranslated ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex-1 font-khmer text-slate-100 text-base leading-loose overflow-y-auto max-h-[300px]">
            {isTranslating ? (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                <span>Generating Khmer translation with Gemini AI...</span>
              </div>
            ) : translatedText ? (
              <span>{translatedText}</span>
            ) : (
              <span className="text-slate-600 italic">Translated speech will appear here...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
