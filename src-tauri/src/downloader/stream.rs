use crate::engine::updater::{get_ffmpeg_path, get_ffprobe_path, get_ytdlp_path};
use crate::models::{DownloadProgressPayload, TaskStatus};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub fn build_ytdlp_args(
    ffmpeg_path: &str,
    format_id: &str,
    ext: &str,
    is_audio_only: bool,
    output_template: &str,
    concurrent_fragments: usize,
    url: &str,
    browser_cookies: Option<&str>,
) -> Vec<String> {
    let mut args = Vec::new();
    args.push("--encoding".to_string());
    args.push("utf-8".to_string());
    args.push("--newline".to_string());
    args.push("--no-warnings".to_string());
    args.push("--ffmpeg-location".to_string());
    args.push(ffmpeg_path.to_string());

    if let Some(browser) = browser_cookies {
        if !browser.trim().is_empty() && browser != "none" {
            args.push("--cookies-from-browser".to_string());
            args.push(browser.trim().to_string());
        }
    }

    // Multi-threaded chunk downloading (IDM-style) and auto-resume support
    args.push("--continue".to_string());
    args.push("--concurrent-fragments".to_string());
    args.push(concurrent_fragments.max(1).to_string());
    args.push("--buffer-size".to_string());
    args.push("1024K".to_string());
    args.push("--http-chunk-size".to_string());
    args.push("10M".to_string());

    if is_audio_only || ext == "mp3" {
        args.push("-x".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        args.push("--audio-quality".to_string());
        args.push("320k".to_string());
    } else {
        let (sort_order, format_spec) = if format_id.starts_with("res:") {
            let res_val = &format_id[4..];
            (
                format!("res:{},ext:mp4:m4a", res_val),
                "bestvideo+bestaudio/best".to_string(),
            )
        } else if format_id == "bestvideo+bestaudio/best" || format_id.is_empty() {
            (
                "res,ext:mp4:m4a".to_string(),
                "bestvideo+bestaudio/best".to_string(),
            )
        } else {
            (
                "res,ext:mp4:m4a".to_string(),
                format_id.to_string(),
            )
        };

        args.push("-S".to_string());
        args.push(sort_order);

        args.push("-f".to_string());
        args.push(format_spec);

        args.push("--merge-output-format".to_string());
        args.push("mp4".to_string());
    }

    args.push("--no-colors".to_string());

    // Set custom progress template for live chunks and postprocess template for real filepath
    args.push("--progress-template".to_string());
    args.push("download:TF_PROG:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s".to_string());

    args.push("--progress-template".to_string());
    args.push("postprocess:TF_REAL_PATH:%(info.filepath)s".to_string());

    args.push("-o".to_string());
    args.push(output_template.to_string());

    args.push(url.to_string());

    args
}

pub async fn download_with_ytdlp_stream(
    app_handle: AppHandle,
    task_id: String,
    url: String,
    format_id: String,
    ext: String,
    is_audio_only: bool,
    output_template: String,
    concurrent_fragments: usize,
    browser_cookies: Option<String>,
    canceled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
) -> Result<String, String> {
    let ytdlp_path = get_ytdlp_path();
    let ffmpeg_path = get_ffmpeg_path();
    let ffprobe_path = get_ffprobe_path();

    let args = build_ytdlp_args(
        &ffmpeg_path.to_string_lossy(),
        &format_id,
        &ext,
        is_audio_only,
        &output_template,
        concurrent_fragments,
        &url,
        browser_cookies.as_deref(),
    );

    let mut cmd = Command::new(&ytdlp_path);
    cmd.args(&args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| format!("Không thể chạy yt-dlp: {}", e))?;

    let stdout = child.stdout.take().ok_or("Không thể đọc stdout từ yt-dlp")?;
    let reader = BufReader::new(stdout);

    let task_id_clone = task_id.clone();
    let app_handle_clone = app_handle.clone();
    let canceled_clone = canceled.clone();
    let paused_clone = paused.clone();
    let captured_real_path = Arc::new(Mutex::new(None::<String>));
    let path_collector = captured_real_path.clone();
    let last_bytes = Arc::new(Mutex::new((0u64, 0u64)));
    let bytes_collector = last_bytes.clone();

    // Read lines in blocking thread to parse progress and capture exact filename
    let reader_handle = tokio::task::spawn_blocking(move || {
        let mut last_emit = std::time::Instant::now();
        let mut last_valid_speed: Option<String> = None;
        let mut last_valid_eta: Option<String> = None;

        for line_res in reader.lines() {
            if canceled_clone.load(Ordering::Relaxed) || paused_clone.load(Ordering::Relaxed) {
                break;
            }

            if let Ok(line) = line_res {
                let trimmed = line.trim();

                if let Some(pos) = trimmed.find("TF_REAL_PATH:") {
                    let path = trimmed[pos + 13..].trim().to_string();
                    if !path.is_empty() {
                        let mut guard = path_collector.lock().unwrap();
                        *guard = Some(path);
                    }
                    continue;
                }

                if trimmed.contains("[Merger]") || trimmed.contains("[ExtractAudio]") {
                    let _ = app_handle_clone.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            task_id: task_id_clone.clone(),
                            status: TaskStatus::Merging,
                            percent: 99.0,
                            downloaded_bytes: 0,
                            total_bytes: 0,
                            speed_formatted: "Đang hoàn tất...".to_string(),
                            eta_formatted: "--".to_string(),
                            error: None,
                            output_path: None,
                        },
                    );
                    continue;
                }

                if let Some(pos) = trimmed.find("TF_PROG:") {
                    let payload_str = &trimmed[pos + 8..];
                    let parts: Vec<&str> = payload_str.split('|').collect();

                    if parts.len() >= 3 {
                        let percent_raw = parts[0].trim().replace('%', "");
                        let percent = percent_raw.parse::<f64>().unwrap_or(0.0);

                        // Smoothing filter for speed: never let "Unknown B/s" or "NA" leak to UI
                        let raw_speed = parts[1].trim();
                        let clean_speed = raw_speed.to_lowercase();
                        let is_speed_invalid = clean_speed.is_empty()
                            || clean_speed.contains("unknown")
                            || clean_speed.contains("na")
                            || clean_speed == "none";

                        let speed_str = if !is_speed_invalid {
                            let s = raw_speed.to_string();
                            last_valid_speed = Some(s.clone());
                            s
                        } else {
                            last_valid_speed.clone().unwrap_or_else(|| "Đang tính...".to_string())
                        };

                        // Smoothing filter for ETA: never let "Unknown" or "NA" leak to UI
                        let raw_eta = parts[2].trim();
                        let clean_eta = raw_eta.to_lowercase();
                        let is_eta_invalid = clean_eta.is_empty()
                            || clean_eta.contains("unknown")
                            || clean_eta.contains("na")
                            || clean_eta == "none";

                        let eta_str = if !is_eta_invalid {
                            let e = raw_eta.to_string();
                            last_valid_eta = Some(e.clone());
                            e
                        } else {
                            last_valid_eta.clone().unwrap_or_else(|| "--".to_string())
                        };

                        let downloaded = parts.get(3).and_then(|s| s.trim().parse::<u64>().ok()).unwrap_or(0);
                        let total = parts.get(4).and_then(|s| s.trim().parse::<u64>().ok()).unwrap_or(0);

                        {
                            let mut b_guard = bytes_collector.lock().unwrap();
                            *b_guard = (downloaded, total);
                        }

                        let now = std::time::Instant::now();
                        // Throttle events: emit at most every 200ms, or when reaching >= 99%
                        if now.duration_since(last_emit).as_millis() >= 200 || percent >= 99.0 {
                            last_emit = now;
                            let _ = app_handle_clone.emit(
                                "download-progress",
                                DownloadProgressPayload {
                                    task_id: task_id_clone.clone(),
                                    status: TaskStatus::Downloading,
                                    percent,
                                    downloaded_bytes: downloaded,
                                    total_bytes: total,
                                    speed_formatted: speed_str,
                                    eta_formatted: eta_str,
                                    error: None,
                                    output_path: None,
                                },
                            );
                        }
                    }
                }
            }
        }
    });

    // Monitor status or cancellation or pause
    loop {
        if canceled.load(Ordering::Relaxed) {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &child.id().to_string()])
                    .creation_flags(0x08000000)
                    .status();
            }
            let _ = child.kill();
            return Err("CANCELED".to_string());
        }

        if paused.load(Ordering::Relaxed) {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &child.id().to_string()])
                    .creation_flags(0x08000000)
                    .status();
            }
            let _ = child.kill();
            return Err("PAUSED".to_string());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                let _ = reader_handle.await;
                if status.success() {
                    // Get real file path reported by yt-dlp
                    let final_path_str = {
                        let guard = captured_real_path.lock().unwrap();
                        guard.clone().unwrap_or_else(|| output_template.clone())
                    };

                    let final_path = PathBuf::from(&final_path_str);

                    // Check if file is HEVC/bytevc1 that needs H.264 recoding for Windows Media Player
                    if !is_audio_only && final_path.exists() && final_path.extension().map_or(false, |e| e == "mp4") {
                        let mut probe_cmd = Command::new(&ffprobe_path);
                        probe_cmd.args([
                            "-v", "error",
                            "-select_streams", "v:0",
                            "-show_entries", "stream=codec_name",
                            "-of", "default=noprint_wrappers=1:nokey=1",
                            &final_path_str,
                        ]);
                        #[cfg(windows)]
                        probe_cmd.creation_flags(0x08000000);

                        let needs_transcode = probe_cmd.output().ok().map(|out| {
                            let codec = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
                            codec.contains("hevc") || codec.contains("h265") || codec.contains("bytevc1") || codec.contains("vvc")
                        }).unwrap_or(false);

                        if needs_transcode {
                            let _ = app_handle.emit(
                                "download-progress",
                                DownloadProgressPayload {
                                    task_id: task_id.clone(),
                                    status: TaskStatus::Merging,
                                    percent: 99.0,
                                    downloaded_bytes: 0,
                                    total_bytes: 0,
                                    speed_formatted: "Đang hoàn tất video...".to_string(),
                                    eta_formatted: "--".to_string(),
                                    error: None,
                                    output_path: None,
                                },
                            );

                            let temp_recode = final_path.with_extension("recode.mp4");
                            let mut conv_cmd = Command::new(&ffmpeg_path);
                            conv_cmd.args([
                                "-y",
                                "-i", &final_path_str,
                                "-c:v", "libx264",
                                "-preset", "veryfast",
                                "-crf", "22",
                                "-c:a", "copy",
                                &temp_recode.to_string_lossy(),
                            ]);
                            #[cfg(windows)]
                            conv_cmd.creation_flags(0x08000000);

                            if let Ok(c_status) = conv_cmd.status() {
                                if c_status.success() && temp_recode.exists() {
                                    let _ = std::fs::remove_file(&final_path);
                                    let _ = std::fs::rename(&temp_recode, &final_path);
                                } else {
                                    let _ = std::fs::remove_file(&temp_recode);
                                }
                            }
                        }
                    }

                    let (final_downloaded, final_total) = {
                        let guard = last_bytes.lock().unwrap();
                        *guard
                    };
                    let final_bytes = if final_total > 0 { final_total } else { final_downloaded };

                    // Emit completed event with actual final path
                    let _ = app_handle.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            task_id,
                            status: TaskStatus::Completed,
                            percent: 100.0,
                            downloaded_bytes: final_bytes,
                            total_bytes: final_bytes,
                            speed_formatted: "0 KB/s".to_string(),
                            eta_formatted: "Xong".to_string(),
                            error: None,
                            output_path: Some(final_path_str.clone()),
                        },
                    );
                    return Ok(final_path_str);
                } else {
                    return Err("Lỗi trong quá trình tải với yt-dlp".to_string());
                }
            }
            Ok(None) => {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }
            Err(e) => {
                return Err(format!("Lỗi kiểm tra tiến trình yt-dlp: {}", e));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_ytdlp_args_resolution_tiers() {
        // 1. Test 1080p tier
        let args1080 = build_ytdlp_args(
            "ffmpeg.exe",
            "res:1080",
            "mp4",
            false,
            "test.mp4",
            8,
            "https://www.youtube.com/watch?v=sample",
            None,
        );
        let s1080_idx = args1080.iter().position(|a| a == "-S").unwrap();
        assert_eq!(args1080[s1080_idx + 1], "res:1080,ext:mp4:m4a");
        let f1080_idx = args1080.iter().position(|a| a == "-f").unwrap();
        assert_eq!(args1080[f1080_idx + 1], "bestvideo+bestaudio/best");

        // 2. Test 720p tier
        let args720 = build_ytdlp_args(
            "ffmpeg.exe",
            "res:720",
            "mp4",
            false,
            "test.mp4",
            8,
            "https://www.youtube.com/watch?v=sample",
            None,
        );
        let s720_idx = args720.iter().position(|a| a == "-S").unwrap();
        assert_eq!(args720[s720_idx + 1], "res:720,ext:mp4:m4a");

        // 3. Test 4K (2160p) tier with chrome cookies
        let args4k = build_ytdlp_args(
            "ffmpeg.exe",
            "res:2160",
            "mp4",
            false,
            "test.mp4",
            8,
            "https://www.youtube.com/watch?v=sample",
            Some("chrome"),
        );
        let s4k_idx = args4k.iter().position(|a| a == "-S").unwrap();
        assert_eq!(args4k[s4k_idx + 1], "res:2160,ext:mp4:m4a");
        let cookie_idx = args4k.iter().position(|a| a == "--cookies-from-browser").unwrap();
        assert_eq!(args4k[cookie_idx + 1], "chrome");

        // 4. Test Best Quality
        let args_best = build_ytdlp_args(
            "ffmpeg.exe",
            "bestvideo+bestaudio/best",
            "mp4",
            false,
            "test.mp4",
            8,
            "https://www.youtube.com/watch?v=sample",
            None,
        );
        let sbest_idx = args_best.iter().position(|a| a == "-S").unwrap();
        assert_eq!(args_best[sbest_idx + 1], "res,ext:mp4:m4a");
        let fbest_idx = args_best.iter().position(|a| a == "-f").unwrap();
        assert_eq!(args_best[fbest_idx + 1], "bestvideo+bestaudio/best");
    }
}
