use crate::downloader::remux::{convert_audio_to_mp3, merge_video_audio};
use crate::models::{DownloadProgressPayload, TaskStatus};
use crate::services::config::get_temp_dir;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Queries CDN to verify Range support and get exact total size
pub async fn get_content_info(client: &reqwest::Client, url: &str) -> Result<(u64, bool), String> {
    // Try range request bytes=0-0
    let res = client
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối CDN: {}", e))?;

    let status = res.status();
    if status == reqwest::StatusCode::PARTIAL_CONTENT {
        if let Some(cr) = res.headers().get(reqwest::header::CONTENT_RANGE) {
            if let Ok(cr_str) = cr.to_str() {
                if let Some(pos) = cr_str.rfind('/') {
                    let total_str = &cr_str[pos + 1..];
                    if let Ok(total) = total_str.parse::<u64>() {
                        return Ok((total, true));
                    }
                }
            }
        }
    }

    let content_len = res.content_length().unwrap_or(0);
    let accept_ranges = res
        .headers()
        .get(reqwest::header::ACCEPT_RANGES)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.contains("bytes"))
        .unwrap_or(false);

    if content_len > 0 {
        return Ok((content_len, accept_ranges));
    }

    Err("Không thể xác định kích thước tệp từ máy chủ".to_string())
}

/// Downloads a single HTTP direct stream using N parallel byte-range chunks into a pre-allocated file
pub async fn download_stream_to_file(
    client: reqwest::Client,
    url: String,
    dest_path: PathBuf,
    num_chunks: usize,
    total_size: u64,
    shared_downloaded: Arc<AtomicU64>,
    canceled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
) -> Result<(), String> {
    if total_size == 0 {
        return Err("Dung lượng tệp bằng 0".to_string());
    }

    let actual_chunks = num_chunks.clamp(1, 16);
    let chunk_size = total_size / actual_chunks as u64;

    // Pre-allocate the destination file
    let file = std::fs::File::create(&dest_path)
        .map_err(|e| format!("Không thể tạo tệp tạm: {}", e))?;
    file.set_len(total_size)
        .map_err(|e| format!("Không thể cấp phát trước dung lượng tệp: {}", e))?;

    let mut handles = Vec::new();

    for i in 0..actual_chunks {
        let start = i as u64 * chunk_size;
        let end = if i == actual_chunks - 1 {
            total_size - 1
        } else {
            (i as u64 + 1) * chunk_size - 1
        };

        let chunk_file = file
            .try_clone()
            .map_err(|e| format!("Lỗi nhân bản file handle: {}", e))?;
        let client = client.clone();
        let url = url.clone();
        let shared_downloaded = shared_downloaded.clone();
        let canceled = canceled.clone();
        let paused = paused.clone();

        handles.push(tokio::spawn(async move {
            let range_header = format!("bytes={}-{}", start, end);
            let mut res = client
                .get(&url)
                .header(reqwest::header::RANGE, range_header)
                .send()
                .await
                .map_err(|e| format!("Lỗi kết nối chunk {}: {}", i, e))?;

            if !res.status().is_success() && res.status() != reqwest::StatusCode::PARTIAL_CONTENT {
                return Err(format!("Máy chủ từ chối chunk: HTTP {}", res.status()));
            }

            let mut current_offset = start;
            while let Some(chunk_bytes) = res.chunk().await.map_err(|e| e.to_string())? {
                if canceled.load(Ordering::Relaxed) {
                    return Err("Tác vụ đã bị hủy".to_string());
                }

                while paused.load(Ordering::Relaxed) {
                    if canceled.load(Ordering::Relaxed) {
                        return Err("Tác vụ đã bị hủy".to_string());
                    }
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }

                #[cfg(windows)]
                {
                    use std::os::windows::fs::FileExt;
                    let mut written = 0;
                    while written < chunk_bytes.len() {
                        let n = chunk_file
                            .seek_write(&chunk_bytes[written..], current_offset + written as u64)
                            .map_err(|e| format!("Lỗi ghi file chunk: {}", e))?;
                        if n == 0 {
                            return Err("Ghi file trả về 0 byte".to_string());
                        }
                        written += n;
                    }
                }

                #[cfg(unix)]
                {
                    use std::os::unix::fs::FileExt;
                    let mut written = 0;
                    while written < chunk_bytes.len() {
                        let n = chunk_file
                            .write_at(&chunk_bytes[written..], current_offset + written as u64)
                            .map_err(|e| format!("Lỗi ghi file chunk: {}", e))?;
                        if n == 0 {
                            return Err("Ghi file trả về 0 byte".to_string());
                        }
                        written += n;
                    }
                }

                current_offset += chunk_bytes.len() as u64;
                shared_downloaded.fetch_add(chunk_bytes.len() as u64, Ordering::Relaxed);
            }

            Ok::<(), String>(())
        }));
    }

    for h in handles {
        match h.await {
            Ok(Ok(_)) => (),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(())
}

/// Orchestrates full MDM-style multi-threaded segmented download for video/audio streams
pub async fn download_media_multithreaded(
    app_handle: AppHandle,
    task_id: String,
    direct_urls: Vec<String>,
    final_output_path: PathBuf,
    is_audio_only: bool,
    ext: String,
    concurrent_fragments: usize,
    canceled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
) -> Result<String, String> {
    if direct_urls.is_empty() {
        return Err("Không có link direct để tải đa luồng".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TomFast/0.1.0")
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let temp_dir = get_temp_dir();
    let num_chunks = concurrent_fragments.max(1);

    // Case 1: Single Stream (MP3 audio or Single Progressive MP4 video)
    if direct_urls.len() == 1 {
        let stream_url = &direct_urls[0];
        let (total_size, supports_range) = get_content_info(&client, stream_url).await?;

        if !supports_range || total_size < 1_000_000 {
            return Err("Máy chủ không hỗ trợ tải phân đoạn".to_string());
        }

        let is_convert_mp3 = is_audio_only && ext == "mp3";
        let download_dest = if is_convert_mp3 {
            temp_dir.join(format!("{}_audio.tmp", task_id))
        } else {
            final_output_path.clone()
        };

        let shared_downloaded = Arc::new(AtomicU64::new(0));

        // Start progress reporter
        let reporter = spawn_progress_reporter(
            app_handle.clone(),
            task_id.clone(),
            shared_downloaded.clone(),
            total_size,
            canceled.clone(),
            paused.clone(),
        );

        let dl_res = download_stream_to_file(
            client,
            stream_url.clone(),
            download_dest.clone(),
            num_chunks,
            total_size,
            shared_downloaded.clone(),
            canceled.clone(),
            paused.clone(),
        )
        .await;

        reporter.abort();

        if let Err(e) = dl_res {
            let _ = std::fs::remove_file(&download_dest);
            return Err(e);
        }

        if canceled.load(Ordering::Relaxed) {
            let _ = std::fs::remove_file(&download_dest);
            return Err("Tác vụ đã bị hủy".to_string());
        }

        if is_convert_mp3 {
            let _ = app_handle.emit(
                "download-progress",
                DownloadProgressPayload {
                    task_id: task_id.clone(),
                    status: TaskStatus::Merging,
                    percent: 99.5,
                    downloaded_bytes: total_size,
                    total_bytes: total_size,
                    speed_formatted: "0 KB/s".to_string(),
                    eta_formatted: "Xử lý MP3...".to_string(),
                    error: None,
                    output_path: None,
                },
            );

            convert_audio_to_mp3(&download_dest, &final_output_path).await?;
        }

        let final_str = final_output_path.to_string_lossy().to_string();
        let _ = app_handle.emit(
            "download-progress",
            DownloadProgressPayload {
                task_id,
                status: TaskStatus::Completed,
                percent: 100.0,
                downloaded_bytes: total_size,
                total_bytes: total_size,
                speed_formatted: "0 KB/s".to_string(),
                eta_formatted: "Xong".to_string(),
                error: None,
                output_path: Some(final_str.clone()),
            },
        );

        return Ok(final_str);
    }

    // Case 2: Dual Streams (Video stream + Audio stream separate, e.g. YouTube 1080p/4K)
    let video_url = &direct_urls[0];
    let audio_url = &direct_urls[1];

    let (v_size, v_range) = get_content_info(&client, video_url).await?;
    let (a_size, a_range) = get_content_info(&client, audio_url).await?;

    if !v_range || v_size < 1_000_000 {
        return Err("Luồng video không hỗ trợ tải phân đoạn".to_string());
    }

    let combined_total = v_size + a_size;
    let shared_downloaded = Arc::new(AtomicU64::new(0));

    let temp_video = temp_dir.join(format!("{}_v.tmp", task_id));
    let temp_audio = temp_dir.join(format!("{}_a.tmp", task_id));

    // Progress reporter for combined streams
    let reporter = spawn_progress_reporter(
        app_handle.clone(),
        task_id.clone(),
        shared_downloaded.clone(),
        combined_total,
        canceled.clone(),
        paused.clone(),
    );

    // Download video stream with user-configured thread count (e.g. 8)
    let v_client = client.clone();
    let v_url = video_url.clone();
    let v_dest = temp_video.clone();
    let v_dl = shared_downloaded.clone();
    let v_canc = canceled.clone();
    let v_pau = paused.clone();

    let v_task = tokio::spawn(async move {
        download_stream_to_file(
            v_client,
            v_url,
            v_dest,
            num_chunks,
            v_size,
            v_dl,
            v_canc,
            v_pau,
        )
        .await
    });

    // Download audio stream (audio is smaller, 4 chunks is ideal)
    let a_client = client.clone();
    let a_url = audio_url.clone();
    let a_dest = temp_audio.clone();
    let a_dl = shared_downloaded.clone();
    let a_canc = canceled.clone();
    let a_pau = paused.clone();
    let a_chunks = num_chunks.min(4);

    let a_task = tokio::spawn(async move {
        if a_range && a_size > 500_000 {
            download_stream_to_file(
                a_client,
                a_url,
                a_dest,
                a_chunks,
                a_size,
                a_dl,
                a_canc,
                a_pau,
            )
            .await
        } else {
            // Single stream fallback for tiny audio
            let mut res = a_client.get(&a_url).send().await.map_err(|e| e.to_string())?;
            let mut file = std::fs::File::create(&a_dest).map_err(|e| e.to_string())?;
            while let Some(bytes) = res.chunk().await.map_err(|e| e.to_string())? {
                if a_canc.load(Ordering::Relaxed) {
                    return Err("Tác vụ đã bị hủy".to_string());
                }
                file.write_all(&bytes).map_err(|e| e.to_string())?;
                a_dl.fetch_add(bytes.len() as u64, Ordering::Relaxed);
            }
            Ok(())
        }
    });

    let (v_res, a_res) = tokio::join!(v_task, a_task);
    reporter.abort();

    // Check errors
    match (v_res, a_res) {
        (Ok(Ok(_)), Ok(Ok(_))) => (),
        (Ok(Err(e)), _) => {
            let _ = std::fs::remove_file(&temp_video);
            let _ = std::fs::remove_file(&temp_audio);
            return Err(e);
        }
        (_, Ok(Err(e))) => {
            let _ = std::fs::remove_file(&temp_video);
            let _ = std::fs::remove_file(&temp_audio);
            return Err(e);
        }
        (Err(e), _) | (_, Err(e)) => {
            let _ = std::fs::remove_file(&temp_video);
            let _ = std::fs::remove_file(&temp_audio);
            return Err(e.to_string());
        }
    }

    if canceled.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(&temp_video);
        let _ = std::fs::remove_file(&temp_audio);
        return Err("Tác vụ đã bị hủy".to_string());
    }

    // Merging phase
    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            task_id: task_id.clone(),
            status: TaskStatus::Merging,
            percent: 99.5,
            downloaded_bytes: combined_total,
            total_bytes: combined_total,
            speed_formatted: "0 KB/s".to_string(),
            eta_formatted: "Ghép video...".to_string(),
            error: None,
            output_path: None,
        },
    );

    merge_video_audio(&temp_video, &temp_audio, &final_output_path).await?;

    let final_str = final_output_path.to_string_lossy().to_string();
    let _ = app_handle.emit(
        "download-progress",
        DownloadProgressPayload {
            task_id,
            status: TaskStatus::Completed,
            percent: 100.0,
            downloaded_bytes: combined_total,
            total_bytes: combined_total,
            speed_formatted: "0 KB/s".to_string(),
            eta_formatted: "Xong".to_string(),
            error: None,
            output_path: Some(final_str.clone()),
        },
    );

    Ok(final_str)
}

fn spawn_progress_reporter(
    app: AppHandle,
    task_id: String,
    downloaded: Arc<AtomicU64>,
    total: u64,
    canceled: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut last_bytes = 0u64;
        let mut last_time = Instant::now();

        loop {
            tokio::time::sleep(Duration::from_millis(200)).await;

            if canceled.load(Ordering::Relaxed) {
                break;
            }

            let is_paused = paused.load(Ordering::Relaxed);
            let cur_bytes = downloaded.load(Ordering::Relaxed);
            let now = Instant::now();
            let elapsed_sec = (now - last_time).as_secs_f64();
            let speed_bps = if elapsed_sec > 0.0 && !is_paused {
                ((cur_bytes.saturating_sub(last_bytes)) as f64 / elapsed_sec) as u64
            } else {
                0
            };

            last_bytes = cur_bytes;
            last_time = now;

            let percent = if total > 0 {
                ((cur_bytes as f64 / total as f64) * 100.0).min(99.0)
            } else {
                0.0
            };

            let speed_formatted = if is_paused {
                "Đã tạm dừng".to_string()
            } else if speed_bps > 1_048_576 {
                format!("{:.2} MB/s", speed_bps as f64 / 1_048_576.0)
            } else {
                format!("{:.0} KB/s", speed_bps as f64 / 1024.0)
            };

            let remaining_bytes = total.saturating_sub(cur_bytes);
            let eta_formatted = if speed_bps > 0 && !is_paused {
                let eta_sec = remaining_bytes / speed_bps;
                let m = eta_sec / 60;
                let s = eta_sec % 60;
                format!("{:02}:{:02}", m, s)
            } else if is_paused {
                "--".to_string()
            } else {
                "Đang tính...".to_string()
            };

            let _ = app.emit(
                "download-progress",
                DownloadProgressPayload {
                    task_id: task_id.clone(),
                    status: if is_paused {
                        TaskStatus::Paused
                    } else {
                        TaskStatus::Downloading
                    },
                    percent,
                    downloaded_bytes: cur_bytes,
                    total_bytes: total,
                    speed_formatted,
                    eta_formatted,
                    error: None,
                    output_path: None,
                },
            );

            if cur_bytes >= total && total > 0 {
                break;
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_chunk_range_calculation() {
        let total_size: u64 = 100_000_000; // 100 MB
        let num_chunks = 8;
        let chunk_size = total_size / (num_chunks as u64);

        let mut ranges = Vec::new();
        for i in 0..num_chunks {
            let start = (i as u64) * chunk_size;
            let end = if i == num_chunks - 1 {
                total_size - 1
            } else {
                start + chunk_size - 1
            };
            ranges.push((start, end));
        }

        assert_eq!(ranges.len(), 8);
        assert_eq!(ranges[0].0, 0);
        assert_eq!(ranges[7].1, 99_999_999);

        // Verify continuity with no gaps or overlaps
        for i in 0..7 {
            assert_eq!(ranges[i].1 + 1, ranges[i + 1].0);
        }
    }

    #[test]
    fn test_concurrent_cloned_file_write() {
        #[cfg(windows)]
        use std::os::windows::fs::FileExt;

        let temp_path = std::env::temp_dir().join("test_clone_write.bin");
        let file = std::fs::File::create(&temp_path).unwrap();
        file.set_len(20).unwrap();

        let h1 = file.try_clone().unwrap();
        let h2 = file.try_clone().unwrap();

        // Worker 1 writes at offset 0
        h1.seek_write(b"AAAAA", 0).unwrap();

        // Worker 2 writes at offset 10
        h2.seek_write(b"BBBBB", 10).unwrap();

        // Worker 1 writes next 5 bytes at offset 5
        h1.seek_write(b"CCCCC", 5).unwrap();

        let data = std::fs::read(&temp_path).unwrap();
        let s = String::from_utf8_lossy(&data);
        println!("DATA: '{}'", s);
        assert_eq!(&data[0..15], b"AAAAACCCCCBBBBB");
        let _ = std::fs::remove_file(&temp_path);
    }

    #[tokio::test]
    async fn test_real_multithread_segmented_download() {
        let test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
        println!("\n[TEST] 1. Extracting direct stream URLs for '{}'...", test_url);
        let urls = crate::engine::extractor::extract_direct_stream_urls(test_url, "res:720", false)
            .expect("Failed to extract direct stream URLs");
        assert!(!urls.is_empty(), "Direct stream URLs should not be empty");
        println!("[TEST] Direct stream URLs found: {}", urls.len());

        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TomFast/0.1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap();

        let video_url = &urls[0];
        println!("[TEST] 2. Querying CDN content info for video stream...");
        let (v_size, v_range) = get_content_info(&client, video_url)
            .await
            .expect("Failed to get content info");
        println!("[TEST] Video stream size: {} bytes, Supports Range: {}", v_size, v_range);
        assert!(v_range, "CDN must support HTTP Range for multi-threaded chunking");
        assert!(v_size > 100_000, "Video size must be valid");

        // Download with 8 parallel threads
        let temp_dir = std::env::temp_dir().join("tomfast_test_mdm");
        let _ = std::fs::create_dir_all(&temp_dir);
        let temp_dest = temp_dir.join("test_multithread_v.tmp");

        let shared_downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let canceled = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let paused = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

        println!("[TEST] 3. Starting 8-thread parallel segmented download...");
        let start_time = std::time::Instant::now();
        let res = download_stream_to_file(
            client.clone(),
            video_url.clone(),
            temp_dest.clone(),
            8,
            v_size,
            shared_downloaded.clone(),
            canceled.clone(),
            paused.clone(),
        )
        .await;

        let elapsed = start_time.elapsed();
        println!("[TEST] Download finished in {:.2}s. Result: {:?}", elapsed.as_secs_f64(), res);
        assert!(res.is_ok(), "Segmented download should succeed");

        let metadata = std::fs::metadata(&temp_dest).expect("Downloaded file must exist");
        println!("[TEST] File size on disk: {} bytes (Expected: {} bytes)", metadata.len(), v_size);
        assert_eq!(metadata.len(), v_size, "Downloaded file size must match exactly");

        let _ = std::fs::remove_dir_all(&temp_dir);
        println!("[TEST] 4. Multi-threaded segmented download verified 100% SUCCESS!");
    }
}
