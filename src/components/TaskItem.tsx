import React, { useState } from 'react';
import {
  FolderOpen,
  Play,
  Pause,
  X,
  AlertCircle,
  FileVideo,
  FileAudio,
  Trash2,
  Loader2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { DownloadTask } from '../types/media';

interface TaskItemProps {
  task: DownloadTask;
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRedownload?: (url: string) => void;
  onPlayMedia?: (task: DownloadTask) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onCancel,
  onPause,
  onResume,
  onOpenFile,
  onOpenFolder,
  onRedownload,
  onPlayMedia,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const isDownloading = task.status === 'downloading';
  const isMerging = task.status === 'merging';
  const isPaused = task.status === 'paused';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  // Starting state: before progressive stream emits downloaded bytes
  const isStarting =
    isDownloading &&
    ((task.progress_percent === 0 && task.downloaded_bytes === 0) ||
      task.speed_formatted === 'Đang lấy link...' ||
      task.speed_formatted === 'Đang bắt đầu...');

  const handlePause = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    onPause(task.id);
    setTimeout(() => setIsProcessing(false), 300);
  };

  const handleResume = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    onResume(task.id);
    setTimeout(() => setIsProcessing(false), 300);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    if (bytes >= 1_073_741_824) {
      return (bytes / 1_073_741_824).toFixed(2) + ' GB';
    }
    return (bytes / 1_048_576).toFixed(1) + ' MB';
  };

  const getPlatformChip = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('youtube')) return 'text-red-400 bg-red-950/40 border-red-500/20';
    if (p.includes('tiktok')) return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/20';
    if (p.includes('facebook')) return 'text-blue-400 bg-blue-950/40 border-blue-500/20';
    if (p.includes('pinterest')) return 'text-rose-400 bg-rose-950/40 border-rose-500/20';
    return 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40';
  };

  return (
    <div className="group relative p-3.5 rounded-xl bg-[#111114] hover:bg-[#141418] border border-[#222227] hover:border-[#2e2e38] transition flex flex-col gap-2.5">
      <div className="flex items-center gap-3.5">
        {/* Thumbnail Preview */}
        <div
          onClick={() => isCompleted && onPlayMedia && onPlayMedia(task)}
          className={`relative w-20 h-12 rounded-lg bg-zinc-950 overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center ${
            isCompleted && onPlayMedia ? 'cursor-pointer group/thumb hover:border-emerald-500/50' : ''
          }`}
          title={isCompleted ? 'Click để xem ngay' : undefined}
        >
          {task.thumbnail ? (
            <img src={task.thumbnail} alt={task.title} className="w-full h-full object-cover" />
          ) : task.is_audio_only ? (
            <FileAudio className="w-5 h-5 text-amber-400" />
          ) : (
            <FileVideo className="w-5 h-5 text-emerald-400" />
          )}

          {isCompleted && (
            <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-black/20 flex items-center justify-center transition">
              <Play className="w-5 h-5 fill-emerald-400 text-emerald-400 opacity-90 group-hover/thumb:scale-110 transition-transform" />
            </div>
          )}
        </div>

        {/* Title & Metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${getPlatformChip(task.platform)}`}>
              {task.platform}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-1 rounded border border-zinc-700/30">
              {task.quality_label}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              .{task.ext}
            </span>
          </div>

          <h4 className="text-xs sm:text-sm font-medium text-zinc-200 line-clamp-1 group-hover:text-white transition" title={task.title}>
            {task.title}
          </h4>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDownloading && (
            <button
              onClick={handlePause}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition"
              title="Tạm dừng"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tạm dừng</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium border border-emerald-500/40 transition"
              title="Tiếp tục tải"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Tiếp tục</span>
            </button>
          )}

          {(isDownloading || isPaused || isMerging) && (
            <button
              onClick={() => onCancel(task.id)}
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/40 hover:border-rose-500/30 transition"
              title="Hủy tải xuống"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {isCompleted && (
            <>
              {onPlayMedia && (
                <button
                  onClick={() => onPlayMedia(task)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium border border-emerald-500/40 transition"
                  title="Xem ngay trong app"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-400 group-hover:text-white" />
                  <span className="hidden sm:inline">Xem</span>
                </button>
              )}
              <button
                onClick={() => onOpenFile(task.output_path)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition"
                title="Mở bằng ứng dụng mặc định"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onOpenFolder(task.output_path)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition"
                title="Mở thư mục chứa tệp"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {isFailed && (
            <>
              {onRedownload && (
                <button
                  onClick={() => onRedownload(task.url)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700 transition"
                  title="Tải lại"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tải lại</span>
                </button>
              )}
              <button
                onClick={() => onCancel(task.id)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/40 hover:border-rose-500/30 transition"
                title="Xóa lỗi"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar & Real-time Metrics (for active or pending downloads) */}
      {(isDownloading || isPaused || isMerging) && (
        <div className="space-y-1.5 pt-1">
          {/* Nano Progress Bar */}
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                isPaused
                  ? 'bg-amber-400'
                  : isStarting
                  ? 'w-full bg-emerald-500/60 animate-pulse'
                  : isMerging
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-emerald-500'
              }`}
              style={{ width: isStarting ? '100%' : `${Math.max(1, Math.min(100, task.progress_percent))}%` }}
            />
          </div>

          {/* Micro Typography Metrics */}
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-400">
            {isStarting ? (
              <span className="text-emerald-400 font-sans flex items-center gap-1.5 font-medium">
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
                Đang kết nối CDN & nạp dữ liệu phân đoạn...
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-200">
                  {task.progress_percent.toFixed(1)}%
                </span>
                <span>•</span>
                <span>
                  {formatBytes(task.downloaded_bytes)} / {formatBytes(task.total_bytes)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isStarting ? (
                <span className="text-emerald-400 font-medium">Đang lấy link...</span>
              ) : isMerging ? (
                <span className="text-emerald-400 font-sans flex items-center gap-1 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang ghép MP4...
                </span>
              ) : isPaused ? (
                <span className="text-amber-400 font-sans">Đã tạm dừng</span>
              ) : (
                <>
                  <span className="text-emerald-400 font-medium">
                    {task.speed_formatted}
                  </span>
                  <span>•</span>
                  <span>Còn {task.eta_formatted}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error explanation if failed */}
      {isFailed && task.error_message && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/20 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{task.error_message}</span>
        </div>
      )}
    </div>
  );
};
