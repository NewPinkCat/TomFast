import React from 'react';
import {
  Zap,
  Settings,
  ListPlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { EngineStatus } from '../types/media';

interface HeaderProps {
  engineStatus: EngineStatus | null;
  isUpdatingEngine: boolean;
  onUpdateEngine: () => void;
  onOpenSettings: () => void;
  onOpenBatch: () => void;
  onOpenDownloadFolder: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  engineStatus,
  isUpdatingEngine,
  onUpdateEngine,
  onOpenSettings,
  onOpenBatch,
  onOpenDownloadFolder,
}) => {
  return (
    <header className="h-16 px-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between sticky top-0 z-40">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-white">TomFast</h1>
            <span className="text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v0.1
            </span>
          </div>
          <p className="text-xs text-zinc-400">High-Speed Multi-Platform Media Downloader</p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {/* Engine Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
          {engineStatus?.is_ready ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">
                yt-dlp {engineStatus.ytdlp_version ? `v${engineStatus.ytdlp_version}` : 'Sẵn sàng'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">Chưa có Engine</span>
            </div>
          )}

          <button
            onClick={onUpdateEngine}
            disabled={isUpdatingEngine}
            title="Cập nhật yt-dlp lên bản mới nhất từ GitHub"
            className="ml-1 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingEngine ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Open Download Folder Button */}
        <button
          onClick={onOpenDownloadFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 hover:text-white text-xs font-medium transition"
          title="Mở thư mục lưu tệp tải về"
        >
          <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>Thư mục lưu</span>
        </button>

        {/* Batch Download Button */}
        <button
          onClick={onOpenBatch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 hover:text-white text-xs font-medium transition"
          title="Tải hàng loạt nhiều link"
        >
          <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tải hàng loạt</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition"
          title="Cài đặt"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
