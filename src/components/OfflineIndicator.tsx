import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Database } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white shadow-xl border border-amber-400/30 animate-pulse">
      <WifiOff className="w-4 h-4 text-amber-200" />
      <span>Offline Mode — Cached translations &amp; local history available</span>
      <Database className="w-3.5 h-3.5 ml-1 text-amber-200" />
    </div>
  );
};
