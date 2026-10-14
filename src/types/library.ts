export type FileAvailability = "available" | "missing" | "inaccessible" | "unknown";

export interface MediaLibraryItem {
  id: string;
  title: string;
  sourceUrl: string;
  uploader?: string | null;
  thumbnailUrl?: string | null;
  mediaType: "video" | "audio";
  formatLabel: string;
  fileExtension?: string | null;
  outputPath?: string | null;
  fileSizeBytes?: number | null;
  duration?: number | null;
  status: "completed" | "failed" | "cancelled" | string;
  createdAt: string;
  completedAt?: string | null;
  lastError?: string | null;
  attemptCount: number;
  fileAvailability: FileAvailability;
  lastVerifiedAt?: string | null;
}

export interface MediaLibraryFilter {
  searchQuery?: string;
  status?: "all" | "completed" | "failed" | "cancelled" | string;
  mediaType?: "all" | "video" | "audio" | string;
  availability?: "all" | "available" | "missing" | "inaccessible" | "unknown" | string;
  sortBy?: "newest" | "oldest" | "title" | "file_size" | string;
  page?: number;
  pageSize?: number;
}

export interface MediaLibrarySummary {
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  totalLibraryBytes: number;
}

export interface MediaLibraryResponse {
  items: MediaLibraryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: MediaLibrarySummary;
}
