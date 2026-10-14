import React, { useState, useEffect } from 'react';
import { KeyRound, Check, ExternalLink, RefreshCw, X, ShieldAlert, Sparkles } from 'lucide-react';
import { AppSettings } from '../types';
import { directVerifyKey, getActiveApiKey, normalizeApiKey } from '../utils/geminiDirect';

interface ApiKeyBannerProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
}

export const ApiKeyBanner: React.FC<ApiKeyBannerProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [needsKey, setNeedsKey] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Check on mount if backend is alive and has an API key
  useEffect(() => {
    const activeKey = getActiveApiKey(settings.customApiKey);
    if (activeKey) {
      setNeedsKey(false);
      return;
    }

    let isMounted = true;
    const checkServerHealth = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (isMounted) {
            // If backend is running but doesn't have an API key configured
            setNeedsKey(!data.hasApiKey);
          }
        } else {
          // Response is HTML or 404 (static web hosting mode)
          if (isMounted) setNeedsKey(true);
        }
      } catch {
        // Backend unreachable (static web hosting)
        if (isMounted) setNeedsKey(true);
      }
    };

    checkServerHealth();
    return () => {
      isMounted = false;
    };
  }, [settings.customApiKey]);

  if (!needsKey || isDismissed) {
    return null;
  }

  const handleSaveAndActivate = async () => {
    const clean = normalizeApiKey(keyInput.trim());
    if (!clean) {
      setFeedback({ type: 'error', message: 'Please enter a valid Google AI Studio API key.' });
      return;
    }

    setIsVerifying(true);
    setFeedback({ type: null, message: '' });

    try {
      const verifyRes = await directVerifyKey(clean);
      if (verifyRes.ok) {
        const finalKey = verifyRes.correctedKey || clean;
        onUpdateSettings({ customApiKey: finalKey });
        setFeedback({
          type: 'success',
          message: 'Key activated! You can now translate text and subtitles on this website.',
        });
        setTimeout(() => {
          setNeedsKey(false);
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          message: verifyRes.error || 'Failed to verify API key. Please check your key at aistudio.google.com and try again.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Could not connect to Google Gemini API. Please check your internet connection.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-[#18181b] border-b border-amber-500/30 px-4 py-3 font-mono text-xs text-[#e4e4e7]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start md:items-center gap-2.5">
          <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400 tracking-wider uppercase text-[11px]">
                HOSTED_WEBSITE_SETUP
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30">
                ACTION_REQUIRED
              </span>
            </div>
            <p className="text-[11px] text-[#e4e4e7]/70 mt-0.5">
              To translate on this hosted website, connect your free Google Gemini API key.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-80">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste Google AI Studio Key (AIzaSy...)"
              className="w-full bg-[#111113] border border-[#e4e4e7]/20 rounded px-3 py-1.5 text-xs text-[#e4e4e7] placeholder:text-[#e4e4e7]/40 focus:outline-hidden focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={handleSaveAndActivate}
            disabled={isVerifying || !keyInput.trim()}
            className="px-3.5 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-black font-bold uppercase tracking-wider text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 shadow-xs"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>VERIFYING...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>SAVE_AND_ACTIVATE</span>
              </>
            )}
          </button>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 rounded bg-[#111113] hover:bg-[#1f1f23] text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center justify-center gap-1 shrink-0 transition"
          >
            <span>GET FREE KEY</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded text-[#e4e4e7]/40 hover:text-[#e4e4e7] hover:bg-[#111113] cursor-pointer shrink-0 self-end sm:self-center"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-[#e4e4e7]/10 flex items-center gap-2">
          {feedback.type === 'success' ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span
            className={`text-[11px] ${
              feedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {feedback.message}
          </span>
        </div>
      )}
    </div>
  );
};
