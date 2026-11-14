use crate::services::config::get_config_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SavedLink {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub platform: String,
    pub quality_label: String,
    pub file_path: String,
    pub saved_at: i64,
}

pub struct SavedLinksService;

impl SavedLinksService {
    pub fn get_file_path() -> PathBuf {
        get_config_dir().join("saved_links.json")
    }

    pub fn get_saved_links() -> Vec<SavedLink> {
        let path = Self::get_file_path();
        if !path.exists() {
            return Vec::new();
        }

        fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<Vec<SavedLink>>(&content).ok())
            .unwrap_or_default()
    }

    pub fn save_completed_link(link: SavedLink) -> bool {
        let mut links = Self::get_saved_links();

        // If URL already exists in saved list, remove previous duplicate
        links.retain(|item| item.url.trim() != link.url.trim());

        // Place newly completed link at the top
        links.insert(0, link);

        let path = Self::get_file_path();
        if let Ok(json_str) = serde_json::to_string_pretty(&links) {
            fs::write(path, json_str).is_ok()
        } else {
            false
        }
    }

    pub fn delete_saved_link(id: &str) -> bool {
        let mut links = Self::get_saved_links();
        let initial_len = links.len();
        links.retain(|item| item.id != id);

        if links.len() != initial_len {
            let path = Self::get_file_path();
            if let Ok(json_str) = serde_json::to_string_pretty(&links) {
                return fs::write(path, json_str).is_ok();
            }
        }
        true
    }

    pub fn clear_all_saved_links() -> bool {
        let path = Self::get_file_path();
        if let Ok(json_str) = serde_json::to_string_pretty(&Vec::<SavedLink>::new()) {
            fs::write(path, json_str).is_ok()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_saved_link_serialization() {
        let link = SavedLink {
            id: "test-uuid-123".to_string(),
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string(),
            title: "Rick Astley - Never Gonna Give You Up".to_string(),
            thumbnail: Some("https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg".to_string()),
            platform: "YouTube".to_string(),
            quality_label: "1080p Full HD".to_string(),
            file_path: r"D:\Artificial Intelligence\Data\TomFast\downloads\Rick.mp4".to_string(),
            saved_at: 1700000000,
        };

        let json = serde_json::to_string(&link).expect("Serialize SavedLink");
        let parsed: SavedLink = serde_json::from_str(&json).expect("Deserialize SavedLink");
        assert_eq!(link, parsed);
    }

    #[test]
    fn test_saved_link_deduplication_logic() {
        let mut links = vec![
            SavedLink {
                id: "id-1".to_string(),
                url: "https://youtube.com/watch?v=111".to_string(),
                title: "Old Video".to_string(),
                thumbnail: None,
                platform: "YouTube".to_string(),
                quality_label: "720p".to_string(),
                file_path: "D:\\video1.mp4".to_string(),
                saved_at: 1000,
            }
        ];

        let new_link = SavedLink {
            id: "id-2".to_string(),
            url: "https://youtube.com/watch?v=111".to_string(),
            title: "Updated Video".to_string(),
            thumbnail: None,
            platform: "YouTube".to_string(),
            quality_label: "1080p".to_string(),
            file_path: "D:\\video1_1080p.mp4".to_string(),
            saved_at: 2000,
        };

        links.retain(|item| item.url.trim() != new_link.url.trim());
        links.insert(0, new_link.clone());

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].title, "Updated Video");
        assert_eq!(links[0].quality_label, "1080p");
    }
}
