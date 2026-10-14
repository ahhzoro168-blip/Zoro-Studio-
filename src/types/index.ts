export type LanguageCode = 'zh' | 'zh-TW' | 'km' | 'en' | 'vi' | 'th' | 'fr' | 'ja' | 'ko' | 'auto';

export type TranslationStyle = 'natural' | 'formal' | 'colloquial' | 'literary' | 'business';

export type SubtitleTone = 'short' | 'natural' | 'creative' | 'formal' | 'literal';

export type TranslationContext = 'general' | 'subtitle' | 'technical' | 'business' | 'tourism' | 'literary';

export interface AlignedSegment {
  source: string;
  target: string;
  note?: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLang?: string;
  phonetics?: string;
  culturalNotes?: string;
  segments?: AlignedSegment[];
}

export interface SubtitleCue {
  id: number;
  startTime: string; // "00:01:23,456"
  endTime: string;   // "00:01:25,789"
  sourceText: string;
  translatedText: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  timestamp: number;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  fileType: 'text' | 'srt' | 'docx' | 'voice';
  fileName?: string;
  subtitles?: SubtitleCue[];
  segments?: AlignedSegment[];
  isPinned?: boolean;
  isEncrypted?: boolean;
  charCount: number;
}

export interface DictionaryData {
  word: string;
  pinyin?: string;
  khmerPhonetic?: string;
  partOfSpeech?: string;
  definitions: string[];
  englishDefinition?: string;
  examples?: Array<{
    source: string;
    pinyin?: string;
    target: string;
    english?: string;
  }>;
  synonyms?: string[];
  etymologyOrNote?: string;
}

export interface AppSettings {
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  khmerFont: 'kantumruy' | 'battambang' | 'system';
  theme: 'dark' | 'light';
  autoTranslateSpeech: boolean;
  e2eeEnabled: boolean;
  vaultSalt?: string;
  customGlossary: Record<string, string>;
  customApiKey?: string;
}
