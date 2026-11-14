use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatOption {
    pub format_id: String,
    pub quality_label: String,
    pub ext: String,
    pub filesize_bytes: Option<u64>,
    pub filesize_approx: Option<String>,
    pub is_audio_only: bool,
    pub resolution: Option<String>,
    pub direct_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub id: String,
    pub url: String,
    pub title: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub duration_seconds: Option<u64>,
    pub duration_formatted: Option<String>,
    pub uploader: Option<String>,
    pub platform: String,
    pub formats: Vec<FormatOption>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Downloading,
    Merging,
    Completed,
    Failed,
    Paused,
    Canceled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub platform: String,
    pub selected_format_id: String,
    pub quality_label: String,
    pub ext: String,
    pub is_audio_only: bool,
    pub output_path: String,
    pub status: TaskStatus,
    pub progress_percent: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub speed_formatted: String,
    pub eta_formatted: String,
    pub error_message: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub task_id: String,
    pub status: TaskStatus,
    pub percent: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_formatted: String,
    pub eta_formatted: String,
    pub error: Option<String>,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub duration_formatted: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: Option<String>,
    pub thumbnail: Option<String>,
    pub item_count: usize,
    pub entries: Vec<PlaylistItem>,
}

fn default_concurrent_fragments() -> usize {
    8
}

fn default_minimize_to_tray() -> bool {
    true
}

fn default_shutdown_action() -> String {
    "shutdown".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub download_dir: String,
    pub max_concurrent_downloads: usize,
    pub auto_clipboard_detect: bool,
    pub default_to_mp3: bool,
    pub notifications_enabled: bool,
    #[serde(default = "default_concurrent_fragments")]
    pub concurrent_fragments: usize,
    #[serde(default)]
    pub browser_cookies: Option<String>,
    #[serde(default = "default_minimize_to_tray")]
    pub minimize_to_tray: bool,
    #[serde(default)]
    pub auto_shutdown_on_complete: bool,
    #[serde(default = "default_shutdown_action")]
    pub auto_shutdown_action: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            download_dir: r"D:\Artificial Intelligence\Data\TomFast\downloads".to_string(),
            max_concurrent_downloads: 3,
            auto_clipboard_detect: true,
            default_to_mp3: false,
            notifications_enabled: true,
            concurrent_fragments: 8,
            browser_cookies: None,
            minimize_to_tray: true,
            auto_shutdown_on_complete: false,
            auto_shutdown_action: "shutdown".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStatus {
    pub is_ready: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: String,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: String,
    pub error: Option<String>,
}
