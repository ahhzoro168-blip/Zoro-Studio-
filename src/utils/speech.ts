/**
 * Voice-to-Text (Speech Recognition) and Text-to-Speech Utilities
 */

// Define SpeechRecognition interface for browsers
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as IWindow;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export interface VoiceRecognitionController {
  start: () => void;
  stop: () => void;
  isListening: boolean;
}

export function createSpeechRecognizer(
  lang: string,
  onResult: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
): VoiceRecognitionController | null {
  if (!isSpeechRecognitionSupported()) return null;

  const win = window as IWindow;
  const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
  const recognition = new SpeechRec();

  // Map app lang code to standard BCP-47 locale
  const langMap: Record<string, string> = {
    zh: 'zh-CN',
    'zh-TW': 'zh-TW',
    km: 'km-KH',
    en: 'en-US',
    vi: 'vi-VN',
    th: 'th-TH',
    fr: 'fr-FR',
    ja: 'ja-JP',
    ko: 'ko-KR',
  };

  recognition.lang = langMap[lang] || 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let isListening = false;

  recognition.onresult = (event: any) => {
    let interim = '';
    let finalStr = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalStr += transcript;
      } else {
        interim += transcript;
      }
    }

    if (finalStr) {
      onResult(finalStr, true);
    } else if (interim) {
      onResult(interim, false);
    }
  };

  recognition.onerror = (event: any) => {
    onError(event.error || 'Speech recognition encountered an issue');
  };

  recognition.onend = () => {
    isListening = false;
    onEnd();
  };

  return {
    start: () => {
      try {
        isListening = true;
        recognition.start();
      } catch (e: any) {
        console.warn('Recognition start exception:', e);
      }
    },
    stop: () => {
      try {
        isListening = false;
        recognition.stop();
      } catch (e: any) {
        console.warn('Recognition stop exception:', e);
      }
    },
    get isListening() {
      return isListening;
    },
  };
}

/**
 * Text-to-Speech via Web Speech API or Gemini Server API
 */
export async function speakText(
  text: string,
  lang: string,
  rate = 1.0,
  useGeminiTTS = false
): Promise<void> {
  if (!text.trim()) return;

  // If user requested Gemini Studio TTS or browser lacks native voice
  if (useGeminiTTS) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audio.playbackRate = rate;
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('Gemini TTS failed, falling back to browser synthesis:', e);
    }
  }

  // Browser speech synthesis fallback
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop any currently playing audio
    const utterance = new SpeechSynthesisUtterance(text);

    const langMap: Record<string, string> = {
      zh: 'zh-CN',
      'zh-TW': 'zh-TW',
      km: 'km-KH',
      en: 'en-US',
      vi: 'vi-VN',
      th: 'th-TH',
      fr: 'fr-FR',
      ja: 'ja-JP',
      ko: 'ko-KR',
    };

    utterance.lang = langMap[lang] || 'zh-CN';
    utterance.rate = rate;

    // Pick a matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) => v.lang.startsWith(utterance.lang) || v.lang.startsWith(lang));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
