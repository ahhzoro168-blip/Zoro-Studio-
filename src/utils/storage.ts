import { HistoryItem, AppSettings } from '../types';
import { encryptText, decryptText, EncryptedPayload } from './crypto';

const HISTORY_KEY = 'linguakhmer_history';
const SETTINGS_KEY = 'linguakhmer_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'md',
  khmerFont: 'kantumruy',
  theme: 'dark',
  autoTranslateSpeech: false,
  e2eeEnabled: false,
  customGlossary: {
    人工智能: 'បញ្ញាសិប្បនិម្មិត',
    互联网: 'អ៊ីនធឺណិត',
    你好: 'សួស្តី',
    谢谢: 'អរគុណ',
    柬埔寨: 'ប្រទេសកម្ពុជា',
  },
};

/**
 * Load settings from localStorage
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Load history items from localStorage
 */
export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save history items to localStorage
 */
export function saveHistory(history: HistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

/**
 * Add or update an item in history (limited to 100 most recent items)
 */
export function addHistoryItem(item: HistoryItem): HistoryItem[] {
  const current = loadHistory();
  // Filter out any existing item with same id
  const filtered = current.filter((h) => h.id !== item.id);
  const updated = [item, ...filtered].slice(0, 100);
  saveHistory(updated);
  return updated;
}

/**
 * Delete a history item
 */
export function deleteHistoryItem(id: string): HistoryItem[] {
  const current = loadHistory();
  const updated = current.filter((h) => h.id !== id);
  saveHistory(updated);
  return updated;
}

/**
 * Toggle pinned status of an item
 */
export function togglePinHistoryItem(id: string): HistoryItem[] {
  const current = loadHistory();
  const updated = current.map((h) => (h.id === id ? { ...h, isPinned: !h.isPinned } : h));
  // Sort pinned first
  updated.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.timestamp - a.timestamp;
  });
  saveHistory(updated);
  return updated;
}

/**
 * Cloud Backup Export: creates a downloadable JSON backup
 */
export async function createCloudBackup(passphrase?: string): Promise<string> {
  const history = loadHistory();
  const settings = loadSettings();

  const payload = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    history,
    settings,
  };

  const jsonString = JSON.stringify(payload, null, 2);

  if (passphrase && passphrase.trim()) {
    const encrypted = await encryptText(jsonString, passphrase);
    return JSON.stringify({
      isEncrypted: true,
      app: 'LinguaKhmer',
      encryptedData: encrypted,
    }, null, 2);
  }

  return JSON.stringify({
    isEncrypted: false,
    app: 'LinguaKhmer',
    data: payload,
  }, null, 2);
}

/**
 * Restore from Cloud Backup JSON
 */
export async function restoreCloudBackup(
  backupJson: string,
  passphrase?: string
): Promise<{ success: boolean; itemsRestored: number; message: string }> {
  try {
    const parsed = JSON.parse(backupJson);

    let rawData: any;
    if (parsed.isEncrypted) {
      if (!passphrase) {
        throw new Error('This backup is end-to-end encrypted. Please provide the vault password.');
      }
      const decryptedString = await decryptText(parsed.encryptedData as EncryptedPayload, passphrase);
      rawData = JSON.parse(decryptedString);
    } else if (parsed.data) {
      rawData = parsed.data;
    } else {
      rawData = parsed;
    }

    if (Array.isArray(rawData.history)) {
      const current = loadHistory();
      const existingIds = new Set(current.map((h) => h.id));
      const newItems = rawData.history.filter((h: HistoryItem) => !existingIds.has(h.id));
      const merged = [...newItems, ...current].slice(0, 150);
      saveHistory(merged);

      if (rawData.settings) {
        saveSettings({ ...DEFAULT_SETTINGS, ...rawData.settings });
      }

      return {
        success: true,
        itemsRestored: newItems.length,
        message: `Successfully restored ${newItems.length} translation records!`,
      };
    }

    throw new Error('Invalid backup file format');
  } catch (error: any) {
    return {
      success: false,
      itemsRestored: 0,
      message: error.message || 'Failed to restore backup',
    };
  }
}
