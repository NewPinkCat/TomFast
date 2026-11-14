use crate::engine::updater::get_ffmpeg_path;
use std::path::Path;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub async fn merge_video_audio(
    video_path: &Path,
    audio_path: &Path,
    output_path: &Path,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path();
    let v_str = video_path.to_string_lossy().to_string();
    let a_str = audio_path.to_string_lossy().to_string();
    let o_str = output_path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&ffmpeg_path);
        cmd.args([
            "-y",
            "-i",
            &v_str,
            "-i",
            &a_str,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            &o_str,
        ]);

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| format!("Không thể chạy FFmpeg: {}", e))?;
        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Lỗi ghép video/audio bằng FFmpeg: {}", err_msg.trim()));
        }

        // Clean up temporary segment files after successful muxing
        let _ = std::fs::remove_file(&v_str);
        let _ = std::fs::remove_file(&a_str);

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Lỗi luồng ghép video: {}", e))?
}

pub async fn convert_audio_to_mp3(
    input_path: &Path,
    output_path: &Path,
) -> Result<(), String> {
    let ffmpeg_path = get_ffmpeg_path();
    let in_str = input_path.to_string_lossy().to_string();
    let out_str = output_path.to_string_lossy().to_string();

    tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&ffmpeg_path);
        cmd.args([
            "-y",
            "-i",
            &in_str,
            "-vn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "320k",
            &out_str,
        ]);

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| format!("Không thể chạy FFmpeg: {}", e))?;
        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Lỗi chuyển đổi MP3 bằng FFmpeg: {}", err_msg.trim()));
        }

        let _ = std::fs::remove_file(&in_str);
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Lỗi luồng chuyển đổi âm thanh: {}", e))?
}
