import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppConfig,
  DownloadProgressPayload,
  DownloadTask,
  EngineStatus,
  FormatOption,
  MediaInfo,
  PlaylistInfo,
  PlaylistItem,
  SavedLink,
} from './types/media';
import { Sidebar } from './components/Sidebar';
import { UrlInputBar } from './components/UrlInputBar';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { TaskList } from './components/TaskList';
import { ClipboardBanner } from './components/ClipboardBanner';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { SettingsModal } from './components/SettingsModal';
import { PlaylistModal } from './components/PlaylistModal';
import { MediaPlayerModal } from './components/MediaPlayerModal';
import { MiniDropZone } from './components/MiniDropZone';
import { AutoShutdownCountdown } from './components/AutoShutdownCountdown';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'downloading' | 'completed' | 'saved_links'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUpdatingEngine, setIsUpdatingEngine] = useState(false);
  const [analyzedMedia, setAnalyzedMedia] = useState<MediaInfo | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [playlistData, setPlaylistData] = useState<PlaylistInfo | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [activeMediaPlaying, setActiveMediaPlaying] = useState<{
    title: string;
    output_path: string;
    is_audio_only?: boolean;
  } | null>(null);

  // Desktop modes
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [showShutdownCountdown, setShowShutdownCountdown] = useState(false);
  const [isRefreshingSavedLinks, setIsRefreshingSavedLinks] = useState(false);
  const hadActiveDownloadsRef = React.useRef(false);

  // Clipboard detected state
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [clipboardPlatform, setClipboardPlatform] = useState<string | null>(null);

  // Error & Info alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // 1. Initial Load: Tasks, Config, Engine, Saved Links
  useEffect(() => {
    loadEngineStatus();
    loadAppConfig();
    loadTasks();
    loadSavedLinks();

    // Listen to real-time progress events from Rust
    const unlistenProgress = listen<DownloadProgressPayload>('download-progress', (event) => {
      const payload = event.payload;
      if (payload.status === 'completed') {
        loadSavedLinks();
      }
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === payload.task_id) {
            return {
              ...t,
              status: payload.status,
              progress_percent: payload.percent,
              downloaded_bytes: payload.downloaded_bytes,
              total_bytes: payload.total_bytes > 0 ? payload.total_bytes : t.total_bytes,
              speed_formatted: payload.speed_formatted,
              eta_formatted: payload.eta_formatted,
              error_message: payload.error || t.error_message,
              output_path: payload.output_path || t.output_path,
            };
          }
          return t;
        })
      );
    });

    // Listen to explicit saved-links-updated event from Rust backend
    const unlistenSavedLinks = listen('saved-links-updated', () => {
      loadSavedLinks();
    });

    // Listen to clipboard detection events from Rust background service
    const unlistenClipboard = listen<{ url: string; platform: string }>('clipboard-url-detected', (event) => {
      setClipboardUrl(event.payload.url);
      setClipboardPlatform(event.payload.platform);
    });

    // Listen to engine update progress
    const unlistenUpdate = listen<string>('engine-update-progress', (event) => {
      setInfoMessage(event.payload);
      setTimeout(() => {
        setInfoMessage(null);
      }, 5000);
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenSavedLinks.then((f) => f());
      unlistenClipboard.then((f) => f());
      unlistenUpdate.then((f) => f());
    };
  }, []);

  const loadEngineStatus = async () => {
    try {
      const status = await invoke<EngineStatus>('get_engine_status_command');
      setEngineStatus(status);
    } catch (e) {
      console.error('Lỗi lấy thông tin engine', e);
    }
  };

  const loadAppConfig = async () => {
    try {
      const cfg = await invoke<AppConfig>('get_app_config_command');
      setConfig(cfg);
    } catch (e) {
      console.error('Lỗi lấy cấu hình', e);
    }
  };

  const loadTasks = async () => {
    try {
      const currentTasks = await invoke<DownloadTask[]>('get_tasks_command');
      setTasks(currentTasks);
    } catch (e) {
      console.error('Lỗi lấy danh sách tải', e);
    }
  };

  const loadSavedLinks = async () => {
    setIsRefreshingSavedLinks(true);
    try {
      const links = await invoke<SavedLink[]>('get_saved_links_command');
      setSavedLinks(links);
    } catch (e) {
      console.error('Lỗi lấy danh sách Kho Link', e);
    } finally {
      setTimeout(() => {
        setIsRefreshingSavedLinks(false);
      }, 350);
    }
  };

  // Auto-Shutdown Watcher
  useEffect(() => {
    const hasDownloading = tasks.some(
      (t) => t.status === 'downloading' || t.status === 'merging' || t.status === 'pending'
    );
    if (hasDownloading) {
      hadActiveDownloadsRef.current = true;
    } else if (hadActiveDownloadsRef.current) {
      hadActiveDownloadsRef.current = false;
      if (config?.auto_shutdown_on_complete) {
        setShowShutdownCountdown(true);
      }
    }
  }, [tasks, config]);

  // Modal open/close helpers with Mini Mode auto-expand
  const openPreview = async (media: MediaInfo) => {
    setAnalyzedMedia(media);
    if (isMiniMode) {
      try {
        await invoke('set_mini_preview_expand_command', { expand: true });
      } catch (e) {
        console.error(e);
      }
    }
    setIsPreviewOpen(true);
  };

  const closePreview = async () => {
    setIsPreviewOpen(false);
    if (isMiniMode) {
      try {
        await invoke('set_mini_preview_expand_command', { expand: false });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const openPlaylist = async (pInfo: PlaylistInfo) => {
    setPlaylistData(pInfo);
    if (isMiniMode) {
      try {
        await invoke('set_mini_preview_expand_command', { expand: true });
      } catch (e) {
        console.error(e);
      }
    }
    setIsPlaylistOpen(true);
  };

  const closePlaylist = async () => {
    setIsPlaylistOpen(false);
    if (isMiniMode) {
      try {
        await invoke('set_mini_preview_expand_command', { expand: false });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 2. Action: Analyze URL (Single video or Playlist)
  const handleAnalyzeUrl = async (url: string) => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    setErrorMessage(null);

    const isPlaylistCandidate =
      url.includes('list=') ||
      url.includes('/playlist') ||
      url.includes('/sets/') ||
      url.includes('/album/');

    if (isPlaylistCandidate) {
      try {
        const pInfo = await invoke<PlaylistInfo>('analyze_playlist_command', { url: url.trim() });
        if (pInfo && pInfo.entries && pInfo.entries.length > 0) {
          await openPlaylist(pInfo);
          setIsAnalyzing(false);
          if (clipboardUrl === url) setClipboardUrl(null);
          return;
        }
      } catch (pErr) {
        console.warn('Không thể bóc tách playlist, thử bóc tách video đơn lẻ', pErr);
      }
    }

    try {
      const media = await invoke<MediaInfo>('analyze_url_command', { url: url.trim() });
      await openPreview(media);
      if (clipboardUrl === url) {
        setClipboardUrl(null);
      }
    } catch (err: any) {
      setErrorMessage(typeof err === 'string' ? err : 'Không thể lấy dữ liệu liên kết này. Vui lòng kiểm tra lại URL.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2b. Action: Start Playlist Batch Download
  const handleStartPlaylistDownload = async (
    items: PlaylistItem[],
    formatId: string,
    qualityLabel: string,
    ext: string,
    isAudioOnly: boolean
  ) => {
    for (const item of items) {
      try {
        const newTask = await invoke<DownloadTask>('start_download_command', {
          url: item.url,
          formatId,
          qualityLabel,
          ext,
          isAudioOnly,
          title: item.title,
          thumbnail: item.thumbnail || null,
          platform: 'youtube',
          directUrl: null,
        });
        setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
      } catch (e) {
        console.error('Lỗi tải video playlist item', item.title, e);
      }
    }
    setActiveTab('downloading');
    await closePlaylist();
  };

  // 2c. Action: Toggle Mini Mode
  const handleToggleMiniMode = async (mini: boolean) => {
    try {
      await invoke('toggle_mini_mode_command', { mini });
      setIsMiniMode(mini);
    } catch (e) {
      console.error('Lỗi chuyển đổi chế độ Mini', e);
    }
  };

  // 3. Action: Start Download
  const handleStartDownload = async (media: MediaInfo, format: FormatOption) => {
    try {
      const newTask = await invoke<DownloadTask>('start_download_command', {
        url: media.url,
        formatId: format.format_id,
        qualityLabel: format.quality_label,
        ext: format.ext,
        isAudioOnly: format.is_audio_only,
        title: media.title,
        thumbnail: media.thumbnail,
        platform: media.platform,
        directUrl: format.direct_url || null,
      });

      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
      // Switch to downloading tab automatically
      setActiveTab('downloading');
      await closePreview();
    } catch (err: any) {
      setErrorMessage(typeof err === 'string' ? err : 'Lỗi khi bắt đầu tải');
    }
  };

  // 4. Action: Batch Download
  const handleStartBatch = async (urls: string[], qualityType: 'best' | '1080p' | 'mp3') => {
    for (const u of urls) {
      const isAudioOnly = qualityType === 'mp3';
      const formatId =
        qualityType === 'mp3'
          ? 'bestaudio/mp3'
          : qualityType === '1080p'
          ? 'res:1080'
          : 'bestvideo+bestaudio/best';

      const qualityLabel =
        qualityType === 'mp3'
          ? 'Âm thanh MP3 320k'
          : qualityType === '1080p'
          ? 'Video 1080p Full HD'
          : 'Video Tốt Nhất';

      const ext = isAudioOnly ? 'mp3' : 'mp4';

      try {
        const newTask = await invoke<DownloadTask>('start_download_command', {
          url: u,
          formatId,
          qualityLabel,
          ext,
          isAudioOnly,
          title: `Batch_${Date.now().toString().slice(-4)}`,
          thumbnail: null,
          platform: 'media',
          directUrl: null,
        });

        setTasks((prev) => [newTask, ...prev]);
      } catch (e) {
        console.error('Lỗi tải batch item', u, e);
      }
    }
    setActiveTab('downloading');
  };

  // 5. Action: Cancel task
  const handleCancelTask = async (id: string) => {
    try {
      await invoke('cancel_task_command', { id });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'canceled', speed_formatted: '0 KB/s' } : t))
      );
    } catch (e) {
      console.error('Lỗi hủy tác vụ', e);
    }
  };

  const handlePauseTask = async (id: string) => {
    try {
      await invoke('pause_task_command', { id });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'paused', speed_formatted: 'Đã tạm dừng' } : t))
      );
    } catch (e) {
      console.error('Lỗi tạm dừng tác vụ', e);
    }
  };

  const handleResumeTask = async (id: string) => {
    try {
      await invoke('resume_task_command', { id });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'downloading', speed_formatted: 'Đang kết nối lại...' } : t))
      );
    } catch (e: any) {
      setErrorMessage(typeof e === 'string' ? e : 'Không thể tiếp tục tải tác vụ này');
    }
  };

  // 6. Action: Open File / Folder
  const handleOpenFile = async (path: string) => {
    try {
      await invoke('open_file_command', { path });
    } catch (e: any) {
      setErrorMessage(typeof e === 'string' ? e : 'Không thể mở tệp này');
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_folder_command', { path });
    } catch (e: any) {
      setErrorMessage(typeof e === 'string' ? e : 'Không thể mở thư mục');
    }
  };

  const handleClearCompleted = async () => {
    try {
      await invoke('clear_completed_command');
      setTasks((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'canceled'));
    } catch (e) {
      console.error('Lỗi dọn dẹp danh sách', e);
    }
  };

  // 7. Action: Saved Links Management
  const handleDeleteSavedLink = async (id: string) => {
    try {
      await invoke('delete_saved_link_command', { id });
      setSavedLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error('Lỗi xóa link đã lưu', e);
    }
  };

  const handleClearAllSavedLinks = async () => {
    try {
      await invoke('clear_saved_links_command');
      setSavedLinks([]);
    } catch (e) {
      console.error('Lỗi xóa tất cả kho link', e);
    }
  };

  const handleRedownload = (url: string) => {
    handleAnalyzeUrl(url);
  };

  // 8. Action: Update Engine yt-dlp
  const handleUpdateEngine = async () => {
    setIsUpdatingEngine(true);
    setErrorMessage(null);
    try {
      await invoke('update_engine_command');
      await loadEngineStatus();
    } catch (e: any) {
      setErrorMessage(typeof e === 'string' ? e : 'Không thể cập nhật yt-dlp');
    } finally {
      setIsUpdatingEngine(false);
    }
  };

  // 9. Action: Save Config
  const handleSaveConfig = async (newConfig: AppConfig) => {
    try {
      await invoke('update_app_config_command', { config: newConfig });
      setConfig(newConfig);
    } catch (e) {
      console.error('Lỗi lưu cấu hình', e);
    }
  };

  const downloadingTasks = tasks.filter(
    (t) =>
      t.status === 'downloading' ||
      t.status === 'merging' ||
      t.status === 'pending' ||
      t.status === 'paused'
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Compute live active speed if downloading
  const activeDownloading = tasks.find((t) => t.status === 'downloading' && t.speed_formatted);
  const totalSpeedFormatted = activeDownloading ? activeDownloading.speed_formatted : undefined;

  // Mini Drop Zone Mode
  if (isMiniMode) {
    return (
      <div className="w-screen h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
        <MiniDropZone
          onExpand={() => handleToggleMiniMode(false)}
          onAnalyze={handleAnalyzeUrl}
          isAnalyzing={isAnalyzing}
          activeTasks={tasks}
        />
        <MediaPreviewModal
          mediaInfo={analyzedMedia}
          isOpen={isPreviewOpen}
          onClose={closePreview}
          onDownload={handleStartDownload}
        />
        <PlaylistModal
          isOpen={isPlaylistOpen}
          onClose={closePlaylist}
          playlist={playlistData}
          onStartBatchDownload={handleStartPlaylistDownload}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans">
      {/* Professional Desktop Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'saved_links') {
            loadSavedLinks();
          }
        }}
        downloadingCount={downloadingTasks.length}
        completedCount={completedTasks.length}
        savedLinksCount={savedLinks.length}
        engineStatus={engineStatus}
        isUpdatingEngine={isUpdatingEngine}
        onUpdateEngine={handleUpdateEngine}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        onOpenDownloadFolder={() =>
          handleOpenFolder(
            config?.download_dir || 'D:\\Artificial Intelligence\\Data\\TomFast\\downloads'
          )
        }
        totalSpeedFormatted={totalSpeedFormatted}
        onToggleMiniMode={() => handleToggleMiniMode(true)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Command Bar URL Input */}
        <UrlInputBar onAnalyze={handleAnalyzeUrl} isAnalyzing={isAnalyzing} />

        {/* Global Alert Banners */}
        {infoMessage && (
          <div className="bg-emerald-950/40 border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
            <button
              onClick={() => setInfoMessage(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-950/40 border-b border-rose-500/30 px-6 py-2 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Task List / Media Library */}
        <TaskList
          tasks={tasks}
          savedLinks={savedLinks}
          activeTab={activeTab}
          onCancel={handleCancelTask}
          onPause={handlePauseTask}
          onResume={handleResumeTask}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onClearCompleted={handleClearCompleted}
          onDeleteSavedLink={handleDeleteSavedLink}
          onClearAllSavedLinks={handleClearAllSavedLinks}
          onRedownload={handleRedownload}
          onRefreshSavedLinks={loadSavedLinks}
          isRefreshingSavedLinks={isRefreshingSavedLinks}
          onPlayMedia={(t) =>
            setActiveMediaPlaying({
              title: t.title,
              output_path: t.output_path,
              is_audio_only: t.is_audio_only,
            })
          }
        />
      </main>

      {/* Modals & Dialogs */}
      <MediaPreviewModal
        mediaInfo={analyzedMedia}
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onDownload={handleStartDownload}
      />

      <BatchDownloadModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        onStartBatch={handleStartBatch}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        engineStatus={engineStatus}
        isUpdatingEngine={isUpdatingEngine}
        onSaveConfig={handleSaveConfig}
        onUpdateEngine={handleUpdateEngine}
      />

      <PlaylistModal
        isOpen={isPlaylistOpen}
        onClose={closePlaylist}
        playlist={playlistData}
        onStartBatchDownload={handleStartPlaylistDownload}
      />

      <MediaPlayerModal
        isOpen={!!activeMediaPlaying}
        onClose={() => setActiveMediaPlaying(null)}
        title={activeMediaPlaying?.title || ''}
        outputPath={activeMediaPlaying?.output_path || ''}
        isAudioOnly={activeMediaPlaying?.is_audio_only}
        onOpenFolder={handleOpenFolder}
        onOpenExternal={handleOpenFile}
      />

      <AutoShutdownCountdown
        isOpen={showShutdownCountdown}
        onCancel={() => setShowShutdownCountdown(false)}
        action={config?.auto_shutdown_action as 'shutdown' | 'sleep'}
      />

      {/* Desktop Toast Notification */}
      <ClipboardBanner
        url={clipboardUrl}
        platform={clipboardPlatform}
        onAnalyze={handleAnalyzeUrl}
        onDismiss={() => setClipboardUrl(null)}
      />
    </div>
  );
};

export default App;
