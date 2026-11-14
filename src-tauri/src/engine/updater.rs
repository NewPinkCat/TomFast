use crate::models::EngineStatus;
use crate::services::config::get_bin_dir;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

pub fn get_ytdlp_path() -> PathBuf {
    let local = get_bin_dir().join("yt-dlp.exe");
    if local.exists() {
        return local;
    }
    // Check if available in system PATH
    PathBuf::from("yt-dlp.exe")
}

pub fn get_ffmpeg_path() -> PathBuf {
    let local = get_bin_dir().join("ffmpeg.exe");
    if local.exists() {
        return local;
    }
    PathBuf::from("ffmpeg.exe")
}

pub fn get_ffprobe_path() -> PathBuf {
    let local = get_bin_dir().join("ffprobe.exe");
    if local.exists() {
        return local;
    }
    PathBuf::from("ffprobe.exe")
}

pub fn check_engine_status() -> EngineStatus {
    let ytdlp_path = get_ytdlp_path();
    let ffmpeg_path = get_ffmpeg_path();

    let mut ytdlp_cmd = Command::new(&ytdlp_path);
    ytdlp_cmd.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        ytdlp_cmd.creation_flags(0x08000000);
    }
    let ytdlp_version = ytdlp_cmd
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        });

    let mut ffmpeg_cmd = Command::new(&ffmpeg_path);
    ffmpeg_cmd.arg("-version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        ffmpeg_cmd.creation_flags(0x08000000);
    }
    let ffmpeg_version = ffmpeg_cmd
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let first_line = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                Some(first_line)
            } else {
                None
            }
        });

    let is_ready = ytdlp_version.is_some() && ffmpeg_version.is_some();
    let error = if !is_ready {
        if ytdlp_version.is_none() && ffmpeg_version.is_none() {
            Some("Thiếu cả yt-dlp và FFmpeg trong hệ thống.".to_string())
        } else if ytdlp_version.is_none() {
            Some("Chưa tìm thấy yt-dlp.exe. Vui lòng bấm Cập nhật Engine.".to_string())
        } else {
            Some("Chưa tìm thấy FFmpeg trong hệ thống.".to_string())
        }
    } else {
        None
    };

    EngineStatus {
        is_ready,
        ytdlp_version,
        ytdlp_path: ytdlp_path.to_string_lossy().to_string(),
        ffmpeg_version,
        ffmpeg_path: ffmpeg_path.to_string_lossy().to_string(),
        error,
    }
}

pub async fn download_or_update_ytdlp(app_handle: Option<AppHandle>) -> Result<String, String> {
    let url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    let dest_path = get_bin_dir().join("yt-dlp.exe");
    let temp_path = get_bin_dir().join("yt-dlp.exe.tmp");

    if let Some(app) = &app_handle {
        let _ = app.emit("engine-update-progress", "Đang kết nối GitHub để tải yt-dlp mới nhất...");
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TomFast/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Lỗi tải yt-dlp từ GitHub: HTTP {}", res.status()));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    tokio::fs::write(&temp_path, bytes).await.map_err(|e| e.to_string())?;

    // Atomic rename
    if dest_path.exists() {
        let _ = tokio::fs::remove_file(&dest_path).await;
    }
    tokio::fs::rename(&temp_path, &dest_path).await.map_err(|e| e.to_string())?;

    let status = check_engine_status();
    let version = status.ytdlp_version.unwrap_or_else(|| "Đã cập nhật".to_string());

    if let Some(app) = &app_handle {
        let _ = app.emit("engine-update-progress", format!("Cập nhật thành công phiên bản: {}", version));
    }

    Ok(version)
}
