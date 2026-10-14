export type PresetMediaType = "video_with_audio" | "audio_only";

export type MaxResolution =
  | "best"
  | "2160p"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "360p";

export type PreferredFrameRate = "any" | "30" | "60";

export type ContainerPreference = "auto" | "mp4" | "mkv" | "webm";

export type VideoCodecPreference = "auto" | "h264" | "h265" | "vp9" | "av1";

export type AudioCodecPreference = "auto" | "aac" | "opus" | "vorbis";

export type AudioOutputFormat = "source" | "mp3" | "m4a" | "opus" | "wav" | "flac";

export type AudioBitrate = "auto" | "320k" | "256k" | "192k" | "128k" | "96k";

export type FilenameCollisionPolicy = "rename" | "overwrite" | "skip";

export type FolderRule = "none" | "media_type" | "playlist" | "uploader" | "date";

export interface DownloadPreset {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  mediaType: PresetMediaType;
  maxResolution?: MaxResolution | null;
  preferredFrameRate?: PreferredFrameRate | null;
  containerPreference?: ContainerPreference | null;
  videoCodecPreference?: VideoCodecPreference | null;
  audioCodecPreference?: AudioCodecPreference | null;
  audioOutputFormat?: AudioOutputFormat | null;
  audioBitrate?: AudioBitrate | null;
  filenameTemplate?: string | null;
  outputFolderRule?: FolderRule | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadSettings {
  defaultPresetId: string;
  defaultOutputDirectory: string;
  askBeforeDownload: boolean;
  filenameCollisionPolicy: FilenameCollisionPolicy;
  defaultMaxResolution: MaxResolution;
  defaultFrameRate: PreferredFrameRate;
  defaultContainer: ContainerPreference;
  defaultVideoCodec: VideoCodecPreference;
  defaultAudioCodec: AudioCodecPreference;
  defaultAudioFormat: AudioOutputFormat;
  defaultAudioBitrate: AudioBitrate;
  defaultFilenameTemplate: string;
  videoSubfolder?: string | null;
  audioSubfolder?: string | null;
  playlistSubfolder: boolean;
  uploaderSubfolder: boolean;
  dateSubfolder: boolean;
}

export interface DownloadSettingsSnapshot {
  presetId: string;
  presetName: string;
  mediaType: PresetMediaType;
  maxResolution?: MaxResolution | null;
  preferredFrameRate?: PreferredFrameRate | null;
  containerPreference?: ContainerPreference | null;
  videoCodecPreference?: VideoCodecPreference | null;
  audioCodecPreference?: AudioCodecPreference | null;
  audioOutputFormat?: AudioOutputFormat | null;
  audioBitrate?: AudioBitrate | null;
  filenameTemplate?: string | null;
  outputFolderRule?: FolderRule | null;
  outputDirectory: string;
  filenameCollisionPolicy: FilenameCollisionPolicy;
  hasOverrides: boolean;
}

export interface SettingsValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  ffmpegRequired: boolean;
  ffmpegAvailable: boolean;
  resolvedFormatString?: string | null;
}

export interface TemplateToken {
  token: string;
  label: string;
  example: string;
}

export const TEMPLATE_TOKENS: TemplateToken[] = [
  { token: "%(title)s", label: "Title", example: "Big Buck Bunny" },
  { token: "%(title).150B", label: "Title (Max 150 chars)", example: "Big Buck Bunny" },
  { token: "%(id)s", label: "ID", example: "aqz-KE-bpKQ" },
  { token: "%(uploader)s", label: "Uploader", example: "Blender Studio" },
  { token: "%(channel)s", label: "Channel", example: "Blender" },
  { token: "%(upload_date)s", label: "Upload Date", example: "20240101" },
  { token: "%(resolution)s", label: "Resolution", example: "1080p" },
  { token: "%(playlist_title)s", label: "Playlist Title", example: "Open Movies" },
  { token: "%(playlist_index)s", label: "Playlist Index", example: "01" },
  { token: "%(ext)s", label: "Extension", example: "mp4" },
];
