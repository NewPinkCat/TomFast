import React from 'react';
import {
  Zap,
  ArrowDownCircle,
  CheckCircle2,
  Bookmark,
  Settings,
  FolderOpen,
  ListPlus,
  RefreshCw,
  Cpu,
  Layers,
  ArrowUpRight,
  Minimize2,
} from 'lucide-react';
import { EngineStatus } from '../types/media';

interface SidebarProps {
  activeTab: 'all' | 'downloading' | 'completed' | 'saved_links';
  onSelectTab: (tab: 'all' | 'downloading' | 'completed' | 'saved_links') => void;
  downloadingCount: number;
  completedCount: number;
  savedLinksCount: number;
  engineStatus: EngineStatus | null;
  isUpdatingEngine: boolean;
  onUpdateEngine: () => void;
  onOpenSettings: () => void;
  onOpenBatch: () => void;
  onOpenDownloadFolder: () => void;
  totalSpeedFormatted?: string;
  onToggleMiniMode?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  downloadingCount,
  completedCount,
  savedLinksCount,
  engineStatus,
  isUpdatingEngine,
  onUpdateEngine,
  onOpenSettings,
  onOpenBatch,
  onOpenDownloadFolder,
  totalSpeedFormatted,
  onToggleMiniMode,
}) => {
  return (
    <aside className="w-64 bg-[#0c0c0e] border-r border-[#242429] flex flex-col justify-between select-none shrink-0 h-full">
      {/* Top Brand Section */}
      <div>
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#242429]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-zinc-100 tracking-tight">TomFast</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-1 rounded border border-zinc-700/50">
                  v0.1
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenDownloadFolder}
            title="Mở thư mục tệp tải về"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-3">
          <button
            onClick={onOpenBatch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#151519] hover:bg-[#1a1a20] border border-[#27272e] text-xs font-medium text-zinc-200 transition group"
          >
            <div className="flex items-center gap-2">
              <ListPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tải hàng loạt link</span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="px-2 space-y-0.5">
          <button
            onClick={() => onSelectTab('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'all'
                ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-zinc-400" />
              <span>Tất cả tác vụ</span>
            </div>
            {(downloadingCount + completedCount) > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                {downloadingCount + completedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('downloading')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'downloading'
                ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ArrowDownCircle className={`w-4 h-4 ${downloadingCount > 0 ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'}`} />
              <span>Đang tải xuống</span>
            </div>
            {downloadingCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {downloadingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('completed')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'completed'
                ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              <span>Đã hoàn thành</span>
            </div>
            {completedCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                {completedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('saved_links')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'saved_links'
                ? 'bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-4 h-4 text-zinc-400" />
              <span>Kho liên kết đã lưu</span>
            </div>
            {savedLinksCount > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                {savedLinksCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Bottom Engine & Settings Section */}
      <div className="p-3 border-t border-[#242429] space-y-2.5 bg-[#0a0a0c]">
        {/* Real-time speed indicator (if downloading) */}
        {totalSpeedFormatted && downloadingCount > 0 && (
          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs">
            <div className="flex items-center justify-between text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Tốc độ tải tổng:
              </span>
              <span className="font-mono tabular-nums font-semibold">{totalSpeedFormatted}</span>
            </div>
          </div>
        )}

        {/* Engine status card */}
        <div className="p-2.5 rounded-lg bg-[#121215] border border-[#242429] text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              <span>Sidecar Engine</span>
            </span>
            <button
              onClick={onUpdateEngine}
              disabled={isUpdatingEngine}
              title="Kiểm tra & Cập nhật yt-dlp"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isUpdatingEngine ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between text-zinc-300 font-mono">
            <span className="truncate max-w-[120px]">
              {engineStatus?.ytdlp_version ? `yt-dlp ${engineStatus.ytdlp_version}` : 'Chưa kích hoạt'}
            </span>
            <span className="text-emerald-400 font-sans font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              yt-dlp Stream
            </span>
          </div>
        </div>

        {/* Mini Mode Drop Zone button */}
        {onToggleMiniMode && (
          <button
            onClick={onToggleMiniMode}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-emerald-500/20 hover:border-emerald-500/40 transition mb-1"
            title="Thu nhỏ thành thanh widget nổi ghim trên màn hình"
          >
            <Minimize2 className="w-4 h-4" />
            <span>Hộp thả nổi Mini</span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent hover:border-[#27272e] transition"
        >
          <Settings className="w-4 h-4" />
          <span>Cài đặt hệ thống</span>
        </button>
      </div>
    </aside>
  );
};
