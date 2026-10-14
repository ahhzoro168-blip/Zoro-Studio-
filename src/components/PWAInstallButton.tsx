import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running standalone, do not display
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
        <Check className="w-3.5 h-3.5" />
        <span>Installed</span>
      </div>
    );
  }

  // Desktop Chrome / Android Flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono tracking-wider rounded bg-[var(--panel)] border border-[var(--border)] text-[var(--ink)] hover:border-[var(--accent)] transition cursor-pointer"
        title="Install ZORO-STUDIO app to desktop or mobile home screen"
      >
        <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span>INSTALL_APP</span>
      </button>
    );
  }

  // iOS Safari Flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-400" />
          <span>Add to Home</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Install on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed space-y-2">
                <span className="block">1. Tap the <strong className="text-white">Share</strong> button in the Safari toolbar.</span>
                <span className="block">2. Scroll down and choose <strong className="text-rose-400">Add to Home Screen</strong>.</span>
                <span className="block">3. Enjoy full offline access and fast native performance!</span>
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
