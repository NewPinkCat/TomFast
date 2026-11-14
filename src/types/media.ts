export type TaskStatus =
  | 'pending'
  | 'downloading'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'canceled';

export interface FormatOption {
  format_id: string;
  quality_label: string;
  ext: string;
  filesize_bytes?: number;
  filesize_approx?: string;
  is_audio_only: boolean;
  resolution?: string;
  direct_url?: string;
}

export interface MediaInfo {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration_seconds?: number;
  duration_formatted?: string;
  uploader?: string;
  platform: string;
  formats: FormatOption[];
}

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  platform: string;
  selected_format_id: string;
  quality_label: string;
  ext: string;
  is_audio_only: boolean;
  output_path: string;
  status: TaskStatus;
  progress_percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bytes_per_sec: number;
  speed_formatted: string;
  eta_formatted: string;
  error_message?: string;
  created_at: number;
}

export interface DownloadProgressPayload {
  task_id: string;
  status: TaskStatus;
  percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_formatted: string;
  eta_formatted: string;
  error?: string;
  output_path?: string;
}

export interface AppConfig {
  download_dir: string;
  max_concurrent_downloads: number;
  auto_clipboard_detect: boolean;
  default_to_mp3: boolean;
  notifications_enabled: boolean;
  concurrent_fragments?: number;
  browser_cookies?: string;
  minimize_to_tray?: boolean;
  auto_shutdown_on_complete?: boolean;
  auto_shutdown_action?: 'shutdown' | 'sleep';
}

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  duration_formatted?: string;
  thumbnail?: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  uploader?: string;
  thumbnail?: string;
  item_count: number;
  entries: PlaylistItem[];
}

export interface EngineStatus {
  is_ready: boolean;
  ytdlp_version?: string;
  ytdlp_path: string;
  ffmpeg_version?: string;
  ffmpeg_path: string;
  error?: string;
}

export interface SavedLink {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  platform: string;
  quality_label: string;
  file_path: string;
  saved_at: number;
}

