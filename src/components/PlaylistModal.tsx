import React, { useState, useMemo } from 'react';
import {
  X,
  ListVideo,
  CheckSquare,
  Square,
  Download,
  Search,
  Check,
  Video,
  Music,
} from 'lucide-react';
import { PlaylistInfo, PlaylistItem } from '../types/media';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: PlaylistInfo | null;
  onStartBatchDownload: (
    items: PlaylistItem[],
    formatId: string,
    qualityLabel: string,
    ext: string,
    isAudioOnly: boolean
  ) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onStartBatchDownload,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<'1080p' | '720p' | 'mp3' | 'best'>('1080p');

  // Initialize all items selected whenever a new playlist is loaded
  React.useEffect(() => {
    if (playlist?.entries) {
      setSelectedIds(new Set(playlist.entries.map((e) => e.id)));
    }
  }, [playlist]);

  const filteredEntries = useMemo(() => {
    if (!playlist?.entries) return [];
    if (!searchQuery.trim()) return playlist.entries;
    const q = searchQuery.toLowerCase();
    return playlist.entries.filter((e) => e.title.toLowerCase().includes(q));
  }, [playlist, searchQuery]);

  if (!isOpen || !playlist) return null;

  const allSelected =
    filteredEntries.length > 0 && filteredEntries.every((e) => selectedIds.has(e.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      filteredEntries.forEach((e) => next.delete(e.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredEntries.forEach((e) => next.add(e.id));
      setSelectedIds(next);
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDownload = () => {
    const itemsToDownload = playlist.entries.filter((e) => selectedIds.has(e.id));
    if (itemsToDownload.length === 0) return;

    let formatId = 'res:1080';
    let qualityLabel = 'Video 1080p Full HD';
    let ext = 'mp4';
    let isAudioOnly = false;

    if (selectedTier === '720p') {
      formatId = 'res:720';
      qualityLabel = 'Video 720p HD';
      ext = 'mp4';
    } else if (selectedTier === 'mp3') {
      formatId = 'bestaudio/mp3';
      qualityLabel = 'Âm thanh MP3 (320kbps)';
      ext = 'mp3';
      isAudioOnly = true;
    } else if (selectedTier === 'best') {
      formatId = 'bestvideo+bestaudio/best';
      qualityLabel = 'Chất lượng gốc cao nhất';
      ext = 'mp4';
    }

    onStartBatchDownload(itemsToDownload, formatId, qualityLabel, ext, isAudioOnly);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0f0f12] border border-[#27272e] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242429]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ListVideo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Danh Sách Phát / Album</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  {playlist.item_count} video
                </span>
              </h3>
              <p className="text-xs text-zinc-400 line-clamp-1 max-w-md" title={playlist.title}>
                {playlist.title} {playlist.uploader && `• ${playlist.uploader}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Batch Options Toolbar */}
        <div className="px-5 py-3 border-b border-[#242429] bg-[#141418] flex flex-wrap items-center justify-between gap-3">
          {/* Quality Tier Selector */}
          <div className="flex items-center gap-1.5 bg-[#0b0b0e] p-1 rounded-lg border border-[#222227]">
            <button
              onClick={() => setSelectedTier('1080p')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                selectedTier === '1080p'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              1080p MP4
            </button>
            <button
              onClick={() => setSelectedTier('720p')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                selectedTier === '720p'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              720p MP4
            </button>
            <button
              onClick={() => setSelectedTier('mp3')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                selectedTier === 'mp3'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              MP3 320k
            </button>
          </div>

          {/* Search filter within playlist */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm video trong danh sách..."
              className="w-full bg-[#0b0b0e] border border-[#222227] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition"
            />
          </div>
        </div>

        {/* Select All Toolbar */}
        <div className="px-5 py-2 bg-[#111114] border-b border-[#242429] flex items-center justify-between text-xs text-zinc-400">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 font-medium hover:text-zinc-200 transition"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-zinc-500" />
            )}
            <span>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span>
          </button>
          <span className="font-mono tabular-nums text-zinc-400">
            Đã chọn{' '}
            <strong className="text-emerald-400">{selectedIds.size}</strong> /{' '}
            {playlist.entries.length} video
          </span>
        </div>

        {/* Video List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e24] p-2 space-y-1">
          {filteredEntries.map((item, idx) => {
            const isChecked = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition select-none ${
                  isChecked
                    ? 'bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/20'
                    : 'bg-[#121216]/60 hover:bg-[#16161c] border border-transparent'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
                    isChecked
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'border-zinc-700 bg-zinc-900'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                <span className="text-[11px] font-mono text-zinc-500 w-6 text-right shrink-0">
                  #{idx + 1}
                </span>

                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-10 object-cover rounded bg-black shrink-0 border border-zinc-800"
                  />
                ) : (
                  <div className="w-16 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-xs font-medium line-clamp-1 transition ${
                      isChecked ? 'text-zinc-200' : 'text-zinc-400'
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </h4>
                  {item.duration_formatted && (
                    <span className="text-[10px] font-mono text-zinc-500">
                      Thời lượng: {item.duration_formatted}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242429] bg-[#0c0c0e] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            Hủy
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Tải {selectedIds.size} video đã chọn</span>
          </button>
        </div>
      </div>
    </div>
  );
};
