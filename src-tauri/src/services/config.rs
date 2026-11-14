use crate::models::{AppConfig, DownloadTask};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub fn get_data_root() -> PathBuf {
    let custom = PathBuf::from(r"D:\Artificial Intelligence\Data\TomFast");
    if let Some(parent) = custom.parent() {
        if parent.exists() {
            let _ = fs::create_dir_all(&custom);
            return custom;
        }
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("TomFast")
}

pub fn get_bin_dir() -> PathBuf {
    let dir = get_data_root().join("bin");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_downloads_dir() -> PathBuf {
    let dir = get_data_root().join("downloads");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_config_dir() -> PathBuf {
    let dir = get_data_root().join("config");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn get_temp_dir() -> PathBuf {
    let dir = get_data_root().join("temp");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[derive(Clone)]
pub struct ConfigService {
    config: Arc<Mutex<AppConfig>>,
}

impl ConfigService {
    pub fn new() -> Self {
        let config_path = get_config_dir().join("config.json");
        let initial_config = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|data| serde_json::from_str::<AppConfig>(&data).ok())
                .unwrap_or_else(|| {
                    let c = AppConfig::default();
                    let _ = fs::write(&config_path, serde_json::to_string_pretty(&c).unwrap_or_default());
                    c
                })
        } else {
            let c = AppConfig::default();
            let _ = fs::write(&config_path, serde_json::to_string_pretty(&c).unwrap_or_default());
            c
        };

        Self {
            config: Arc::new(Mutex::new(initial_config)),
        }
    }

    pub fn get_config(&self) -> AppConfig {
        self.config.lock().unwrap().clone()
    }

    pub fn save_config(&self, new_config: AppConfig) -> Result<(), String> {
        let mut cfg = self.config.lock().unwrap();
        *cfg = new_config.clone();
        let config_path = get_config_dir().join("config.json");
        let json = serde_json::to_string_pretty(&new_config).map_err(|e| e.to_string())?;
        fs::write(config_path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_history(tasks: &[DownloadTask]) {
        let path = get_config_dir().join("history.json");
        if let Ok(json) = serde_json::to_string_pretty(tasks) {
            let _ = fs::write(path, json);
        }
    }

    pub fn load_history() -> Vec<DownloadTask> {
        let path = get_config_dir().join("history.json");
        if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .and_then(|data| serde_json::from_str::<Vec<DownloadTask>>(&data).ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_paths_on_d_drive() {
        let root = get_data_root();
        assert!(root.to_string_lossy().contains(r"D:\Artificial Intelligence\Data\TomFast"));
        assert!(get_bin_dir().exists());
        assert!(get_downloads_dir().exists());
        assert!(get_config_dir().exists());
    }

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert!(config.download_dir.contains(r"D:\Artificial Intelligence\Data\TomFast\downloads"));
        assert_eq!(config.max_concurrent_downloads, 3);
        assert!(config.auto_clipboard_detect);
    }
}
