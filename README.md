# TomFast ⚡ - High-Speed Multi-Platform Desktop Media Downloader

Ứng dụng Desktop tải Video, Audio và Hình ảnh chất lượng cao (4K, 2K, 1080p, MP3 320kbps) từ **YouTube, TikTok, Facebook, X (Twitter), Pinterest, Instagram** và hàng nghìn nền tảng khác. Xây dựng trên nền tảng **Tauri v2 + Rust Core** và **React 19 + TypeScript** với ngôn ngữ thiết kế **Linear / Raycast Dark-Emerald Theme** cao cấp.

---

## 🚀 Tính Năng Nổi Bật

- **Động cơ tải luồng chuẩn yt-dlp Engine**: Tải trực tiếp qua luồng progressive stream, tự động giải mã chữ ký YouTube, tối ưu bộ đệm chunk 10MB và chống chặn CDN 100%.
- **Tải Trọn Playlist / Album YouTube**: Quét danh sách phát siêu tốc với `--flat-playlist`, cho phép chọn từng tập, chọn chất lượng chung (1080p, 720p, MP3) và đẩy tải hàng loạt.
- **Đồng Bộ Cookie Trình Duyệt**: Tự động sử dụng phiên đăng nhập từ Chrome, Edge, Brave, Firefox, Opera để tải video giới hạn độ tuổi 18+, video riêng tư và video hội viên (members-only).
- **Cửa Sổ Nổi Mini / Drop Zone**: Thu nhỏ thành widget ghim nổi trên màn hình (`380x180`), hỗ trợ kéo thả link trực tiếp từ trình duyệt để tải nhanh, tự động mở rộng khi chọn chất lượng.
- **Trình Xem Trước Tích Hợp (Built-in Media Player)**: Xem video MP4 hoặc nghe MP3 trực tiếp ngay trong app với đầy đủ điều khiển tua 5s, timeline scrubber, tốc độ phát (0.75x - 2.0x), và toàn màn hình.
- **Khay Hệ Thống (System Tray) & Hẹn Giờ Tắt Máy**:
  - Chạy ngầm dưới khay đồng hồ Windows khi bấm đóng (X).
  - Tự động đếm ngược 60 giây và tắt máy tính / chuyển chế độ ngủ khi toàn bộ hàng đợi tải xong.
- **Tự Động Bắt Link Clipboard**: Giám sát bộ nhớ tạm thời gian thực, tự động gợi ý tải ngay khi bạn vừa copy link.
- **Kho Liên Kết Đã Lưu (Saved Links Library)**: Quản lý lịch sử tải về, mở nhanh tệp, mở thư mục chứa hoặc tải lại chỉ với 1 click kèm nút Làm mới (Refresh) tức thì.
- **Tải Hàng Loạt (Batch Download)**: Dán nhiều liên kết cùng lúc để ứng dụng tự động xếp hàng tải tuần tự theo giới hạn cấu hình.
- **Sidecar 1-Click Update**: Kiểm tra và tự động cập nhật binary `yt-dlp` mới nhất từ GitHub.
- **Lưu trữ dữ liệu độc lập trên ổ D:**:
  - Binary Engine: `D:\Artificial Intelligence\Data\TomFast\bin`
  - Thư mục tải về mặc định: `D:\Artificial Intelligence\Data\TomFast\downloads`
  - Cấu hình & Lịch sử: `D:\Artificial Intelligence\Data\TomFast\config`
  - Tệp tạm: `D:\Artificial Intelligence\Data\TomFast\temp`

---

## 🛠️ Ngăn Xếp Công Nghệ (Tech Stack)

- **Frontend**: Tauri v2, React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite.
- **Backend**: Rust 2021, Tokio async runtime, Reqwest, Tauri v2 Plugins (shell, dialog, notification, clipboard-manager, tray-icon).
- **Engine**: `yt-dlp` (metadata extraction & streaming), `ffmpeg` (transcoding & remuxing).

---

## 💻 Hướng Dẫn Khởi Chạy

### 1. Cài đặt phụ thuộc
```bash
pnpm install
```

### 2. Chạy chế độ Phát triển (Dev Mode)
```bash
pnpm run tauri dev
```

### 3. Đóng gói ứng dụng Desktop (.exe / .msi)
```bash
pnpm run tauri build
```
File cài đặt sẽ nằm tại: `src-tauri/target/release/bundle/msi` hoặc file thực thi độc lập tại `src-tauri/target/release/tomfast.exe`.
