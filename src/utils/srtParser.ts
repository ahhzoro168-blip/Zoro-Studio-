import { SubtitleCue } from '../types';

/**
 * Parses raw SRT content into SubtitleCue objects
 */
export function parseSrt(rawContent: string): SubtitleCue[] {
  // Normalize line endings
  const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\n+/);
  const cues: SubtitleCue[] = [];

  let fallbackId = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let id = fallbackId++;
    let timeLineIndex = 0;

    // Check if line 0 is numeric index
    if (/^\d+$/.test(lines[0])) {
      id = parseInt(lines[0], 10);
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startTime, endTime] = timeLine.split('-->').map((s) => s.trim());
    const textLines = lines.slice(timeLineIndex + 1);
    const sourceText = textLines.join('\n');

    cues.push({
      id,
      startTime: startTime || '00:00:00,000',
      endTime: endTime || '00:00:00,000',
      sourceText,
      translatedText: '',
    });
  }

  return cues;
}

/**
 * Serializes cues back to standard .srt format
 */
export function serializeSrt(
  cues: SubtitleCue[],
  mode: 'translated' | 'bilingual' | 'original' = 'translated'
): string {
  return cues
    .map((cue, index) => {
      let content = '';
      if (mode === 'translated') {
        content = cue.translatedText || cue.sourceText;
      } else if (mode === 'bilingual') {
        // Khmer on top, original Chinese underneath
        content = `${cue.translatedText || ''}\n${cue.sourceText}`;
      } else {
        content = cue.sourceText;
      }

      return `${index + 1}\r\n${cue.startTime} --> ${cue.endTime}\r\n${content.trim()}\r\n`;
    })
    .join('\r\n');
}

/**
 * Trigger browser download for an SRT file
 */
export function downloadFile(content: string | Blob, filename: string, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
