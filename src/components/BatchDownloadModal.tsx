import React, { useState } from 'react';
import { X, Download, Check } from 'lucide-react';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBatch: (urls: string[], qualityType: 'best' | '1080p' | 'mp3') => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  onStartBatch,
}) => {
  const [text, setText] = useState('');
  const [qualityType, setQualityType] = useState<'best' | '1080p' | 'mp3'>('best');

  if (!isOpen) return null;

  const urls = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('http://') || line.startsWith('https://'));

  const handleStart = () => {
    if (urls.length > 0) {
      onStartBatch(urls, qualityType);
      setText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0f0f12] border border-[#27272e] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242429] bg-[#0c0c0e]">
          <h2 className="text-sm font-semibold text-zinc-100">Tải hàng loạt liên kết (Batch Download)</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Dán danh sách liên kết (mỗi dòng một link):
              </label>
              <span className="text-[11px] font-mono text-zinc-500">
                Đã nhận diện: <span className="font-semibold text-emerald-400">{urls.length}</span> URL
              </span>
            </div>

            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=...&#10;https://www.tiktok.com/@user/video/...&#10;https://www.facebook.com/watch/..."
              className="w-full bg-[#141418] border border-[#27272e] focus:border-emerald-500 rounded-lg p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Định dạng tải áp dụng cho toàn bộ:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setQualityType('best')}
                className={`p-3 rounded-lg border text-xs text-left transition ${
                  qualityType === 'best'
                    ? 'bg-emerald-600/15 border-emerald-500/80 text-white'
                    : 'bg-[#121215] border-[#222227] text-zinc-300 hover:bg-[#16161b]'
                }`}
              >
                <div className="font-semibold text-zinc-100 flex items-center justify-between mb-0.5">
                  <span>Tốt nhất (Auto)</span>
                  {qualityType === 'best' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[11px] text-zinc-500">Chất lượng cao nhất</div>
              </button>

              <button
                type="button"
                onClick={() => setQualityType('1080p')}
                className={`p-3 rounded-lg border text-xs text-left transition ${
                  qualityType === '1080p'
                    ? 'bg-emerald-600/15 border-emerald-500/80 text-white'
                    : 'bg-[#121215] border-[#222227] text-zinc-300 hover:bg-[#16161b]'
                }`}
              >
                <div className="font-semibold text-zinc-100 flex items-center justify-between mb-0.5">
                  <span>1080p Full HD</span>
                  {qualityType === '1080p' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[11px] text-zinc-500">Chuẩn nét MP4</div>
              </button>

              <button
                type="button"
                onClick={() => setQualityType('mp3')}
                className={`p-3 rounded-lg border text-xs text-left transition ${
                  qualityType === 'mp3'
                    ? 'bg-emerald-600/15 border-emerald-500/80 text-white'
                    : 'bg-[#121215] border-[#222227] text-zinc-300 hover:bg-[#16161b]'
                }`}
              >
                <div className="font-semibold text-zinc-100 flex items-center justify-between mb-0.5">
                  <span>Âm thanh MP3</span>
                  {qualityType === 'mp3' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[11px] text-zinc-500">320kbps High Quality</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242429] bg-[#0c0c0e] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            Hủy <kbd className="font-mono text-[10px] text-zinc-500 ml-1">Esc</kbd>
          </button>

          <button
            onClick={handleStart}
            disabled={urls.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Thêm {urls.length} tác vụ vào hàng đợi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
