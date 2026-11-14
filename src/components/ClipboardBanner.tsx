import React from 'react';
import { Clipboard, ArrowRight, X } from 'lucide-react';

interface ClipboardBannerProps {
  url: string | null;
  platform: string | null;
  onAnalyze: (url: string) => void;
  onDismiss: () => void;
}

export const ClipboardBanner: React.FC<ClipboardBannerProps> = ({
  url,
  platform,
  onAnalyze,
  onDismiss,
}) => {
  if (!url) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center justify-between gap-3 p-3 bg-[#111114] border border-emerald-500/40 rounded-xl shadow-2xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Clipboard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-100">Liên kết trong bộ nhớ tạm</span>
              {platform && (
                <span className="text-[10px] font-mono uppercase font-bold px-1 rounded bg-emerald-500/20 text-emerald-400">
                  {platform}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5" title={url}>
              {url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAnalyze(url)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-md transition shadow-sm"
          >
            <span>Lấy link</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition"
            title="Bỏ qua"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
