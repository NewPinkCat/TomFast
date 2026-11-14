import React, { useState, useEffect } from 'react';
import { X, Download, Music, Video, User } from 'lucide-react';
import { FormatOption, MediaInfo } from '../types/media';

interface MediaPreviewModalProps {
  mediaInfo: MediaInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (media: MediaInfo, selectedFormat: FormatOption) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  mediaInfo,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');

  const formats = mediaInfo?.formats || [];
  const currentFormat = formats.find((f) => f.format_id === selectedFormatId) || formats[0];

  // Auto-select first video or best format when modal opens
  useEffect(() => {
    if (mediaInfo && formats.length > 0) {
      // Prefer best quality video or first option
      const bestVideo = formats.find((f) => f.format_id.includes('2160') || f.format_id.includes('1080') || !f.is_audio_only);
      setSelectedFormatId(bestVideo?.format_id || formats[0].format_id);
    }
  }, [mediaInfo]);

  // Handle Enter and Escape keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (currentFormat && mediaInfo) {
          onDownload(mediaInfo, currentFormat);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentFormat, mediaInfo, onDownload, onClose]);

  if (!isOpen || !mediaInfo) return null;

  const handleStart = () => {
    if (currentFormat) {
      onDownload(mediaInfo, currentFormat);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0f0f12] border border-[#27272e] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#242429] bg-[#0c0c0e]">
          <h2 className="text-sm font-semibold text-zinc-100">Tùy chọn tải media</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3">
          {/* Media Info Card */}
          <div className="flex gap-3 p-2.5 rounded-lg bg-[#141418] border border-[#222227]">
            {mediaInfo.thumbnail && (
              <div className="relative w-32 h-18 rounded-md overflow-hidden bg-black shrink-0 border border-zinc-800">
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover"
                />
                {mediaInfo.duration_formatted && (
                  <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 font-mono text-[9px] text-zinc-200">
                    {mediaInfo.duration_formatted}
                  </span>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <h3 className="text-xs sm:text-sm font-medium text-zinc-100 line-clamp-2" title={mediaInfo.title}>
                {mediaInfo.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1.5">
                {mediaInfo.uploader && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-zinc-500" />
                    <span className="truncate max-w-[120px]">{mediaInfo.uploader}</span>
                  </div>
                )}
                <span className="text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                  {mediaInfo.platform}
                </span>
              </div>
            </div>
          </div>

          {/* Formats Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Chọn chất lượng mong muốn
              </label>
              <span className="text-[11px] text-zinc-500">
                {formats.length} tùy chọn khả dụng
              </span>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {formats.map((fmt) => {
                const isSelected = currentFormat?.format_id === fmt.format_id;
                return (
                  <div
                    key={fmt.format_id}
                    onClick={() => setSelectedFormatId(fmt.format_id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer border transition ${
                      isSelected
                        ? 'bg-emerald-600/10 border-emerald-500/70 text-white shadow-sm'
                        : 'bg-[#121215] border-[#222227] hover:bg-[#16161b] hover:border-[#2e2e38] text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          fmt.is_audio_only
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {fmt.is_audio_only ? (
                          <Music className="w-3.5 h-3.5" />
                        ) : (
                          <Video className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-medium flex items-center gap-2">
                          <span>{fmt.quality_label}</span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="uppercase text-zinc-300 font-semibold">
                            .{fmt.ext}
                          </span>
                          {fmt.filesize_approx && (
                            <span>• Dung lượng: {fmt.filesize_approx}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-zinc-700 bg-transparent'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#242429] bg-[#0c0c0e] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            Hủy <kbd className="font-mono text-[10px] text-zinc-500 ml-1">Esc</kbd>
          </button>

          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Bắt đầu tải về</span>
            <kbd className="font-mono text-[10px] text-emerald-300 bg-emerald-700/60 px-1 py-0.2 rounded ml-0.5">
              ↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
