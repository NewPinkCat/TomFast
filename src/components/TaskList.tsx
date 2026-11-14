import React, { useState } from 'react';
import { DownloadTask, SavedLink } from '../types/media';
import { TaskItem } from './TaskItem';
import { SavedLinksList } from './SavedLinksList';
import { Trash2, Search, Inbox } from 'lucide-react';

interface TaskListProps {
  tasks: DownloadTask[];
  savedLinks: SavedLink[];
  activeTab: 'all' | 'downloading' | 'completed' | 'saved_links';
  onCancel: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onClearCompleted: () => void;
  onDeleteSavedLink: (id: string) => void;
  onClearAllSavedLinks: () => void;
  onRedownload: (url: string) => void;
  onPlayMedia?: (task: DownloadTask) => void;
  onRefreshSavedLinks?: () => void;
  isRefreshingSavedLinks?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  savedLinks,
  activeTab,
  onCancel,
  onPause,
  onResume,
  onOpenFile,
  onOpenFolder,
  onClearCompleted,
  onDeleteSavedLink,
  onClearAllSavedLinks,
  onRedownload,
  onPlayMedia,
  onRefreshSavedLinks,
  isRefreshingSavedLinks,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // If active tab is saved links, delegate to SavedLinksList
  if (activeTab === 'saved_links') {
    return (
      <SavedLinksList
        links={savedLinks}
        onDelete={onDeleteSavedLink}
        onClearAll={onClearAllSavedLinks}
        onRedownload={onRedownload}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onRefresh={onRefreshSavedLinks}
        isRefreshing={isRefreshingSavedLinks}
        onPlayMedia={onPlayMedia ? (title, path) => onPlayMedia({ id: '', url: '', title, output_path: path, status: 'completed', progress_percent: 100, downloaded_bytes: 0, total_bytes: 0, speed_bytes_per_sec: 0, speed_formatted: '', eta_formatted: '', created_at: 0, platform: '', selected_format_id: '', quality_label: '', ext: path.split('.').pop() || 'mp4', is_audio_only: path.endsWith('.mp3') }) : undefined}
      />
    );
  }

  const filteredTasks = tasks
    .filter((t) => {
      if (activeTab === 'downloading') {
        return (
          t.status === 'downloading' ||
          t.status === 'merging' ||
          t.status === 'pending' ||
          t.status === 'paused'
        );
      }
      if (activeTab === 'completed') {
        return t.status === 'completed';
      }
      return true;
    })
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.url.toLowerCase().includes(q) ||
        t.platform.toLowerCase().includes(q)
      );
    });

  const completedCount = tasks.filter((t) => t.status === 'completed' || t.status === 'canceled').length;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'downloading':
        return 'Tác vụ đang tải';
      case 'completed':
        return 'Tác vụ đã hoàn thành';
      default:
        return 'Tất cả tác vụ';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* List Toolbar */}
      <div className="px-6 py-3 border-b border-[#242429] flex items-center justify-between gap-4 bg-[#0c0c0e]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-100">{getTabTitle()}</h2>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded border border-zinc-700/40">
            {filteredTasks.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick search inside tasks */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tác vụ..."
              className="bg-[#141418] border border-[#27272e] rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-44 sm:w-56 transition"
            />
          </div>

          {/* Clear completed button */}
          {completedCount > 0 && (
            <button
              onClick={onClearCompleted}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-[#141418] hover:bg-[#1c1c22] border border-[#27272e] rounded-lg transition"
              title="Xóa danh sách các tác vụ đã hoàn tất hoặc đã hủy"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dọn dẹp</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Items List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onCancel={onCancel}
              onPause={onPause}
              onResume={onResume}
              onOpenFile={onOpenFile}
              onOpenFolder={onOpenFolder}
              onRedownload={onRedownload}
              onPlayMedia={onPlayMedia}
            />
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-[#242429]">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">
              {searchQuery ? 'Không tìm thấy tác vụ phù hợp' : 'Chưa có tác vụ tải nào'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm">
              {searchQuery
                ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc'
                : 'Dán liên kết từ YouTube, TikTok, Facebook... vào thanh phía trên và nhấn [Lấy link] để bắt đầu.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
