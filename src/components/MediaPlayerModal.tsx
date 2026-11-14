import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  FolderOpen,
  ExternalLink,
  Music,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface MediaPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  outputPath: string;
  isAudioOnly?: boolean;
  onOpenFolder?: (path: string) => void;
  onOpenExternal?: (path: string) => void;
}

export const MediaPlayerModal: React.FC<MediaPlayerModalProps> = ({
  isOpen,
  onClose,
  title,
  outputPath,
  isAudioOnly = false,
  onOpenFolder,
  onOpenExternal,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const mediaSrc = outputPath ? convertFileSrc(outputPath) : '';
  const isAudio = isAudioOnly || outputPath.toLowerCase().endsWith('.mp3');

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [outputPath, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, duration, currentTime]);

  if (!isOpen || !outputPath) return null;

  const getMediaElement = () => (isAudio ? audioRef.current : videoRef.current);

  const togglePlay = () => {
    const el = getMediaElement();
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const el = getMediaElement();
    if (el) {
      setCurrentTime(el.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const el = getMediaElement();
    if (el) {
      setDuration(el.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = getMediaElement();
    const time = parseFloat(e.target.value);
    if (el) {
      el.currentTime = time;
      setCurrentTime(time);
    }
  };

  const seekRelative = (delta: number) => {
    const el = getMediaElement();
    if (el) {
      el.currentTime = Math.max(0, Math.min(duration, el.currentTime + delta));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    const el = getMediaElement();
    if (el) el.volume = v;
  };

  const toggleMute = () => {
    const el = getMediaElement();
    if (!el) return;
    if (isMuted) {
      el.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      el.volume = 0;
      setIsMuted(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    const el = getMediaElement();
    if (el) el.playbackRate = nextSpeed;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#0d0d10] border border-[#27272e] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222227] bg-[#121216]">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
              {isAudio ? 'MP3 Audio' : 'MP4 Video'}
            </span>
            <h3 className="text-xs sm:text-sm font-medium text-zinc-200 truncate" title={title}>
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenFolder && (
              <button
                onClick={() => onOpenFolder(outputPath)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                title="Mở thư mục chứa"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            )}
            {onOpenExternal && (
              <button
                onClick={() => onOpenExternal(outputPath)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                title="Mở bằng ứng dụng mặc định"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition ml-1"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Canvas */}
        <div className="relative bg-black flex items-center justify-center min-h-[320px] max-h-[520px] overflow-hidden group">
          {isAudio ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
              <audio
                ref={audioRef}
                src={mediaSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
              />
              <div
                className={`w-28 h-28 rounded-full border-2 border-emerald-500/40 bg-emerald-950/30 flex items-center justify-center shadow-lg shadow-emerald-950/40 ${
                  isPlaying ? 'animate-pulse' : ''
                }`}
              >
                <Music className="w-12 h-12 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-200 max-w-md line-clamp-1">
                  {title}
                </h4>
                <p className="text-xs text-zinc-500 mt-1">Đang phát âm thanh độ nét cao 320kbps</p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={mediaSrc}
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full max-h-[500px] object-contain cursor-pointer"
            />
          )}
        </div>

        {/* Scrubber Timeline */}
        <div className="px-4 pt-3 bg-[#111114]">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition"
          />
        </div>

        {/* Custom Player Controls Bar */}
        <div className="px-4 py-2.5 bg-[#111114] border-t border-[#1e1e24] flex items-center justify-between text-zinc-300">
          {/* Left: Play/Pause, Rewind, Forward, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow-md shadow-emerald-950"
              title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => seekRelative(-5)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Lùi 5 giây (Mũi tên trái)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => seekRelative(5)}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Tua 5 giây (Mũi tên phải)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono tabular-nums text-zinc-400 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Volume, Speed, Fullscreen */}
          <div className="flex items-center gap-3">
            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                title={isMuted ? 'Bật âm' : 'Tắt âm'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Playback Speed */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              title="Tốc độ phát"
            >
              {playbackRate}x
            </button>

            {/* Fullscreen (video only) */}
            {!isAudio && (
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                title="Toàn màn hình"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
