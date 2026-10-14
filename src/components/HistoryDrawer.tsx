import React, { useState } from 'react';
import {
  X,
  Clock,
  Search,
  Pin,
  Trash2,
  Download,
  ExternalLink,
  Film,
  FileSpreadsheet,
  FileText,
  Mic,
  ShieldCheck,
  CloudDownload,
  CloudUpload,
  Check,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { HistoryItem } from '../types';
import { downloadFile, serializeSrt } from '../utils/srtParser';
import { exportToDocx } from '../utils/docxExport';
import { createCloudBackup, restoreCloudBackup } from '../utils/storage';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistoryItem: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClearHistory: () => void;
  e2eeEnabled: boolean;
  onHistoryRestored: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onTogglePin,
  onClearHistory,
  e2eeEnabled,
  onHistoryRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'backup'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const matchesType = filterType === 'all' || item.fileType === filterType;
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sourceText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.translatedText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupStatus('');
    try {
      const backupJson = await createCloudBackup(backupPassphrase || undefined);
      const filename = `LinguaKhmer_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(backupJson, filename, 'application/json');
      setBackupStatus('Cloud backup file generated and downloaded successfully!');
    } catch (e: any) {
      setBackupStatus(`Backup export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = await restoreCloudBackup(content, backupPassphrase || undefined);
        setBackupStatus(result.message);
        if (result.success) {
          onHistoryRestored();
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDirectDownload = async (item: HistoryItem) => {
    if (item.fileType === 'srt' && item.subtitles) {
      const srtContent = serializeSrt(item.subtitles, 'bilingual');
      downloadFile(srtContent, `${item.title || 'subtitles'}_bilingual.srt`, 'application/x-subrip');
    } else if (item.fileType === 'docx') {
      const paragraphs = item.sourceText.split('\n\n').map((text, idx) => ({
        id: idx + 1,
        sourceText: text,
        translatedText: item.translatedText.split('\n\n')[idx] || '',
      }));
      await exportToDocx(paragraphs, `${item.title || 'document'}.docx`, 'bilingual');
    } else {
      downloadFile(
        `Original (${item.sourceLang}):\n${item.sourceText}\n\nKhmer Translation:\n${item.translatedText}`,
        `${item.title || 'translation'}.txt`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity font-mono">
      <div className="w-full max-w-lg bg-[#18181b] border-l border-[#e4e4e7]/10 h-full flex flex-col shadow-2xl text-[#e4e4e7]">
        {/* Header */}
        <div className="p-4 border-b border-[#e4e4e7]/10 flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-[#e4e4e7]">HISTORY_AND_CLOUD_SYNC</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#e4e4e7]/60 hover:text-[#e4e4e7] hover:bg-[#18181b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-[#e4e4e7]/10 bg-[#111113] px-4 pt-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'list'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#e4e4e7]/50 hover:text-[#e4e4e7]'
            }`}
          >
            SAVED_TRANSLATIONS ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'backup'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#e4e4e7]/50 hover:text-[#e4e4e7]'
            }`}
          >
            CLOUD_BACKUP_AND_SYNC
          </button>
        </div>

        {activeTab === 'list' ? (
          <>
            {/* Search & Filters */}
            <div className="p-3 border-b border-[#e4e4e7]/10 bg-[#111113] space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search previous translations..."
                  className="w-full bg-[#18181b] border border-[#e4e4e7]/10 rounded px-3 py-2 pl-8 text-xs text-[#e4e4e7] placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
                <Search className="w-3.5 h-3.5 text-[#e4e4e7]/40 absolute left-2.5 top-2.5" />
              </div>

              {/* Filter by file type */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                {['all', 'text', 'srt'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded uppercase font-bold text-[10px] tracking-wider transition cursor-pointer shrink-0 ${
                      filterType === t
                        ? 'bg-[#10b981] text-[#111113] shadow-xs'
                        : 'bg-[#18181b] border border-[#e4e4e7]/10 text-[#e4e4e7]/60 hover:text-[#e4e4e7]'
                    }`}
                  >
                    {t}
                  </button>
                ))}

                {history.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="ml-auto text-[10px] font-mono uppercase tracking-wider text-[#e4e4e7]/40 hover:text-rose-400 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* List of items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectHistoryItem(item);
                      onClose();
                    }}
                    className={`bg-[#18181b] border rounded-lg overflow-hidden transition-all cursor-pointer group shadow-md ${
                      item.isPinned
                        ? 'border-emerald-500 ring-1 ring-emerald-500/50'
                        : 'border-[#e4e4e7]/10 hover:border-emerald-500/40 hover:bg-[#18181b]/80'
                    }`}
                  >
                    {/* Header bar matching INPUT_BUFFER style */}
                    <div className="px-3.5 py-1.5 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/60 font-mono">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.fileType === 'srt' ? (
                          <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-bold text-[#e4e4e7] truncate max-w-[190px]">
                          {item.title}
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 shrink-0">
                          {item.fileType.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#e4e4e7]/40 font-mono">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(item.id);
                          }}
                          className={`p-1 rounded hover:text-emerald-400 cursor-pointer ${
                            item.isPinned ? 'text-emerald-400' : 'text-[#e4e4e7]/40'
                          }`}
                          title="Pin translation"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectDownload(item);
                          }}
                          className="p-1 rounded text-[#e4e4e7]/40 hover:text-[#e4e4e7] cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteHistoryItem(item.id);
                          }}
                          className="p-1 rounded text-[#e4e4e7]/40 hover:text-rose-400 cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Previews Body */}
                    <div className="p-3.5 space-y-1.5 font-mono">
                      <div className="text-xs text-[#e4e4e7]/80 line-clamp-2 leading-relaxed">
                        {item.sourceText}
                      </div>
                      <div className="text-xs font-['Kantumruy_Pro'] text-emerald-300 line-clamp-2 leading-relaxed">
                        {item.translatedText}
                      </div>
                    </div>

                    {/* Footer bar matching INPUT_BUFFER metrics */}
                    <div className="px-3.5 py-1.5 bg-[#111113] border-t border-[#e4e4e7]/10 flex items-center justify-between text-[10px] text-[#e4e4e7]/40 font-mono">
                      <span>METRICS: {item.charCount} CHARS • {item.sourceLang.toUpperCase()} → {item.targetLang.toUpperCase()}</span>
                      <span className="text-emerald-400 opacity-80 group-hover:opacity-100 transition flex items-center gap-1 font-bold">
                        <span>RE-OPEN</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-[#e4e4e7]/40 text-xs font-mono">
                  NO_SAVED_TRANSLATION_RECORDS_FOUND
                </div>
              )}
            </div>
          </>
        ) : (
          /* Cloud Backup & Sync View */
          <div className="p-4 space-y-5 overflow-y-auto flex-1 font-mono">
            {/* Cross-Platform Cloud Backup */}
            <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
              <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
                <span>EXPORT_BACKUP / CLOUD_SYNC</span>
                <span>AES_256</span>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-2">
                  <CloudUpload className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#e4e4e7]">
                    Cross-Platform Cloud Backup
                  </h4>
                </div>
                <p className="text-xs text-[#e4e4e7]/60 leading-relaxed">
                  Export your entire history, custom glossaries, and subtitle records into an encrypted JSON backup. You can import this file on your mobile phone, tablet, or another computer.
                </p>

                {/* Vault Passphrase for E2EE backup */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Vault Encryption Password (Optional):</span>
                  </label>
                  <input
                    type="password"
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="Enter passphrase to encrypt cloud backup..."
                    className="w-full bg-[#111113] border border-[#e4e4e7]/10 rounded p-2.5 text-xs text-[#e4e4e7] placeholder:text-[#e4e4e7]/30 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-[#e4e4e7]/40 block">
                    If set, your backup is protected using AES-256-GCM encryption before download.
                  </span>
                </div>

                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded bg-[#10b981] hover:bg-[#059669] text-[#111113] font-bold text-xs uppercase tracking-wider shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Encrypted Backup File</span>
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="bg-[#18181b] border border-[#e4e4e7]/10 rounded-lg overflow-hidden shadow-2xl">
              <div className="px-4 py-2 bg-[#111113] border-b border-[#e4e4e7]/10 flex items-center justify-between text-xs text-[#e4e4e7]/50 font-mono">
                <span>RESTORE_BACKUP / IMPORT_SNAPSHOT</span>
                <span>JSON_IMPORT</span>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-2">
                  <CloudDownload className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#e4e4e7]">
                    Restore / Import Cloud Backup
                  </h4>
                </div>
                <p className="text-xs text-[#e4e4e7]/60 leading-relaxed">
                  Restore history and settings from a previously saved ZORO-STUDIO JSON file. Existing items will be merged safely without loss.
                </p>

                <label className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded bg-[#18181b] hover:bg-[#111113] border border-[#e4e4e7]/10 hover:border-emerald-500/40 text-[#e4e4e7] text-xs font-bold uppercase tracking-wider transition cursor-pointer">
                  <CloudDownload className="w-4 h-4 text-emerald-400" />
                  <span>Select .JSON Backup File</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {backupStatus && (
              <div className="p-3 bg-[#111113] border border-emerald-800/40 text-xs text-emerald-300 rounded font-mono flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{backupStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
