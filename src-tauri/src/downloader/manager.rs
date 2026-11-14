use crate::downloader::stream::download_with_ytdlp_stream;
use crate::models::{DownloadProgressPayload, DownloadTask, TaskStatus};
use crate::services::config::ConfigService;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Listener};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

pub struct DownloadManager {
    app_handle: AppHandle,
    tasks: Arc<Mutex<Vec<DownloadTask>>>,
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    pause_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    config_service: ConfigService,
}

impl DownloadManager {
    pub fn new(app_handle: AppHandle, config_service: ConfigService) -> Self {
        let history = ConfigService::load_history();
        let tasks = Arc::new(Mutex::new(history));
        let cancel_flags = Arc::new(Mutex::new(HashMap::new()));
        let pause_flags = Arc::new(Mutex::new(HashMap::new()));

        let mgr = Self {
            app_handle: app_handle.clone(),
            tasks: tasks.clone(),
            cancel_flags: cancel_flags.clone(),
            pause_flags: pause_flags.clone(),
            config_service: config_service.clone(),
        };

        // Listen to progress updates to update memory state
        let tasks_clone = tasks.clone();
        let app_handle_clone = app_handle.clone();
        let config_clone = config_service.clone();

        app_handle.listen("download-progress", move |event| {
            if let Ok(payload) = serde_json::from_str::<DownloadProgressPayload>(event.payload()) {
                let mut guard = tasks_clone.lock().unwrap();
                if let Some(task) = guard.iter_mut().find(|t| t.id == payload.task_id) {
                    task.status = payload.status;
                    task.progress_percent = payload.percent;
                    task.downloaded_bytes = payload.downloaded_bytes;
                    if payload.total_bytes > 0 {
                        task.total_bytes = payload.total_bytes;
                    }
                    task.speed_formatted = payload.speed_formatted;
                    task.eta_formatted = payload.eta_formatted;
                    if let Some(err) = payload.error {
                        task.error_message = Some(err);
                    }
                    if let Some(real_path) = payload.output_path {
                        task.output_path = real_path;
                    }

                    if payload.status == TaskStatus::Completed {
                        // Notify user
                        let cfg = config_clone.get_config();
                        if cfg.notifications_enabled {
                            let _ = app_handle_clone
                                .notification()
                                .builder()
                                .title("TomFast - Tải Hoàn Tất!")
                                .body(format!("Đã tải thành công: {}", task.title))
                                .show();
                        }
                    }
                }
                ConfigService::save_history(&guard);
            }
        });

        mgr
    }

    pub fn get_tasks(&self) -> Vec<DownloadTask> {
        self.tasks.lock().unwrap().clone()
    }

    pub fn cleanup_incomplete_files(output_path: &str) {
        let path = PathBuf::from(output_path);
        let target_dir = match path.parent() {
            Some(p) if p.exists() => p.to_path_buf(),
            _ => return,
        };
        let file_stem = match path.file_stem() {
            Some(s) => s.to_string_lossy().to_string(),
            None => return,
        };

        // 1. Direct candidate files with standard extensions
        let ext_str = path.extension().unwrap_or_default().to_string_lossy();
        let direct_candidates = [
            path.with_extension(format!("{}.part", ext_str)),
            path.with_extension("part"),
            path.with_extension("ytdl"),
            path.with_extension("recode.mp4"),
            path.clone(),
        ];
        for c in &direct_candidates {
            if c.exists() && c.is_file() {
                let _ = std::fs::remove_file(c);
            }
        }

        // 2. Scan download directory for any partial files matching the stem
        if let Ok(entries) = std::fs::read_dir(&target_dir) {
            let clean_stem: String = file_stem
                .chars()
                .filter(|c| c.is_alphanumeric())
                .take(12)
                .collect::<String>()
                .to_lowercase();

            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                    let clean_name: String = name.chars().filter(|c| c.is_alphanumeric()).collect();
                    if !clean_stem.is_empty() && clean_name.starts_with(&clean_stem) {
                        if name.ends_with(".part")
                            || name.ends_with(".ytdl")
                            || name.contains(".f")
                            || name.ends_with(".recode.mp4")
                        {
                            let _ = std::fs::remove_file(p);
                        }
                    }
                }
            }
        }
    }

    pub fn cancel_task(&self, id: &str) -> bool {
        let flags = self.cancel_flags.lock().unwrap();
        if let Some(flag) = flags.get(id) {
            flag.store(true, Ordering::Relaxed);
        }

        let (output_path, payload) = {
            let mut guard = self.tasks.lock().unwrap();
            let mut path = None;
            let mut p = None;
            if let Some(t) = guard.iter_mut().find(|t| t.id == id) {
                t.status = TaskStatus::Canceled;
                t.speed_formatted = "0 KB/s".to_string();
                path = Some(t.output_path.clone());

                p = Some(DownloadProgressPayload {
                    task_id: id.to_string(),
                    status: TaskStatus::Canceled,
                    percent: t.progress_percent,
                    downloaded_bytes: t.downloaded_bytes,
                    total_bytes: t.total_bytes,
                    speed_formatted: "0 KB/s".to_string(),
                    eta_formatted: "Đã hủy".to_string(),
                    error: None,
                    output_path: None,
                });
            }
            ConfigService::save_history(&guard);
            (path, p)
        };

        if let Some(p) = payload {
            let _ = self.app_handle.emit("download-progress", p);
        }

        if let Some(path) = output_path {
            Self::cleanup_incomplete_files(&path);
        }
        true
    }

    pub fn pause_task(&self, id: &str) -> bool {
        let flags = self.pause_flags.lock().unwrap();
        if let Some(flag) = flags.get(id) {
            flag.store(true, Ordering::Relaxed);
        }

        let payload = {
            let mut guard = self.tasks.lock().unwrap();
            let mut p = None;
            if let Some(t) = guard.iter_mut().find(|t| t.id == id) {
                t.status = TaskStatus::Paused;
                t.speed_formatted = "Đã tạm dừng".to_string();
                t.eta_formatted = "--".to_string();

                p = Some(DownloadProgressPayload {
                    task_id: id.to_string(),
                    status: TaskStatus::Paused,
                    percent: t.progress_percent,
                    downloaded_bytes: t.downloaded_bytes,
                    total_bytes: t.total_bytes,
                    speed_formatted: "Đã tạm dừng".to_string(),
                    eta_formatted: "--".to_string(),
                    error: None,
                    output_path: None,
                });
            }
            ConfigService::save_history(&guard);
            p
        };

        if let Some(p) = payload {
            let _ = self.app_handle.emit("download-progress", p);
        }
        true
    }

    pub fn resume_task(&self, id: &str) -> Result<(), String> {
        let (task, payload) = {
            let mut guard = self.tasks.lock().unwrap();
            let t = guard.iter_mut().find(|t| t.id == id).ok_or("Không tìm thấy tác vụ")?;
            if t.status != TaskStatus::Paused {
                return Err("Tác vụ không ở trạng thái tạm dừng".to_string());
            }
            t.status = TaskStatus::Downloading;
            t.speed_formatted = "Đang kết nối lại...".to_string();

            let task = t.clone();
            let p = DownloadProgressPayload {
                task_id: id.to_string(),
                status: TaskStatus::Downloading,
                percent: t.progress_percent,
                downloaded_bytes: t.downloaded_bytes,
                total_bytes: t.total_bytes,
                speed_formatted: "Đang kết nối lại...".to_string(),
                eta_formatted: "--".to_string(),
                error: None,
                output_path: None,
            };

            ConfigService::save_history(&guard);
            (task, p)
        };

        let _ = self.app_handle.emit("download-progress", payload);

        let cancel_flag = Arc::new(AtomicBool::new(false));
        let pause_flag = Arc::new(AtomicBool::new(false));
        {
            let mut c_flags = self.cancel_flags.lock().unwrap();
            c_flags.insert(task.id.clone(), cancel_flag.clone());
            let mut p_flags = self.pause_flags.lock().unwrap();
            p_flags.insert(task.id.clone(), pause_flag.clone());
        }

        self.spawn_worker(task, cancel_flag, pause_flag);
        Ok(())
    }

    pub fn clear_completed(&self) {
        let mut guard = self.tasks.lock().unwrap();
        guard.retain(|t| t.status != TaskStatus::Completed && t.status != TaskStatus::Canceled);
        ConfigService::save_history(&guard);
    }

    pub fn start_download(
        &self,
        url: String,
        format_id: String,
        quality_label: String,
        ext: String,
        is_audio_only: bool,
        title: String,
        thumbnail: Option<String>,
        platform: String,
        _direct_url: Option<String>,
    ) -> Result<DownloadTask, String> {
        let id = Uuid::new_v4().to_string();
        let config = self.config_service.get_config();
        let target_dir = PathBuf::from(&config.download_dir);
        let _ = std::fs::create_dir_all(&target_dir);

        // Sanitize filename for Windows
        let sanitized_title: String = title
            .chars()
            .map(|c| match c {
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
                _ => c,
            })
            .collect();

        let final_ext = if is_audio_only || ext == "mp3" { "mp3".to_string() } else { ext };
        let file_name = format!("{}.{}", sanitized_title, final_ext);
        let output_path = target_dir.join(&file_name).to_string_lossy().to_string();

        let task = DownloadTask {
            id: id.clone(),
            url: url.clone(),
            title: title.clone(),
            thumbnail,
            platform,
            selected_format_id: format_id.clone(),
            quality_label,
            ext: final_ext.clone(),
            is_audio_only,
            output_path: output_path.clone(),
            status: TaskStatus::Downloading,
            progress_percent: 0.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bytes_per_sec: 0,
            speed_formatted: "Đang lấy link...".to_string(),
            eta_formatted: "--".to_string(),
            error_message: None,
            created_at: chrono::Utc::now().timestamp(),
        };

        {
            let mut guard = self.tasks.lock().unwrap();
            guard.insert(0, task.clone());
            ConfigService::save_history(&guard);
        }

        let cancel_flag = Arc::new(AtomicBool::new(false));
        let pause_flag = Arc::new(AtomicBool::new(false));
        {
            let mut c_flags = self.cancel_flags.lock().unwrap();
            c_flags.insert(id.clone(), cancel_flag.clone());
            let mut p_flags = self.pause_flags.lock().unwrap();
            p_flags.insert(id.clone(), pause_flag.clone());
        }

        self.spawn_worker(task.clone(), cancel_flag, pause_flag);

        Ok(task)
    }

    fn spawn_worker(&self, task: DownloadTask, cancel_flag: Arc<AtomicBool>, pause_flag: Arc<AtomicBool>) {
        let app_handle = self.app_handle.clone();
        let task_id = task.id.clone();
        let tasks_clone_for_spawn = self.tasks.clone();
        let config = self.config_service.get_config();
        let target_dir = PathBuf::from(&config.download_dir);
        let concurrent_fragments = config.concurrent_fragments;
        let browser_cookies = config.browser_cookies.clone();

        tauri::async_runtime::spawn(async move {
            // Direct, rock-solid download with yt-dlp native progressive stream
            let template = format!("{}/%(title)s.%(ext)s", target_dir.to_string_lossy());
            let res = download_with_ytdlp_stream(
                app_handle.clone(),
                task_id.clone(),
                task.url.clone(),
                task.selected_format_id.clone(),
                task.ext.clone(),
                task.is_audio_only,
                template,
                concurrent_fragments,
                browser_cookies,
                cancel_flag,
                pause_flag,
            )
            .await;

            match res {
                Ok(real_path) => {
                    let mut guard = tasks_clone_for_spawn.lock().unwrap();
                    if let Some(t) = guard.iter_mut().find(|t| t.id == task_id) {
                        t.output_path = real_path.clone();
                        t.status = TaskStatus::Completed;

                        // Automatically save to Saved Links (only completed downloads)
                        crate::services::saved_links::SavedLinksService::save_completed_link(
                            crate::services::saved_links::SavedLink {
                                id: Uuid::new_v4().to_string(),
                                url: t.url.clone(),
                                title: t.title.clone(),
                                thumbnail: t.thumbnail.clone(),
                                platform: t.platform.clone(),
                                quality_label: t.quality_label.clone(),
                                file_path: real_path,
                                saved_at: chrono::Utc::now().timestamp(),
                            },
                        );
                    }
                    ConfigService::save_history(&guard);

                    // Notify frontend that saved-links have been safely updated to disk
                    let _ = app_handle.emit("saved-links-updated", ());
                }
                Err(e) if e == "PAUSED" => {
                    // Task successfully paused, part files kept intact
                }
                Err(e) if e == "CANCELED" => {
                    // Task canceled, part files already cleaned
                }
                Err(e) => {
                    let mut guard = tasks_clone_for_spawn.lock().unwrap();
                    if let Some(t) = guard.iter_mut().find(|t| t.id == task_id) {
                        t.status = TaskStatus::Failed;
                        t.error_message = Some(e.clone());
                    }
                    ConfigService::save_history(&guard);

                    let _ = app_handle.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            task_id,
                            status: TaskStatus::Failed,
                            percent: 0.0,
                            downloaded_bytes: 0,
                            total_bytes: 0,
                            speed_formatted: "0 KB/s".to_string(),
                            eta_formatted: "--".to_string(),
                            error: Some(e),
                            output_path: None,
                        },
                    );
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cleanup_incomplete_files() {
        let temp_dir = std::env::temp_dir().join("tomfast_test_cleanup");
        let _ = std::fs::create_dir_all(&temp_dir);

        let output_path = temp_dir.join("test_video.mp4");
        let part_file = temp_dir.join("test_video.mp4.part");
        let ytdl_file = temp_dir.join("test_video.mp4.ytdl");

        std::fs::write(&part_file, b"sample partial data").unwrap();
        std::fs::write(&ytdl_file, b"sample ytdl data").unwrap();
        assert!(part_file.exists());
        assert!(ytdl_file.exists());

        DownloadManager::cleanup_incomplete_files(&output_path.to_string_lossy());

        assert!(!part_file.exists(), "part file must be deleted");
        assert!(!ytdl_file.exists(), "ytdl file must be deleted");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
