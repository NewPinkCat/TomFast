import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface AutoShutdownCountdownProps {
  isOpen: boolean;
  onCancel: () => void;
  action?: 'shutdown' | 'sleep';
}

export const AutoShutdownCountdown: React.FC<AutoShutdownCountdownProps> = ({
  isOpen,
  onCancel,
  action = 'shutdown',
}) => {
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(60);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Execute action
          invoke('execute_system_action_command', { action }).catch(console.error);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, action]);

  if (!isOpen) return null;

  const isShutdown = action === 'shutdown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121216] border border-amber-500/40 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center space-y-4">
        {/* Pulsing Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/60 flex items-center justify-center text-amber-400 animate-pulse">
          <Power className="w-8 h-8" />
        </div>

        <div>
          <div className="flex items-center justify-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tất cả tác vụ tải đã hoàn tất</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-100">
            Hệ thống sẽ {isShutdown ? 'tắt máy tính' : 'chuyển sang chế độ ngủ'} sau
          </h3>
        </div>

        {/* Big Countdown Number */}
        <div className="text-5xl font-mono font-bold text-amber-400 tabular-nums py-2">
          {secondsLeft}s
        </div>

        <p className="text-xs text-zinc-400 max-w-xs">
          Bạn có 60 giây để hủy lệnh này nếu vẫn đang tiếp tục làm việc trên máy tính.
        </p>

        {/* Cancel Button */}
        <div className="w-full pt-2">
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm border border-zinc-700 hover:border-zinc-500 transition shadow-lg cursor-pointer"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>HỦY TẮT MÁY NGAY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
