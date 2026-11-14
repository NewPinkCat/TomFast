import React, { useState, useEffect } from 'react';
import {
  X,
  FolderOpen,
  Bell,
  Clipboard,
  Cpu,
  RefreshCw,
  Save,
  HardDrive,
  Globe,
  Power,
  Minimize2,
} from 'lucide-react';
import { AppConfig, EngineStatus } from '../types/media';
import { open } from '@tauri-apps/plugin-dialog';
import { CustomDropdown, DropdownOption } from './CustomDropdown';

const maxTasksOptions: DropdownOption<number>[] = [
  { value: 1, label: '1 tác vụ tải cùng lúc' },
  { value: 2, label: '2 tác vụ tải cùng lúc' },
  { value: 3, label: '3 tác vụ tải cùng lúc (Khuyên dùng)' },
  { value: 5, label: '5 tác vụ tải cùng lúc' },
];

const browserCookieOptions: DropdownOption<string>[] = [
  { value: 'none', label: 'Không đồng bộ (Mặc định)', desc: 'Tải công khai, không dùng cookie' },
  { value: 'chrome', label: 'Google Chrome', desc: 'Đồng bộ tài khoản từ Chrome' },
  { value: 'edge', label: 'Microsoft Edge', desc: 'Đồng bộ tài khoản từ Edge' },
  { value: 'brave', label: 'Brave Browser', desc: 'Đồng bộ tài khoản từ Brave' },
  { value: 'firefox', label: 'Mozilla Firefox', desc: 'Đồng bộ tài khoản từ Firefox' },
  { value: 'opera', label: 'Opera', desc: 'Đồng bộ tài khoản từ Opera' },
];

const shutdownActionOptions: DropdownOption<string>[] = [
  { value: 'shutdown', label: 'Tắt máy tính (Shutdown)' },
  { value: 'sleep', label: 'Chuyển sang chế độ ngủ (Sleep)' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  engineStatus: EngineStatus | null;
  isUpdatingEngine: boolean;
  onSaveConfig: (newConfig: AppConfig) => void;
  onUpdateEngine: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  engineStatus,
  isUpdatingEngine,
  onSaveConfig,
  onUpdateEngine,
}) => {
  const [downloadDir, setDownloadDir] = useState('');
  const [autoClipboard, setAutoClipboard] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [browserCookies, setBrowserCookies] = useState('none');
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [autoShutdown, setAutoShutdown] = useState(false);
  const [autoShutdownAction, setAutoShutdownAction] = useState<string>('shutdown');

  useEffect(() => {
    if (config) {
      setDownloadDir(config.download_dir);
      setAutoClipboard(config.auto_clipboard_detect);
      setNotifications(config.notifications_enabled);
      setMaxConcurrent(config.max_concurrent_downloads);
      setBrowserCookies(config.browser_cookies || 'none');
      setMinimizeToTray(config.minimize_to_tray ?? true);
      setAutoShutdown(config.auto_shutdown_on_complete ?? false);
      setAutoShutdownAction(config.auto_shutdown_action || 'shutdown');
    }
  }, [config, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, downloadDir, autoClipboard, notifications, maxConcurrent, browserCookies, minimizeToTray, autoShutdown, autoShutdownAction]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: downloadDir,
      });
      if (selected && typeof selected === 'string') {
        setDownloadDir(selected);
      }
    } catch (e) {
      console.error('Lỗi mở hộp thoại chọn thư mục', e);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      download_dir: downloadDir,
      auto_clipboard_detect: autoClipboard,
      notifications_enabled: notifications,
      max_concurrent_downloads: maxConcurrent,
      default_to_mp3: config?.default_to_mp3 || false,
      concurrent_fragments: config?.concurrent_fragments || 8,
      browser_cookies: browserCookies === 'none' ? undefined : browserCookies,
      minimize_to_tray: minimizeToTray,
      auto_shutdown_on_complete: autoShutdown,
      auto_shutdown_action: autoShutdownAction as 'shutdown' | 'sleep',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#0f0f12] border border-[#27272e] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#242429] bg-[#0c0c0e]">
          <h2 className="text-sm font-semibold text-zinc-100">Cài đặt hệ thống TomFast</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Download Directory Setting */}
          <div className="p-3.5 rounded-lg bg-[#141418] border border-[#222227] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Thư mục lưu trữ tệp tải về</span>
              </label>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Chọn thư mục</span>
              </button>
            </div>
            <div className="p-2 rounded bg-black/40 border border-zinc-800/80 font-mono text-xs text-zinc-300 break-all select-text">
              {downloadDir}
            </div>
          </div>

          {/* Browser Cookie Sync */}
          <div className="p-3.5 rounded-lg bg-[#141418] border border-[#222227] flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Đồng bộ Cookie Trình duyệt (Bypass 18+)</span>
              </h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Sử dụng phiên đăng nhập để tải video giới hạn độ tuổi, video riêng tư & hội viên
              </p>
            </div>
            <CustomDropdown<string>
              options={browserCookieOptions}
              value={browserCookies}
              onChange={setBrowserCookies}
              width="w-64"
            />
          </div>

          {/* Queue Settings */}
          <div className="p-3.5 rounded-lg bg-[#141418] border border-[#222227] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-zinc-200">Tác vụ tải song song</span>
              <p className="text-[11px] text-zinc-500 mt-0.5">Giới hạn số file tải cùng lúc trong hàng đợi</p>
            </div>
            <CustomDropdown<number>
              options={maxTasksOptions}
              value={maxConcurrent}
              onChange={setMaxConcurrent}
              width="w-56"
            />
          </div>

          {/* Automation & Desktop Toggles */}
          <div className="p-3.5 rounded-lg bg-[#141418] border border-[#222227] space-y-3">
            {/* Auto Clipboard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clipboard className="w-4 h-4 text-zinc-400" />
                <div>
                  <span className="text-xs font-medium text-zinc-200">Tự động nhận diện Clipboard</span>
                  <p className="text-[11px] text-zinc-500">Hiển thị gợi ý tải ngay khi sao chép liên kết media</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoClipboard(!autoClipboard)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoClipboard ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    autoClipboard ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notifications */}
            <div className="pt-2 border-t border-[#222227] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-zinc-400" />
                <div>
                  <span className="text-xs font-medium text-zinc-200">Thông báo hệ thống</span>
                  <p className="text-[11px] text-zinc-500">Gửi thông báo trên Windows khi hoàn tất tải file</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  notifications ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    notifications ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Minimize to Tray */}
            <div className="pt-2 border-t border-[#222227] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Minimize2 className="w-4 h-4 text-zinc-400" />
                <div>
                  <span className="text-xs font-medium text-zinc-200">Khay hệ thống (System Tray)</span>
                  <p className="text-[11px] text-zinc-500">Thu nhỏ xuống khay hệ thống khi bấm nút đóng (X)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMinimizeToTray(!minimizeToTray)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  minimizeToTray ? 'bg-emerald-600' : 'bg-zinc-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    minimizeToTray ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Auto Shutdown on Complete */}
            <div className="pt-2 border-t border-[#222227] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Power className="w-4 h-4 text-zinc-400" />
                  <div>
                    <span className="text-xs font-medium text-zinc-200">Tự động tắt máy khi tải xong</span>
                    <p className="text-[11px] text-zinc-500">Đếm ngược 60s và tự động tắt máy hoặc chuyển chế độ ngủ</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoShutdown(!autoShutdown)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoShutdown ? 'bg-emerald-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      autoShutdown ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {autoShutdown && (
                <div className="pl-6 pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">Hành động khi hoàn thành:</span>
                  <CustomDropdown<string>
                    options={shutdownActionOptions}
                    value={autoShutdownAction}
                    onChange={setAutoShutdownAction}
                    width="w-56"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sidecar Engine Info */}
          <div className="p-3.5 rounded-lg bg-[#141418] border border-[#222227] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-xs font-medium text-zinc-200">Sidecar Engine (yt-dlp & FFmpeg)</span>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  {engineStatus?.ytdlp_version ? `Phiên bản: yt-dlp ${engineStatus.ytdlp_version}` : 'Chưa tải xong'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onUpdateEngine}
              disabled={isUpdatingEngine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 hover:text-white border border-zinc-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingEngine ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isUpdatingEngine ? 'Đang cập nhật...' : 'Cập nhật GitHub'}</span>
            </button>
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
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu cài đặt</span>
            <kbd className="font-mono text-[10px] text-emerald-300 bg-emerald-700/60 px-1 py-0.2 rounded ml-0.5">
              ↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
