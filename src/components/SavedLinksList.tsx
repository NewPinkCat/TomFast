import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Play,
  FolderOpen,
  Trash2,
  Search,
  Bookmark,
  FileVideo,
  RefreshCw,
} from 'lucide-react';
import { SavedLink } from '../types/media';

interface SavedLinksListProps {
  links: SavedLink[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRedownload: (url: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onPlayMedia?: (title: string, path: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const SavedLinksList: React.FC<SavedLinksListProps> = ({
  links,
  onDelete,
  onClearAll,
  onRedownload,
  onOpenFile,
  onOpenFolder,
  onPlayMedia,
  onRefresh,
  isRefreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Không thể sao chép URL', e);
    }
  };

  const getPlatformChip = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('youtube')) return 'text-red-400 bg-red-950/40 border-red-500/20';
    if (p.includes('tiktok')) return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/20';
    if (p.includes('facebook')) return 'text-blue-400 bg-blue-950/40 border-blue-500/20';
    if (p.includes('pinterest')) return 'text-rose-400 bg-rose-950/40 border-rose-500/20';
    return 'text-zinc-400 bg-zinc-800/60 border-zinc-700/40';
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '--';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLinks = links.filter((link) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      link.title.toLowerCase().includes(q) ||
      link.url.toLowerCase().includes(q) ||
      link.platform.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* Library Toolbar */}
      <div className="px-6 py-3 border-b border-[#242429] flex items-center justify-between gap-4 bg-[#0c0c0e]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">Kho liên kết đã tải thành công</h2>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded border border-zinc-700/40">
            {filteredLinks.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề hoặc URL..."
              className="bg-[#141418] border border-[#27272e] rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-44 sm:w-56 transition"
            />
          </div>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-[#141418] hover:bg-[#1c1c22] border border-[#27272e] hover:border-zinc-700 rounded-lg transition disabled:opacity-50"
              title="Làm mới danh sách kho liên kết"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          )}

          {links.length > 0 && (
            <button
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 rounded-lg transition"
              title="Xóa toàn bộ kho liên kết"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xóa tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* Library Items */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
        {filteredLinks.length > 0 ? (
          filteredLinks.map((link) => (
            <div
              key={link.id}
              className="group p-3.5 rounded-xl bg-[#111114] hover:bg-[#141418] border border-[#222227] hover:border-[#2e2e38] transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Thumbnail */}
                <div className="relative w-20 h-12 rounded-lg bg-zinc-950 overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
                  {link.thumbnail ? (
                    <img src={link.thumbnail} alt={link.title} className="w-full h-full object-cover" />
                  ) : (
                    <FileVideo className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded border ${getPlatformChip(link.platform)}`}>
                      {link.platform}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-1 rounded border border-zinc-700/30">
                      {link.quality_label}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {formatDate(link.saved_at)}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-medium text-zinc-200 line-clamp-1 group-hover:text-white transition" title={link.title}>
                    {link.title}
                  </h4>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleCopy(link.id, link.url)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition"
                  title="Sao chép URL"
                >
                  {copiedId === link.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {copiedId === link.id ? 'Đã chép' : 'URL'}
                  </span>
                </button>

                {onPlayMedia && (
                  <button
                    onClick={() => onPlayMedia(link.title, link.file_path)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium border border-emerald-500/40 transition"
                    title="Xem trực tiếp trong app"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400 group-hover:text-white" />
                    <span className="hidden sm:inline">Xem</span>
                  </button>
                )}

                <button
                  onClick={() => onOpenFile(link.file_path)}
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition"
                  title="Mở bằng ứng dụng mặc định"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onOpenFolder(link.file_path)}
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition"
                  title="Mở thư mục"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onRedownload(link.url)}
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 border border-zinc-700/60 transition"
                  title="Tải lại video này"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onDelete(link.id)}
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/40 hover:border-rose-500/30 transition"
                  title="Xóa khỏi kho liên kết"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-[#242429]">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <Bookmark className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">
              Kho liên kết đang trống
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              Mỗi khi bạn tải hoàn tất một video, liên kết và đường dẫn tệp sẽ tự động được lưu trữ tại đây để bạn có thể xem lại hoặc mở nhanh bất cứ lúc nào.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
