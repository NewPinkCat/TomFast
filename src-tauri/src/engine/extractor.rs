use crate::engine::updater::get_ytdlp_path;
use crate::models::{FormatOption, MediaInfo, PlaylistInfo, PlaylistItem};
use serde_json::Value;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub fn extract_media_info(url: &str, browser_cookies: Option<&str>) -> Result<MediaInfo, String> {
    let ytdlp_path = get_ytdlp_path();
    
    let mut cmd = Command::new(&ytdlp_path);
    cmd.args([
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--no-playlist",
        "--socket-timeout", "10",
    ]);

    if let Some(browser) = browser_cookies {
        if !browser.trim().is_empty() && browser != "none" {
            cmd.args(["--cookies-from-browser", browser.trim()]);
        }
    }

    cmd.arg(url);

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Không thể chạy yt-dlp: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Lỗi phân tích liên kết: {}", err_msg.trim()));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Lỗi đọc dữ liệu JSON từ yt-dlp: {}", e))?;

    let id = parsed.get("id").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let title = parsed.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
    let description = parsed.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let thumbnail = parsed.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string());
    let duration_seconds = parsed.get("duration").and_then(|v| v.as_u64());
    let uploader = parsed.get("uploader").and_then(|v| v.as_str()).map(|s| s.to_string());
    let extractor_key = parsed.get("extractor_key").and_then(|v| v.as_str()).unwrap_or("Generic");

    let platform = match extractor_key.to_lowercase().as_str() {
        k if k.contains("youtube") => "youtube",
        k if k.contains("tiktok") => "tiktok",
        k if k.contains("twitter") || k.contains("x") => "x",
        k if k.contains("pinterest") => "pinterest",
        k if k.contains("facebook") => "facebook",
        k if k.contains("instagram") => "instagram",
        k if k.contains("reddit") => "reddit",
        _ => "media",
    }.to_string();

    let duration_formatted = duration_seconds.map(|secs| {
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        let s = secs % 60;
        if h > 0 {
            format!("{:02}:{:02}:{:02}", h, m, s)
        } else {
            format!("{:02}:{:02}", m, s)
        }
    });

    let mut formats: Vec<FormatOption> = Vec::new();

    // Add High Quality MP3 option by default for video platforms
    formats.push(FormatOption {
        format_id: "bestaudio/mp3".to_string(),
        quality_label: "Âm thanh MP3 (Chất lượng cao 320kbps)".to_string(),
        ext: "mp3".to_string(),
        filesize_bytes: None,
        filesize_approx: Some("~ 4-10 MB".to_string()),
        is_audio_only: true,
        resolution: Some("Audio 320k".to_string()),
        direct_url: None,
    });

    // Check available formats from raw JSON
    if let Some(raw_formats) = parsed.get("formats").and_then(|f| f.as_array()) {
        // Collect video resolutions
        let mut added_res = std::collections::HashSet::new();

        for fmt in raw_formats.iter().rev() {
            let vcodec = fmt.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
            let height = fmt.get("height").and_then(|h| h.as_u64());
            let width = fmt.get("width").and_then(|w| w.as_u64());
            let filesize = fmt.get("filesize").and_then(|s| s.as_u64())
                .or_else(|| fmt.get("filesize_approx").and_then(|s| s.as_u64()));

            if vcodec != "none" {
                // Effective resolution: min(width, height) works for both landscape & vertical videos
                let eff_res = match (height, width) {
                    (Some(h), Some(w)) => h.min(w),
                    (Some(h), None) => h,
                    (None, Some(w)) => w,
                    _ => 0,
                };

                // Map to standard tiers: 2160, 1440, 1080, 720, 540, 480, 360
                let tier = if eff_res >= 2100 {
                    2160
                } else if eff_res >= 1400 {
                    1440
                } else if eff_res >= 1000 {
                    1080
                } else if eff_res >= 700 {
                    720
                } else if eff_res >= 500 {
                    540
                } else if eff_res >= 400 {
                    480
                } else if eff_res >= 300 {
                    360
                } else {
                    0
                };

                if tier > 0 && !added_res.contains(&tier) {
                    added_res.insert(tier);
                    let label = match tier {
                        2160 => "Video 4K UHD (2160p)",
                        1440 => "Video 2K QHD (1440p)",
                        1080 => "Video Full HD (1080p)",
                        720 => "Video HD (720p)",
                        540 => "Video Tiêu Chuẩn (540p)",
                        480 => "Video Tiết Kiệm (480p)",
                        360 => "Video Siêu Tiết Kiệm (360p)",
                        _ => "Video",
                    };

                    let approx_str = filesize.map(|b| {
                        let mb = b as f64 / 1_048_576.0;
                        format!("{:.1} MB", mb)
                    });

                    // Target resolution tier for yt-dlp (works seamlessly for both landscape and vertical videos)
                    let filter = format!("res:{}", tier);

                    formats.push(FormatOption {
                        format_id: filter,
                        quality_label: label.to_string(),
                        ext: "mp4".to_string(),
                        filesize_bytes: filesize,
                        filesize_approx: approx_str,
                        is_audio_only: false,
                        resolution: Some(format!("{}p", tier)),
                        direct_url: None,
                    });
                }
            }
        }
    }

    // Always ensure "Best Quality" is at top of video list
    formats.insert(1, FormatOption {
        format_id: "bestvideo+bestaudio/best".to_string(),
        quality_label: "Video Chất Lượng Tốt Nhất (Tự Động Ghép MP4 H.264)".to_string(),
        ext: "mp4".to_string(),
        filesize_bytes: None,
        filesize_approx: None,
        is_audio_only: false,
        resolution: Some("Best".to_string()),
        direct_url: None,
    });

    Ok(MediaInfo {
        id,
        url: url.to_string(),
        title,
        description,
        thumbnail,
        duration_seconds,
        duration_formatted,
        uploader,
        platform,
        formats,
    })
}

/// Extract direct CDN URLs for video and audio streams using yt-dlp -g
pub fn extract_direct_stream_urls(
    url: &str,
    format_id: &str,
    is_audio_only: bool,
) -> Result<Vec<String>, String> {
    let ytdlp_path = get_ytdlp_path();
    let mut cmd = Command::new(&ytdlp_path);
    cmd.args([
        "-g",
        "--no-warnings",
        "--no-playlist",
        "--socket-timeout",
        "10",
    ]);

    if is_audio_only {
        cmd.args(["-f", "bestaudio/best"]);
    } else if format_id.starts_with("res:") {
        let res_val = &format_id[4..];
        let sort_arg = format!("res:{},ext:mp4:m4a", res_val);
        cmd.args(["-f", "bestvideo+bestaudio/best", "-S", &sort_arg]);
    } else if format_id == "bestvideo+bestaudio/best" || format_id.is_empty() {
        cmd.args(["-f", "bestvideo+bestaudio/best", "-S", "res,ext:mp4:m4a"]);
    } else {
        cmd.args(["-f", format_id, "-S", "res,ext:mp4:m4a"]);
    }

    cmd.arg(url);

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Không thể chạy yt-dlp: {}", e))?;
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Lỗi lấy direct URL: {}", err_msg.trim()));
    }

    let out_str = String::from_utf8_lossy(&output.stdout);
    let urls: Vec<String> = out_str
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| l.starts_with("http://") || l.starts_with("https://"))
        .collect();

    if urls.is_empty() {
        return Err("Không tìm thấy direct CDN URL hợp lệ".to_string());
    }

    Ok(urls)
}

pub fn extract_playlist_info(url: &str, browser_cookies: Option<&str>) -> Result<PlaylistInfo, String> {
    let ytdlp_path = get_ytdlp_path();
    
    let mut cmd = Command::new(&ytdlp_path);
    cmd.args([
        "--flat-playlist",
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--socket-timeout", "15",
    ]);

    if let Some(browser) = browser_cookies {
        if !browser.trim().is_empty() && browser != "none" {
            cmd.args(["--cookies-from-browser", browser.trim()]);
        }
    }

    cmd.arg(url);

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Không thể chạy yt-dlp: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Lỗi phân tích playlist: {}", err_msg.trim()));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Lỗi đọc dữ liệu JSON từ yt-dlp: {}", e))?;

    let id = parsed.get("id").and_then(|v| v.as_str()).unwrap_or("playlist").to_string();
    let title = parsed.get("title").and_then(|v| v.as_str()).unwrap_or("Danh sách phát").to_string();
    let uploader = parsed.get("uploader").and_then(|v| v.as_str()).or_else(|| parsed.get("channel").and_then(|v| v.as_str())).map(|s| s.to_string());
    let thumbnail = parsed.get("thumbnails").and_then(|v| v.as_array()).and_then(|arr| arr.last()).and_then(|t| t.get("url")).and_then(|u| u.as_str()).map(|s| s.to_string());

    let mut entries = Vec::new();
    if let Some(arr) = parsed.get("entries").and_then(|v| v.as_array()) {
        for item in arr {
            let item_id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let item_title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Video không tên").to_string();
            let item_url = item.get("url").and_then(|v| v.as_str())
                .map(|u| if u.starts_with("http") { u.to_string() } else { format!("https://www.youtube.com/watch?v={}", u) })
                .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", item_id));
            
            let duration_secs = item.get("duration").and_then(|v| v.as_u64());
            let duration_formatted = duration_secs.map(|secs| {
                let h = secs / 3600;
                let m = (secs % 3600) / 60;
                let s = secs % 60;
                if h > 0 {
                    format!("{:02}:{:02}:{:02}", h, m, s)
                } else {
                    format!("{:02}:{:02}", m, s)
                }
            });

            let item_thumb = item.get("thumbnails").and_then(|v| v.as_array()).and_then(|arr| arr.last()).and_then(|t| t.get("url")).and_then(|u| u.as_str()).map(|s| s.to_string());

            entries.push(PlaylistItem {
                id: item_id,
                url: item_url,
                title: item_title,
                duration_formatted,
                thumbnail: item_thumb,
            });
        }
    }

    let item_count = entries.len();

    Ok(PlaylistInfo {
        id,
        title,
        uploader,
        thumbnail,
        item_count,
        entries,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_playlist_json() {
        let sample_json = r#"{
            "id": "PL12345",
            "title": "My Awesome Playlist",
            "uploader": "Sample Creator",
            "thumbnails": [{"url": "https://example.com/thumb.jpg"}],
            "entries": [
                {
                    "id": "vid1",
                    "title": "Episode 1",
                    "url": "https://www.youtube.com/watch?v=vid1",
                    "duration": 185,
                    "thumbnails": [{"url": "https://example.com/ep1.jpg"}]
                },
                {
                    "id": "vid2",
                    "title": "Episode 2",
                    "url": "vid2",
                    "duration": 3665,
                    "thumbnails": [{"url": "https://example.com/ep2.jpg"}]
                }
            ]
        }"#;

        let parsed: Value = serde_json::from_str(sample_json).unwrap();
        let id = parsed.get("id").and_then(|v| v.as_str()).unwrap().to_string();
        let title = parsed.get("title").and_then(|v| v.as_str()).unwrap().to_string();
        let mut entries = Vec::new();
        if let Some(arr) = parsed.get("entries").and_then(|v| v.as_array()) {
            for item in arr {
                let item_id = item.get("id").and_then(|v| v.as_str()).unwrap().to_string();
                let item_title = item.get("title").and_then(|v| v.as_str()).unwrap().to_string();
                let item_url = item.get("url").and_then(|v| v.as_str()).unwrap().to_string();
                let duration_secs = item.get("duration").and_then(|v| v.as_u64());
                let duration_formatted = duration_secs.map(|secs| {
                    let h = secs / 3600;
                    let m = (secs % 3600) / 60;
                    let s = secs % 60;
                    if h > 0 {
                        format!("{:02}:{:02}:{:02}", h, m, s)
                    } else {
                        format!("{:02}:{:02}", m, s)
                    }
                });
                entries.push(PlaylistItem {
                    id: item_id,
                    url: item_url,
                    title: item_title,
                    duration_formatted,
                    thumbnail: None,
                });
            }
        }

        assert_eq!(id, "PL12345");
        assert_eq!(title, "My Awesome Playlist");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].title, "Episode 1");
        assert_eq!(entries[0].duration_formatted.as_deref(), Some("03:05"));
        assert_eq!(entries[1].duration_formatted.as_deref(), Some("01:01:05"));
    }
}
