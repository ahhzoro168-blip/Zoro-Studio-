import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TranslationStudio } from './components/TranslationStudio';
import { SubtitleStudio } from './components/SubtitleStudio';
import { DictionaryDrawer } from './components/DictionaryDrawer';
import { HistoryDrawer } from './components/HistoryDrawer';
import { SettingsModal } from './components/SettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ApiKeyBanner } from './components/ApiKeyBanner';
import {
  HistoryItem,
  AppSettings,
  TranslationResult,
  TranslationStyle,
  TranslationContext,
  SubtitleCue,
} from './types';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  addHistoryItem,
  deleteHistoryItem,
  togglePinHistoryItem,
  saveHistory,
} from './utils/storage';
import { directTranslate, getActiveApiKey } from './utils/geminiDirect';

export default function App() {
  const [activeTab, setActiveTab] = useState<'text' | 'srt'>('text');
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory());

  // Drawers and Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryLookupWord, setDictionaryLookupWord] = useState('');

  // Selected history item state for re-opening
  const [selectedSourceText, setSelectedSourceText] = useState('');
  const [selectedTranslatedText, setSelectedTranslatedText] = useState('');

  // Apply font scale & theme to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings.fontSize]);

  // Update settings helper
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  // Perform translation via Express server API or direct Gemini API when hosted on static hosting
  const handleTranslate = async (
    text: string,
    sourceLang: string,
    targetLang: string,
    style: TranslationStyle,
    context: TranslationContext
  ): Promise<TranslationResult | null> => {
    let data: TranslationResult | null = null;

    try {
      const activeKey = getActiveApiKey(settings.customApiKey);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeKey) {
        headers['x-gemini-api-key'] = activeKey;
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          sourceLang,
          targetLang,
          style,
          context,
          glossary: settings.customGlossary,
          customApiKey: activeKey,
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If the server returns HTML (static host 404 rewrite) or 404
        if (contentType.includes('text/html') || response.status === 404) {
          throw new Error('BACKEND_UNAVAILABLE');
        }
        const errorData = await response.json().catch(() => null);
        if (!errorData) {
          throw new Error('BACKEND_UNAVAILABLE');
        }
        if (
          errorData.error === 'API_KEY_REQUIRED' ||
          errorData.error?.includes('API_KEY_REQUIRED') ||
          errorData.error?.includes('Must provide an API key')
        ) {
          throw new Error('API_KEY_REQUIRED: No Gemini API key provided. Please configure your API key to translate.');
        }
        throw new Error(errorData.error || 'Failed to translate');
      }
    } catch (err: any) {
      const activeKey = getActiveApiKey(settings.customApiKey);
      // If backend is unavailable or lacks key, try direct client-side Gemini API
      if (activeKey) {
        try {
          data = await directTranslate({
            text,
            sourceLang,
            targetLang,
            style,
            context,
            customApiKey: activeKey,
            glossary: settings.customGlossary,
          });
        } catch (directErr: any) {
          console.error('Direct translation error:', directErr);
          throw new Error(directErr.message || 'Direct Gemini translation failed');
        }
      } else {
        // Backend unreachable or has no key, and no user key provided
        throw new Error(
          'API_KEY_REQUIRED: On hosted websites, a Google AI Studio Gemini API key is required to translate. Please enter your free key in the prompt or Settings (⚙️).'
        );
      }
    }

    if (!data) {
      throw new Error('Translation returned no output');
    }

    // Automatically add to history log
    const historyItem: HistoryItem = {
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: text.slice(0, 36) + (text.length > 36 ? '...' : ''),
      timestamp: Date.now(),
      sourceLang,
      targetLang,
      sourceText: text,
      translatedText: data.translatedText,
      fileType: 'text',
      segments: data.segments,
      charCount: text.length,
      isEncrypted: settings.e2eeEnabled,
    };

    const updatedHistory = addHistoryItem(historyItem);
    setHistory(updatedHistory);

    return data;
  };

  // Save subtitle translation to history
  const handleSaveToHistory = (
    title: string,
    sourceText: string,
    translatedText: string,
    fileTypeOrCues: SubtitleCue[]
  ) => {
    const historyItem: HistoryItem = {
      id: `history_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'Saved Subtitles',
      timestamp: Date.now(),
      sourceLang: 'zh',
      targetLang: 'km',
      sourceText,
      translatedText,
      fileType: 'srt',
      subtitles: fileTypeOrCues,
      charCount: sourceText.length,
      isEncrypted: settings.e2eeEnabled,
    };

    const updated = addHistoryItem(historyItem);
    setHistory(updated);
  };

  // Re-open history item
  const handleSelectHistoryItem = (item: HistoryItem) => {
    if (item.fileType === 'srt') {
      setActiveTab('srt');
    } else {
      setActiveTab('text');
      setSelectedSourceText(item.sourceText);
      setSelectedTranslatedText(item.translatedText);
    }
  };

  // Word lookup in dictionary drawer
  const handleWordLookup = (word: string) => {
    setDictionaryLookupWord(word);
    setIsDictionaryOpen(true);
  };

  const handleAddGlossaryTerm = (term: string, translation: string) => {
    const updated = {
      ...settings.customGlossary,
      [term]: translation,
    };
    handleUpdateSettings({ customGlossary: updated });
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#e4e4e7] flex flex-col font-mono selection:bg-[#10b981] selection:text-[#111113]">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBackup={() => setIsHistoryOpen(true)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Hosted Website Setup Banner (shows automatically when hosted without a built-in server key) */}
      <ApiKeyBanner
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-[#e4e4e7]/10 pb-4">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'text'
                ? 'bg-[#10b981] text-[#111113] shadow-md'
                : 'bg-[#18181b] text-[#e4e4e7]/60 hover:text-[#e4e4e7] border border-[#e4e4e7]/10'
            }`}
          >
            TEXT_STUDIO
          </button>
          <button
            onClick={() => setActiveTab('srt')}
            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'srt'
                ? 'bg-[#10b981] text-[#111113] shadow-md'
                : 'bg-[#18181b] text-[#e4e4e7]/60 hover:text-[#e4e4e7] border border-[#e4e4e7]/10'
            }`}
          >
            SRT_SUBTITLES
          </button>
        </div>

        {activeTab === 'text' && (
          <TranslationStudio
            onTranslate={handleTranslate}
            onWordLookup={handleWordLookup}
            onOpenSrtTab={() => setActiveTab('srt')}
            initialSourceText={selectedSourceText}
            initialTranslatedText={selectedTranslatedText}
            customApiKey={settings.customApiKey}
            onUpdateSettings={handleUpdateSettings}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {activeTab === 'srt' && (
          <SubtitleStudio
            onSaveToHistory={(title, src, trans, cues) =>
              handleSaveToHistory(title, src, trans, cues)
            }
            style="natural"
            targetLang="km"
            customApiKey={settings.customApiKey}
            onUpdateSettings={handleUpdateSettings}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e4e4e7]/10 bg-[#18181b] px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#e4e4e7]/40">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-[#10b981] rounded-full mr-1"></span>
          <span>SYSTEM_ID: ZORO_STUDIO_V1</span>
        </div>
        <div className="flex items-center gap-4">
          <span>STATION: 104.22.88.192</span>
          <span>•</span>
          <span>STORAGE: OFFLINE_READY</span>
        </div>
      </footer>

      {/* Drawers and Modals */}
      <DictionaryDrawer
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
        initialWord={dictionaryLookupWord}
        onAddGlossary={handleAddGlossaryTerm}
        customApiKey={settings.customApiKey}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={handleSelectHistoryItem}
        onDeleteHistoryItem={(id) => setHistory(deleteHistoryItem(id))}
        onTogglePin={(id) => setHistory(togglePinHistoryItem(id))}
        onClearHistory={() => {
          saveHistory([]);
          setHistory([]);
        }}
        e2eeEnabled={settings.e2eeEnabled}
        onHistoryRestored={() => setHistory(loadHistory())}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Floating Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
