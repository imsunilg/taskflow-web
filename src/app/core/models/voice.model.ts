import { Priority } from './task.model';

export type VoiceState =
  | 'idle'
  | 'permission'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'processing'
  | 'transcribing'
  | 'completed'
  | 'failed'
  | 'unavailable'
  | 'disabled';

export type VoiceMode = 'Browser' | 'Cloud' | 'Disabled';

export interface VoiceConfig {
  /** Active server-side transcription strategy. */
  mode: VoiceMode;
  /** For Cloud mode: whether Endpoint + ApiKey are configured on the server. */
  cloudReady: boolean;
  maxAudioBytes: number;
  allowedMimeTypes: string[];
}

export interface VoiceRecording {
  id: string;
  taskId: string | null;
  userId: string;
  audioUrl: string | null;
  durationSeconds: number;
  createdAt: string;
}

export interface Transcription {
  id: string;
  voiceRecordingId: string;
  rawText: string;
  provider: string;
  extractedJson: string;
  createdAt: string;
}

export interface ExtractedFields {
  title: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority | null;
  reminderOffsetMinutes: number | null;
}

export interface TranscriptionResult {
  rawText: string;
  extractedFields: ExtractedFields;
}
