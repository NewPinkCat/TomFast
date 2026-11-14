import React, { useState } from 'react';
import {
  Link2,
  ClipboardPaste,
  ArrowRight,
  Loader2,
  Youtube,
} from 'lucide-react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';

interface UrlInputBarProps {
  onAnalyze: (url: string) => void;
  isAnalyzing: boolean;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({ onAnalyze, isAnalyzing }) => {
  const [url, setUrl] = useState('');

  const detectPlatform = (val: string) => {
    const low = val.toLowerCase();
    if (low.includes('youtube.com') || low.includes('youtu.be')) return 'YouTube';
    if (low.includes('tiktok.com')) return 'TikTok';
    if (low.includes('facebook.com') || low.includes('fb.watch')) return 'Facebook';
    if (low.includes('twitter.com') || low.includes('x.com')) return 'X';
    if (low.includes('instagram.com')) return 'Instagram';
    if (low.includes('pinterest.com') || low.includes('pin.it')) return 'Pinterest';
    return null;
  };

  const detectedPlatform = detectPlatform(url);

  const handlePaste = async () => {
    try {
      const text = await readText();
      if (text && text.trim().startsWith('http')) {
        setUrl(text.trim());
      }
    } catch (e) {
      console.error('Lỗi đọc clipboard', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isAnalyzing) {
      onAnalyze(url.trim());
    }
  };

  return (
    <div className="w-full px-6 py-4 border-b border-[#242429] bg-[#0c0c0e]">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="relative flex-1 flex items-center bg-[#131317] border border-[#27272e] focus-within:border-emerald-500/80 rounded-xl px-3.5 py-2.5 transition shadow-sm">
          {/* Platform Icon or Link Icon */}
          <div className="mr-3 text-zinc-400 shrink-0">
            {detectedPlatform === 'YouTube' ? (
              <Youtube className="w-4 h-4 text-red-500" />
            ) : detectedPlatform ? (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {detectedPlatform}
              </span>
            ) : (
              <Link2 className="w-4 h-4 text-zinc-500" />
            )}
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Dán liên kết YouTube, TikTok, Facebook, X, Pinterest, Instagram..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            disabled={isAnalyzing}
          />

          <div className="flex items-center gap-2 pl-2 shrink-0">
            <button
              type="button"
              onClick={handlePaste}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-[#1a1a20] hover:bg-[#22222a] border border-[#2e2e38] rounded-lg transition"
              title="Dán từ Clipboard (Ctrl+V)"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-zinc-400" />
              <span>Dán</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] text-zinc-500 bg-zinc-800/80 px-1 py-0.2 rounded border border-zinc-700/50">
                Ctrl+V
              </kbd>
            </button>

            <button
              type="submit"
              disabled={!url.trim() || isAnalyzing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Lấy link</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-200" />
                  <kbd className="hidden sm:inline-block font-mono text-[10px] text-emerald-300 bg-emerald-700/60 px-1 py-0.2 rounded">
                    ↵
                  </kbd>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
