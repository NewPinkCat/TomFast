import React, { useState } from 'react';
import { Zap, Maximize2, Clipboard, ArrowDownCircle, Loader2 } from 'lucide-react';
import { DownloadTask } from '../types/media';

interface MiniDropZoneProps {
  onExpand: () => void;
  onAnalyze: (url: string) => void;
  isAnalyzing: boolean;
  activeTasks: DownloadTask[];
}

export const MiniDropZone: React.FC<MiniDropZoneProps> = ({
  onExpand,
  onAnalyze,
  isAnalyzing,
  activeTasks,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData('text');
    if (text && text.trim().startsWith('http')) {
      onAnalyze(text.trim());
    }
  };

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('http')) {
        onAnalyze(text.trim());
      }
    } catch (e) {
      console.error('Không thể đọc clipboard', e);
    }
  };

  const currentTask = activeTasks.find((t) => t.status === 'downloading');

  return (
    <div
      data-tauri-drag-region
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full bg-[#0b0b0e] border-2 transition-all p-3 flex flex-col justify-between select-none ${
        isDragOver
          ? 'border-emerald-500 bg-emerald-950/20'
          : 'border-[#242429] hover:border-zinc-700'
      }`}
    >
      {/* Mini Titlebar */}
      <div data-tauri-drag-region className="flex items-center justify-between">
        <div data-tauri-drag-region className="flex items-center gap-1.5 cursor-grab">
          <div className="w-5 h-5 rounded bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Zap className="w-3 h-3 fill-emerald-400" />
          </div>
          <span className="text-xs font-bold text-zinc-200">TomFast Mini</span>
          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
            Drop Zone
          </span>
        </div>

        <button
          onClick={onExpand}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          title="Mở giao diện đầy đủ"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Drop / Paste Body */}
      {currentTask ? (
        <div className="bg-[#141418] border border-[#222227] rounded-lg p-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-300 font-medium truncate max-w-[200px]" title={currentTask.title}>
              {currentTask.title}
            </span>
            <span className="text-emerald-400 font-mono font-semibold">
              {currentTask.progress_percent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${Math.max(2, currentTask.progress_percent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500">
            <span>{currentTask.speed_formatted}</span>
            <span>Còn {currentTask.eta_formatted}</span>
          </div>
        </div>
      ) : (
        <div
          onClick={handlePasteClick}
          className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-emerald-500/60 rounded-lg p-2 transition cursor-pointer my-1 group bg-[#111114]"
        >
          {isAnalyzing ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang phân tích link...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 transition">
              <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium">Kéo thả hoặc click để dán link</span>
              <Clipboard className="w-3.5 h-3.5 text-zinc-500" />
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div data-tauri-drag-region className="text-[9px] text-zinc-500 flex items-center justify-between cursor-grab">
        <span>Ghim nổi trên màn hình</span>
        <span className="text-emerald-500 font-mono">
          {activeTasks.length > 0 ? `${activeTasks.length} tác vụ đang tải` : 'Sẵn sàng'}
        </span>
      </div>
    </div>
  );
};
