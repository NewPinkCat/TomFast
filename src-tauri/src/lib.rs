use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

pub mod downloader;
pub mod engine;
pub mod models;
pub mod services;

use downloader::manager::DownloadManager;
use engine::extractor::{extract_media_info, extract_playlist_info};
use engine::updater::{check_engine_status, download_or_update_ytdlp};
use models::{AppConfig, DownloadTask, EngineStatus, MediaInfo, PlaylistInfo};
use services::clipboard::start_clipboard_listener;
use services::config::{get_downloads_dir, ConfigService};
use services::saved_links::{SavedLink, SavedLinksService};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub fn resolve_existing_path(path: &str) -> Option<PathBuf> {
    let p = PathBuf::from(path);
    if p.exists() {
        return Some(p);
    }

    let file_name = p.file_name()?.to_string_lossy().to_string();
    let current_dir = PathBuf::from(".");
    let parent = p.parent().unwrap_or(&current_dir);
    let target_dir = if parent.exists() {
        parent.to_path_buf()
    } else {
        get_downloads_dir()
    };

    if !target_dir.exists() {
        return None;
    }

    // Try common Windows sanitization variations (fullwidth pipe '｜' vs underscore '_')
    let variations = [
        file_name.replace('_', "｜"),
        file_name.replace("｜", "_"),
        file_name.replace(" | ", " ｜ "),
        file_name.replace(" | ", " _ "),
        file_name.replace(" _ ", " ｜ "),
        file_name.trim().to_string(),
    ];

    for v in &variations {
        let candidate = target_dir.join(v);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    // Fuzzy matching in target download directory
    if let Ok(entries) = std::fs::read_dir(&target_dir) {
        let ext = p.extension().map(|e| e.to_string_lossy().to_string().to_lowercase()).unwrap_or_default();
        let stem = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let clean_stem: String = stem.chars().filter(|c| c.is_alphanumeric()).collect();
        let prefix: String = clean_stem.chars().take(8).collect::<String>().to_lowercase();

        for entry in entries.flatten() {
            let ep = entry.path();
            if ep.is_file() {
                let e_name = ep.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                let e_clean: String = e_name.chars().filter(|c| c.is_alphanumeric()).collect();
                if !prefix.is_empty() && e_clean.contains(&prefix) {
                    if ext.is_empty() || e_name.ends_with(&ext) {
                        return Some(ep);
                    }
                }
            }
        }
    }

    None
}

pub struct AppState {
    pub download_manager: Arc<DownloadManager>,
    pub config_service: ConfigService,
    pub clipboard_enabled: Arc<AtomicBool>,
}

#[tauri::command]
async fn get_engine_status_command() -> EngineStatus {
    tokio::task::spawn_blocking(check_engine_status)
        .await
        .unwrap_or_else(|_| EngineStatus {
            is_ready: false,
            ytdlp_version: None,
            ytdlp_path: "".to_string(),
            ffmpeg_version: None,
            ffmpeg_path: "".to_string(),
            error: Some("Lỗi kiểm tra engine".to_string()),
        })
}

#[tauri::command]
async fn update_engine_command(app: AppHandle) -> Result<String, String> {
    download_or_update_ytdlp(Some(app)).await
}

#[tauri::command]
async fn analyze_url_command(url: String, state: State<'_, AppState>) -> Result<MediaInfo, String> {
    let cookies = state.config_service.get_config().browser_cookies;
    tokio::task::spawn_blocking(move || extract_media_info(&url, cookies.as_deref()))
        .await
        .map_err(|e| format!("Lỗi luồng phân tích: {}", e))?
}

#[tauri::command]
async fn analyze_playlist_command(url: String, state: State<'_, AppState>) -> Result<PlaylistInfo, String> {
    let cookies = state.config_service.get_config().browser_cookies;
    tokio::task::spawn_blocking(move || extract_playlist_info(&url, cookies.as_deref()))
        .await
        .map_err(|e| format!("Lỗi luồng phân tích playlist: {}", e))?
}

#[tauri::command]
fn toggle_mini_mode_command(app: AppHandle, mini: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if mini {
            let _ = window.set_always_on_top(true);
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 360.0, height: 160.0 })));
            let _ = window.set_resizable(false);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 180.0 }));
        } else {
            let _ = window.set_always_on_top(false);
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 720.0, height: 500.0 })));
            let _ = window.set_resizable(true);
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1120.0, height: 780.0 }));
            let _ = window.center();
        }
        Ok(())
    } else {
        Err("Không tìm thấy cửa sổ chính".to_string())
    }
}

#[tauri::command]
fn set_mini_preview_expand_command(app: AppHandle, expand: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if expand {
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 680.0, height: 580.0 })));
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 740.0, height: 640.0 }));
            let _ = window.center();
        } else {
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 360.0, height: 160.0 })));
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 180.0 }));
        }
        Ok(())
    } else {
        Err("Không tìm thấy cửa sổ chính".to_string())
    }
}

#[tauri::command]
fn execute_system_action_command(action: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        if action == "shutdown" {
            let mut cmd = Command::new("shutdown");
            cmd.args(["/s", "/t", "0"]);
            cmd.creation_flags(0x08000000);
            cmd.spawn().map_err(|e| format!("Lỗi tắt máy: {}", e))?;
        } else if action == "sleep" {
            let mut cmd = Command::new("rundll32.exe");
            cmd.args(["powrprof.dll,SetSuspendState", "0,1,0"]);
            cmd.creation_flags(0x08000000);
            cmd.spawn().map_err(|e| format!("Lỗi chế độ ngủ: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn start_download_command(
    url: String,
    format_id: String,
    quality_label: String,
    ext: String,
    is_audio_only: bool,
    title: String,
    thumbnail: Option<String>,
    platform: String,
    direct_url: Option<String>,
    state: State<AppState>,
) -> Result<DownloadTask, String> {
    state.download_manager.start_download(
        url,
        format_id,
        quality_label,
        ext,
        is_audio_only,
        title,
        thumbnail,
        platform,
        direct_url,
    )
}

#[tauri::command]
fn cancel_task_command(id: String, state: State<AppState>) -> bool {
    state.download_manager.cancel_task(&id)
}

#[tauri::command]
fn pause_task_command(id: String, state: State<AppState>) -> bool {
    state.download_manager.pause_task(&id)
}

#[tauri::command]
fn resume_task_command(id: String, state: State<AppState>) -> Result<(), String> {
    state.download_manager.resume_task(&id)
}

#[tauri::command]
fn get_tasks_command(state: State<AppState>) -> Vec<DownloadTask> {
    state.download_manager.get_tasks()
}

#[tauri::command]
fn clear_completed_command(state: State<AppState>) {
    state.download_manager.clear_completed();
}

#[tauri::command]
fn get_app_config_command(state: State<AppState>) -> AppConfig {
    state.config_service.get_config()
}

#[tauri::command]
fn update_app_config_command(config: AppConfig, state: State<AppState>) -> Result<(), String> {
    state.clipboard_enabled.store(config.auto_clipboard_detect, Ordering::Relaxed);
    state.config_service.save_config(config)
}

#[tauri::command]
fn get_saved_links_command() -> Vec<SavedLink> {
    SavedLinksService::get_saved_links()
}

#[tauri::command]
fn delete_saved_link_command(id: String) -> bool {
    SavedLinksService::delete_saved_link(&id)
}

#[tauri::command]
fn clear_saved_links_command() -> bool {
    SavedLinksService::clear_all_saved_links()
}

#[tauri::command]
fn open_folder_command(path: String) -> Result<(), String> {
    if let Some(resolved) = resolve_existing_path(&path) {
        #[cfg(windows)]
        {
            let mut cmd = Command::new("explorer");
            cmd.args(["/select,", &resolved.to_string_lossy()]);
            cmd.spawn().map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(not(windows))]
        {
            let parent = resolved.parent().unwrap_or(&resolved);
            let _ = Command::new("open").arg(parent).spawn();
            return Ok(());
        }
    }

    let p = PathBuf::from(&path);
    let dir = if p.is_dir() && p.exists() {
        p
    } else if let Some(parent) = p.parent() {
        if parent.exists() {
            parent.to_path_buf()
        } else {
            get_downloads_dir()
        }
    } else {
        get_downloads_dir()
    };

    #[cfg(windows)]
    {
        let mut cmd = Command::new("explorer");
        cmd.arg(&dir);
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("open").arg(&dir).spawn();
    }
    Ok(())
}

#[tauri::command]
fn open_file_command(path: String) -> Result<(), String> {
    let resolved = resolve_existing_path(&path)
        .ok_or_else(|| format!("Tệp không tồn tại trên ổ đĩa: {}", path))?;

    let path_str = resolved.to_string_lossy().to_string();

    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "start", "", &path_str]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn().map_err(|e| format!("Không thể mở tệp: {}", e))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("open");
        cmd.arg(&path_str);
        cmd.spawn().map_err(|e| format!("Không thể mở tệp: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_existing_path_fuzzy() {
        let temp_dir = std::env::temp_dir();
        let actual_file = temp_dir.join("test_fuzzy｜track.mp3");
        let _ = std::fs::write(&actual_file, b"test audio content");

        // Test with virtual path using underscore '_' instead of fullwidth '｜'
        let virtual_path = temp_dir.join("test_fuzzy_track.mp3");
        let resolved = resolve_existing_path(&virtual_path.to_string_lossy());

        assert!(resolved.is_some(), "Fuzzy path resolver must find the existing file on disk");
        if let Some(ref path) = resolved {
            assert_eq!(path, &actual_file);
        }

        let _ = std::fs::remove_file(&actual_file);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let config_service = ConfigService::new();
            let cfg = config_service.get_config();
            let clipboard_enabled = Arc::new(AtomicBool::new(cfg.auto_clipboard_detect));

            let download_manager = Arc::new(DownloadManager::new(app.handle().clone(), config_service.clone()));

            // Start clipboard background listener
            start_clipboard_listener(app.handle().clone(), clipboard_enabled.clone());

            // Build Tray Menu & Tray Icon
            let show_i = MenuItem::with_id(app, "show", "Mở TomFast", true, None::<&str>)?;
            let pause_all_i = MenuItem::with_id(app, "pause_all", "Tạm dừng tất cả", true, None::<&str>)?;
            let resume_all_i = MenuItem::with_id(app, "resume_all", "Tiếp tục tất cả", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Thoát hoàn toàn", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &pause_all_i, &resume_all_i, &quit_i])?;

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("TomFast - Media Downloader")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "pause_all" => {
                        if let Some(state) = app.try_state::<AppState>() {
                            let tasks = state.download_manager.get_tasks();
                            for t in tasks {
                                if t.status == models::TaskStatus::Downloading {
                                    state.download_manager.pause_task(&t.id);
                                }
                            }
                        }
                    }
                    "resume_all" => {
                        if let Some(state) = app.try_state::<AppState>() {
                            let tasks = state.download_manager.get_tasks();
                            for t in tasks {
                                if t.status == models::TaskStatus::Paused {
                                    let _ = state.download_manager.resume_task(&t.id);
                                }
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                let _ = tray.icon(icon.clone()).build(app);
            } else {
                let _ = tray.build(app);
            }

            // Window close-to-tray handling
            if let Some(main_window) = app.get_webview_window("main") {
                let config_service_clone = config_service.clone();
                let win_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let cfg = config_service_clone.get_config();
                        if cfg.minimize_to_tray {
                            api.prevent_close();
                            let _ = win_clone.hide();
                        }
                    }
                });
            }

            app.manage(AppState {
                download_manager,
                config_service,
                clipboard_enabled,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_engine_status_command,
            update_engine_command,
            analyze_url_command,
            analyze_playlist_command,
            start_download_command,
            cancel_task_command,
            pause_task_command,
            resume_task_command,
            get_tasks_command,
            clear_completed_command,
            get_app_config_command,
            update_app_config_command,
            open_folder_command,
            open_file_command,
            get_saved_links_command,
            delete_saved_link_command,
            clear_saved_links_command,
            toggle_mini_mode_command,
            set_mini_preview_expand_command,
            execute_system_action_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
