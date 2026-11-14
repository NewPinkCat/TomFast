use regex::Regex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub fn start_clipboard_listener(app_handle: AppHandle, enabled: Arc<AtomicBool>) {
    tauri::async_runtime::spawn(async move {
        let mut last_clipboard = String::new();
        let url_regex = Regex::new(r"https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s]*)?").unwrap();
        
        // Match specific supported platforms
        let yt_re = Regex::new(r"(youtube\.com|youtu\.be)").unwrap();
        let tiktok_re = Regex::new(r"tiktok\.com").unwrap();
        let fb_re = Regex::new(r"(facebook\.com|fb\.watch)").unwrap();
        let twitter_re = Regex::new(r"(twitter\.com|x\.com)").unwrap();
        let pin_re = Regex::new(r"pinterest\.com").unwrap();
        let insta_re = Regex::new(r"instagram\.com").unwrap();
        let reddit_re = Regex::new(r"reddit\.com").unwrap();

        loop {
            tokio::time::sleep(Duration::from_millis(800)).await;

            if !enabled.load(Ordering::Relaxed) {
                continue;
            }

            if let Ok(text) = app_handle.clipboard().read_text() {
                let trimmed = text.trim();
                if !trimmed.is_empty() && trimmed != last_clipboard {
                    last_clipboard = trimmed.to_string();

                    if let Some(mat) = url_regex.find(trimmed) {
                        let matched_url = mat.as_str().to_string();

                        let platform = if yt_re.is_match(&matched_url) {
                            "youtube"
                        } else if tiktok_re.is_match(&matched_url) {
                            "tiktok"
                        } else if twitter_re.is_match(&matched_url) {
                            "x"
                        } else if pin_re.is_match(&matched_url) {
                            "pinterest"
                        } else if fb_re.is_match(&matched_url) {
                            "facebook"
                        } else if insta_re.is_match(&matched_url) {
                            "instagram"
                        } else if reddit_re.is_match(&matched_url) {
                            "reddit"
                        } else {
                            "media"
                        };

                        let _ = app_handle.emit(
                            "clipboard-url-detected",
                            serde_json::json!({
                                "url": matched_url,
                                "platform": platform,
                            }),
                        );
                    }
                }
            }
        }
    });
}
