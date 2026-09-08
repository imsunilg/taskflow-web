import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { ApiResponse } from '../../core/models/api.models';
import { TranscriptionResult, VoiceConfig } from '../../core/models/voice.model';
import { ApiService } from '../../core/services/api.service';

const FALLBACK_CONFIG: VoiceConfig = {
  mode: 'Browser',
  cloudReady: false,
  maxAudioBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ['audio/webm'],
};

@Injectable({ providedIn: 'root' })
export class VoiceApiService {
  private readonly api = inject(ApiService);

  private config$?: Observable<VoiceConfig>;

  /**
   * Active transcription mode (secret-free). Cached for the session. If the config
   * endpoint is unreachable we assume Browser mode rather than blocking the modal.
   */
  getConfig(): Observable<VoiceConfig> {
    this.config$ ??= this.api.get<VoiceConfig>('/voice/config').pipe(
      map((res) => res.data ?? FALLBACK_CONFIG),
      catchError(() => of(FALLBACK_CONFIG)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.config$;
  }

  transcribe(audio: Blob, filename = 'recording.webm'): Observable<ApiResponse<TranscriptionResult>> {
    const form = new FormData();
    form.append('audio', audio, filename);
    return this.api.postForm<TranscriptionResult>('/voice/transcribe', form);
  }

  reextract(text: string): Observable<ApiResponse<TranscriptionResult>> {
    const form = new FormData();
    form.append('text', text);
    return this.api.postForm<TranscriptionResult>('/voice/transcribe', form);
  }
}
