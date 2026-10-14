import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import {
  FileText,
  Film,
  Clock,
  Settings,
  CloudUpload,
} from 'lucide-react';
import { AppSettings } from '../types';

interface HeaderProps {
  activeTab: 'text' | 'srt';
  onTabChange: (tab: 'text' | 'srt') => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenBackup: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  historyCount,
  onOpenHistory,
  onOpenSettings,
  onOpenBackup,
  settings,
}) => {
  return (
    <header className="px-8 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)] z-10">
      {/* Logo */}
      <div className="font-['Syne'] font-extrabold text-xl tracking-tight flex items-center gap-3">
        <div className="w-2 h-2 bg-[var(--accent)] rounded-full"></div>
        ZORO-STUDIO
      </div>

      {/* System Meta */}
      <div className="hidden lg:flex items-center gap-8 text-[0.655rem] font-mono tracking-widest uppercase opacity-40">
        <span>AES-256 E2EE : {settings.e2eeEnabled ? 'ACTIVE' : 'DISABLED'}</span>
        <span>GEMINI_V3.8 : CONNECTED</span>
        {settings.customApiKey && (
          <span style={{ color: 'var(--accent)', opacity: 1 }}>CUSTOM_KEY : ACTIVE</span>
        )}
      </div>

      {/* Nav Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenBackup}
          className="bg-[var(--panel)] border border-[var(--border)] text-[var(--ink)] px-3 py-2 rounded text-xs font-mono tracking-wider hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-1.5"
          title="Cloud Backup & Sync"
        >
          <CloudUpload className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>BACKUP</span>
        </button>

        <button
          onClick={onOpenHistory}
          className="relative bg-[var(--panel)] border border-[var(--border)] text-[var(--ink)] px-3 py-2 rounded text-xs font-mono tracking-wider hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-1.5"
          title="Translation History"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>HISTORY</span>
          {historyCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[var(--rose)] text-white text-[9px] font-bold rounded-full h-3.5 min-w-[14px] px-1 flex items-center justify-center">
              {historyCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="bg-[var(--panel)] border border-[var(--border)] text-[var(--ink)] px-3 py-2 rounded text-xs font-mono tracking-wider hover:border-[var(--accent)] transition cursor-pointer flex items-center gap-1.5"
          title="Settings & API Key"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>SETTINGS</span>
        </button>

        <PWAInstallButton />
      </div>
    </header>
  );
};
