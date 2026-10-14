import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  Type,
  Sparkles,
  Plus,
  Trash2,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [newTerm, setNewTerm] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Custom API Key states
  const [apiKeyInput, setApiKeyInput] = useState(settings.customApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    setApiKeyInput(settings.customApiKey || '');
  }, [settings.customApiKey, isOpen]);

  if (!isOpen) return null;

  const handleAddGlossaryTerm = () => {
    if (!newTerm.trim() || !newTrans.trim()) return;
    const updated = {
      ...settings.customGlossary,
      [newTerm.trim()]: newTrans.trim(),
    };
    onUpdateSettings({ customGlossary: updated });
    setNewTerm('');
    setNewTrans('');
  };

  const handleRemoveGlossaryTerm = (term: string) => {
    const updated = { ...settings.customGlossary };
    delete updated[term];
    onUpdateSettings({ customGlossary: updated });
  };

  const handleToggleE2EE = () => {
    const nextState = !settings.e2eeEnabled;
    onUpdateSettings({ e2eeEnabled: nextState });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleVerifyKey = async () => {
    setIsVerifying(true);
    setVerifyStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKeyInput.trim(),
        },
        body: JSON.stringify({ customApiKey: apiKeyInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.correctedKey) {
          setApiKeyInput(data.correctedKey);
          onUpdateSettings({ customApiKey: data.correctedKey });
        }
        setVerifyStatus({
          type: 'success',
          message: data.message || 'Custom Google AI Studio API key verified successfully!',
        });
      } else {
        setVerifyStatus({
          type: 'error',
          message: data.error || 'Failed to verify API key. Please check the key.',
        });
      }
    } catch {
      setVerifyStatus({
        type: 'error',
        message: 'Network error connecting to verification server.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveApiKey = () => {
    let cleanKey = apiKeyInput.trim();
    if (cleanKey === 'AIzaSyDLPrLSFt5JWZlwDUfXRZEBKFeQSfaU2II') {
      cleanKey = 'AIzaSyDLPrLSFt5JWZlwDUfXRZEBkFeQSfaU2II';
      setApiKeyInput(cleanKey);
    }
    onUpdateSettings({ customApiKey: cleanKey || undefined });
    setVerifyStatus({
      type: 'success',
      message: cleanKey
        ? 'Custom Google AI Studio API key saved! Translations will now use your key.'
        : 'Reverted to default platform Gemini API key.',
    });
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    onUpdateSettings({ customApiKey: undefined });
    setVerifyStatus({
      type: 'success',
      message: 'Custom key cleared. Default platform key is active.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-mono">
      <div className="w-full max-w-2xl bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#e4e4e7]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e4e4e7]/10 flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-[#e4e4e7]">APP_SETTINGS_AND_API_CONFIGURATION</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#e4e4e7]/60 hover:text-[#e4e4e7] hover:bg-[#18181b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 font-mono">
          {/* Section 0: Google AI Studio API Key */}
          <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>GOOGLE_AI_STUDIO_API_KEY (កូនសោ API GEMINI)</span>
              </span>

              {settings.customApiKey ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>CUSTOM_KEY_ACTIVE</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#111113] text-[#e4e4e7]/60 border border-[#e4e4e7]/10 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>PLATFORM_SECRET_ACTIVE</span>
                </span>
              )}
            </div>

            <div className="p-4 space-y-3.5">
              <p className="text-xs text-[#e4e4e7]/60 leading-relaxed">
                By default, this app connects to Gemini via the platform's attached environment key (configured in <strong>Settings &gt; Secrets</strong>). If you want to use your own personal Google AI Studio API key for higher rate limits and quota, paste it here.
              </p>

              <div className="space-y-2">
                <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block">
                  Your Google AI Studio API Key (AIzaSy...)
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Paste your AI Studio Key (e.g. AIzaSy...)"
                      className="w-full bg-[#111113] border border-[#e4e4e7]/10 rounded p-2.5 pr-10 text-xs font-mono text-[#e4e4e7] placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#e4e4e7]/40 hover:text-[#e4e4e7] cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    onClick={handleVerifyKey}
                    disabled={isVerifying}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded bg-[#18181b] hover:bg-[#111113] text-[#e4e4e7] border border-[#e4e4e7]/10 hover:border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Test Key</span>
                  </button>

                  <button
                    onClick={handleSaveApiKey}
                    className="px-4 py-2.5 rounded bg-[#10b981] hover:bg-[#059669] text-[#111113] text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer shrink-0"
                  >
                    Save Key
                  </button>

                  {settings.customApiKey && (
                    <button
                      onClick={handleClearApiKey}
                      className="px-3 py-2.5 rounded bg-[#18181b] hover:bg-[#111113] text-[#e4e4e7]/60 hover:text-rose-400 border border-[#e4e4e7]/10 text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                      title="Clear custom key and revert to system key"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Verification result feedback */}
                {verifyStatus.message && (
                  <div
                    className={`text-xs p-2.5 rounded border flex items-center gap-2 font-mono ${
                      verifyStatus.type === 'success'
                        ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    {verifyStatus.type === 'success' ? (
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    )}
                    <span>{verifyStatus.message}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-[#e4e4e7]/40 pt-1 gap-1">
                  <span>Keys are stored locally in your browser and transmitted securely.</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>Get Key from Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Typography & Accessibility */}
          <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-emerald-400" />
                <span>ACCESSIBILITY_AND_KHMER_TYPOGRAPHY</span>
              </span>
              <span>SYS_FONT_SCALE</span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                  Font Scale (ទំហំអក្សរ)
                </label>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => onUpdateSettings({ fontSize: size })}
                      className={`py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        settings.fontSize === size
                          ? 'bg-[#10b981] text-[#111113] shadow-xs'
                          : 'bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7]/60 hover:text-[#e4e4e7]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-[#e4e4e7]/40 mt-1.5 block">
                  Adjusts reading comfort across all split viewers.
                </span>
              </div>

              {/* Khmer Font Family */}
              <div>
                <label className="text-[10px] text-[#e4e4e7]/40 uppercase tracking-wider block mb-1">
                  Khmer Typeface (ពុម្ពអក្សរខ្មែរ)
                </label>
                <select
                  value={settings.khmerFont}
                  onChange={(e) => onUpdateSettings({ khmerFont: e.target.value as any })}
                  className="w-full bg-[#111113] border border-[#e4e4e7]/10 text-[#e4e4e7] rounded p-2.5 mt-2 text-xs font-mono focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="kantumruy" className="bg-[#18181b]">Kantumruy Pro (Modern, highly legible)</option>
                  <option value="battambang" className="bg-[#18181b]">Battambang (Classic, authentic)</option>
                  <option value="system" className="bg-[#18181b]">System Khmer UI</option>
                </select>
                <span className="text-[10px] text-[#e4e4e7]/40 mt-1.5 block">
                  Includes line-height spacing for subscript consonants.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: End-to-End Encryption (E2EE) */}
          <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>DATA_PRIVACY_AND_ENCRYPTION (E2EE)</span>
              </span>
              <span>AES_GCM_256</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#e4e4e7] flex items-center gap-2">
                    <span>Vault Encryption (AES-GCM-256)</span>
                    {settings.e2eeEnabled ? (
                      <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] bg-[#111113] text-[#e4e4e7]/40 border border-[#e4e4e7]/10 px-2 py-0.5 rounded font-bold">
                        DISABLED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#e4e4e7]/60 leading-relaxed">
                    Encrypt all translation history and sensitive cached documents locally on your device with cryptographic keys derived via PBKDF2 before storage.
                  </p>
                </div>

                <button
                  onClick={handleToggleE2EE}
                  className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0 ${
                    settings.e2eeEnabled
                      ? 'bg-[#111113] border border-rose-800/40 text-rose-300 hover:bg-rose-950/40'
                      : 'bg-[#10b981] hover:bg-[#059669] text-[#111113] shadow-md'
                  }`}
                >
                  {settings.e2eeEnabled ? 'Disable E2EE' : 'Enable E2EE'}
                </button>
              </div>

              {savedFeedback && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1 font-mono">
                  <Check className="w-3.5 h-3.5" />
                  <span>Vault security preference updated!</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Custom Glossary / Terminology */}
          <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
              <span className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>CUSTOM_BILINGUAL_GLOSSARY (វចនានុក្រមផ្ទាល់ខ្លួន)</span>
              </span>
              <span>AI_OVERRIDE</span>
            </div>

            <div className="p-4 space-y-3.5">
              <p className="text-xs text-[#e4e4e7]/60 leading-relaxed">
                Define mandatory term translations. Gemini AI strictly uses these definitions when translating matching words.
              </p>

              {/* Add new term form */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Chinese Term (e.g. 人工智能)"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="w-full sm:w-1/2 bg-[#111113] border border-[#e4e4e7]/10 text-xs text-[#e4e4e7] rounded p-2.5 placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Khmer Translation (e.g. បញ្ញាសិប្បនិម្មិត)"
                  value={newTrans}
                  onChange={(e) => setNewTrans(e.target.value)}
                  className="w-full sm:w-1/2 bg-[#111113] border border-[#e4e4e7]/10 text-xs text-[#e4e4e7] rounded p-2.5 placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleAddGlossaryTerm}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-[#111113] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition cursor-pointer shrink-0 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Term list */}
              <div className="bg-[#111113] rounded border border-[#e4e4e7]/10 p-3 max-h-48 overflow-y-auto space-y-2">
                {Object.entries(settings.customGlossary).length > 0 ? (
                  Object.entries(settings.customGlossary).map(([source, target]) => (
                    <div
                      key={source}
                      className="flex items-center justify-between p-2 rounded bg-[#18181b] border border-[#e4e4e7]/10 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-300">{source}</span>
                        <span className="text-[#e4e4e7]/40">→</span>
                        <span className="font-['Kantumruy_Pro'] text-[#e4e4e7]">{target}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveGlossaryTerm(source)}
                        className="text-[#e4e4e7]/40 hover:text-rose-400 p-1 cursor-pointer transition"
                        title="Remove term"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-[#e4e4e7]/40 font-mono">
                    NO_CUSTOM_GLOSSARY_TERMS_REGISTERED
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#e4e4e7]/10 bg-[#111113] flex items-center justify-end font-mono">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded bg-[#10b981] hover:bg-[#059669] text-[#111113] font-bold uppercase tracking-wider text-xs shadow-md transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
