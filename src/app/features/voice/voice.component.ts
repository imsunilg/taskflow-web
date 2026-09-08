import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { VoiceApiService } from './voice-api.service';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import {
  SpeechRecognitionError,
  SpeechRecognitionService,
} from '../../core/services/speech-recognition.service';
import { NormalizedApiError } from '../../core/interceptors/error.interceptor';
import { ExtractedFields, VoiceMode, VoiceState } from '../../core/models/voice.model';
import { IconComponent } from '../../shared/components/icon/icon.component';

/**
 * The capture flow is decided by GET /api/voice/config BEFORE recording starts:
 *  - Browser : transcribe locally with the Web Speech API. Never uploads audio.
 *  - Cloud   : record with MediaRecorder, upload once to /api/voice/transcribe.
 *  - Disabled / Cloud-not-ready : show a "type instead" state, never record.
 * MediaRecorder / speech-recognition lifecycles are driven only by the user's
 * Stop / Cancel actions and a documented hard cap.
 */
const MAX_RECORDING_SECONDS = 120;
const TIMESLICE_MS = 1000;
const BAR_COUNT = 14;

@Component({
  selector: 'tf-voice',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="voice-state" role="group" aria-live="polite">
      @switch (state()) {
        @case ('idle') {
          <button type="button" class="voice-mic-ring" (click)="start()" aria-label="Start recording">
            <tf-icon name="mic" [size]="34" />
          </button>
          <div class="voice-title">Tap to speak</div>
          <div class="voice-subtitle">
            @if (mode() === 'Browser') {
              Your words are transcribed privately in this browser.
            } @else {
              Say something like "Remind me to call Priya tomorrow at 5 PM, high priority."
            }
          </div>
          <button class="text-btn" type="button" (click)="fallbackToTyping()">Type instead</button>
        }
        @case ('disabled') {
          <div class="voice-icon-wrap is-muted"><tf-icon name="mic-off" [size]="26" /></div>
          <div class="voice-title">{{ failTitle() }}</div>
          <div class="voice-subtitle">{{ errorText() }}</div>
          <div class="voice-controls">
            <button class="btn btn-accent" type="button" (click)="fallbackToTyping()">Type instead</button>
          </div>
        }
        @case ('permission') {
          <div class="voice-icon-wrap is-muted"><tf-icon name="mic-off" [size]="28" /></div>
          <div class="voice-title">Microphone access needed</div>
          <div class="voice-subtitle">
            {{ errorText() || "Allow microphone access in your browser's site settings, then retry." }}
          </div>
          <div class="voice-controls">
            <button class="btn btn-ghost" type="button" (click)="fallbackToTyping()">Type instead</button>
            <button class="btn btn-accent" type="button" (click)="start()">Retry</button>
          </div>
        }
        @case ('unavailable') {
          <div class="voice-icon-wrap is-muted"><tf-icon name="mic-off" [size]="26" /></div>
          <div class="voice-title">Microphone unavailable</div>
          <div class="voice-subtitle">
            {{ errorText() || 'No microphone was detected on this device. You can still type your task.' }}
          </div>
          <div class="voice-controls">
            <button class="btn btn-accent" type="button" (click)="fallbackToTyping()">Type instead</button>
          </div>
        }
        @case ('recording') {
          <button type="button" class="voice-mic-ring is-recording" (click)="stop()" aria-label="Stop recording">
            <tf-icon name="stop" [size]="30" />
          </button>
          <div class="voice-timer" [class.warn]="remaining() <= 10">
            {{ mmss(elapsed()) }}
            @if (remaining() <= 10) { <span> · auto-stops in {{ remaining() }}s</span> }
          </div>
          @if (mode() === 'Browser') {
            <div class="voice-live-transcript" aria-live="polite">
              <span class="live-final">{{ liveFinal() }}</span>
              <span class="live-interim">{{ liveFinal() ? ' ' : '' }}{{ liveInterim() }}</span>
              @if (!liveFinal() && !liveInterim()) { <span class="muted">Listening…</span> }
            </div>
          } @else {
            <div class="waveform" aria-hidden="true">
              @for (h of bars(); track $index) { <span [style.height.%]="h"></span> }
            </div>
          }
          <div class="voice-controls">
            @if (mode() === 'Cloud') {
              <button class="voice-round-btn" type="button" (click)="pause()" aria-label="Pause">
                <tf-icon name="pause" [size]="18" />
              </button>
            }
            <button class="voice-round-btn is-stop" type="button" (click)="stop()" aria-label="Stop">
              <tf-icon name="stop" [size]="18" />
            </button>
          </div>
        }
        @case ('paused') {
          <div class="voice-icon-wrap"><tf-icon name="pause" [size]="26" /></div>
          <div class="voice-timer" style="color:var(--text-secondary)">{{ mmss(elapsed()) }}</div>
          <div class="voice-subtitle">Recording paused</div>
          <div class="voice-controls">
            <button class="voice-round-btn" type="button" (click)="resume()" aria-label="Resume">
              <tf-icon name="play" [size]="18" />
            </button>
            <button class="voice-round-btn is-stop" type="button" (click)="stop()" aria-label="Stop">
              <tf-icon name="stop" [size]="18" />
            </button>
          </div>
        }
        @case ('processing') {
          <div class="voice-spinner"></div>
          <div class="voice-title">Processing your recording</div>
        }
        @case ('transcribing') {
          <div class="voice-spinner"></div>
          <div class="voice-title">Transcribing…</div>
        }
        @case ('completed') {
          <div class="voice-transcript-view">
            <div class="voice-title" style="text-align:left">Transcription</div>
            <textarea [(ngModel)]="transcript" (blur)="reextract()" aria-label="Transcript"></textarea>
            <div class="voice-subtitle" style="text-align:left;margin-bottom:8px">
              Extracted details — review before saving
            </div>
            <div class="extracted-grid">
              <div class="extracted-field"><div class="extracted-label">Task</div><div class="extracted-value">{{ fields()?.title || '—' }}</div></div>
              <div class="extracted-field"><div class="extracted-label">Priority</div><div class="extracted-value">{{ fields()?.priority || '—' }}</div></div>
              <div class="extracted-field"><div class="extracted-label">Date</div><div class="extracted-value">{{ fields()?.dueDate || '—' }}</div></div>
              <div class="extracted-field"><div class="extracted-label">Time</div><div class="extracted-value">{{ fields()?.dueTime || '—' }}</div></div>
              <div class="extracted-field" style="grid-column:1/-1">
                <div class="extracted-label">Reminder</div><div class="extracted-value">{{ reminderText() }}</div>
              </div>
            </div>
            <div class="voice-actions">
              <button class="btn btn-ghost" type="button" (click)="close()">Cancel</button>
              <button class="btn btn-outline" type="button" (click)="reextract()">Re-extract</button>
              <button class="btn btn-accent" type="button" [disabled]="creating()" (click)="createTask()">
                {{ creating() ? 'Creating…' : 'Create task' }}
              </button>
            </div>
          </div>
        }
        @case ('failed') {
          <div class="voice-icon-wrap"><tf-icon name="alert" [size]="26" /></div>
          <div class="voice-title">{{ failTitle() }}</div>
          <div class="voice-subtitle">{{ errorText() }}</div>
          <div class="voice-controls">
            <button class="btn btn-ghost" type="button" (click)="fallbackToTyping()">Type instead</button>
            <button class="btn btn-accent" type="button" (click)="retry()">Try again</button>
          </div>
        }
      }
    </div>
  `,
})
export class VoiceComponent implements OnInit, OnDestroy {
  private readonly voiceApi = inject(VoiceApiService);
  private readonly store = inject(TaskStore);
  private readonly ui = inject(UiStateService);
  private readonly speech = inject(SpeechRecognitionService);
  private readonly isDev = isDevMode();

  readonly state = signal<VoiceState>('idle');
  readonly mode = signal<VoiceMode>('Browser');
  readonly elapsed = signal(0);
  readonly fields = signal<ExtractedFields | null>(null);
  readonly bars = signal<number[]>(new Array(BAR_COUNT).fill(8));
  readonly errorText = signal('');
  readonly failTitle = signal('Transcription failed');
  readonly liveFinal = signal('');
  readonly liveInterim = signal('');
  readonly creating = signal(false);
  transcript = '';

  private configLoaded = false;
  private cloudReady = false;
  private maxUploadBytes = 10 * 1024 * 1024;

  readonly remaining = computed(() => Math.max(0, MAX_RECORDING_SECONDS - this.elapsed()));
  readonly reminderText = computed(() => {
    const m = this.fields()?.reminderOffsetMinutes;
    if (m === null || m === undefined) return '—';
    if (m === 0) return 'At due time';
    if (m % 1440 === 0) return `${m / 1440} day(s) before`;
    if (m % 60 === 0) return `${m / 60} hour(s) before`;
    return `${m} minutes before`;
  });

  private sessionId = 0;
  private uploading = false;

  private recorder?: MediaRecorder;
  private recorderMime = '';
  private chunks: Blob[] = [];
  private stream?: MediaStream;
  private timer?: ReturnType<typeof setInterval>;
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private rafId?: number;
  private trackEndedHandler?: () => void;
  private speechSub?: Subscription;

  // --- Config -----------------------------------------------------------

  ngOnInit(): void {
    this.voiceApi.getConfig().subscribe((cfg) => {
      this.mode.set(cfg.mode);
      this.cloudReady = cfg.cloudReady;
      this.maxUploadBytes = cfg.maxAudioBytes || this.maxUploadBytes;
      this.configLoaded = true;
      this.applyInitialState();
    });
  }

  private applyInitialState(): void {
    if (this.state() !== 'idle' && this.state() !== 'disabled') return; // a session is in progress

    if (this.mode() === 'Disabled') {
      this.showDisabled(
        'Voice capture is turned off',
        'Voice transcription is disabled in this environment. You can type your task instead.',
      );
      return;
    }
    if (this.mode() === 'Cloud' && !this.cloudReady) {
      this.showDisabled(
        'Voice transcription is not configured',
        'The server has no cloud transcription provider set up. You can type your task instead.',
      );
      return;
    }
    if (this.mode() === 'Browser' && !this.speech.supported) {
      this.showDisabled(
        'Voice input is not supported here',
        "This browser doesn't support speech recognition. Try Chrome or Edge, or type your task instead.",
      );
      return;
    }
    this.state.set('idle');
  }

  private showDisabled(title: string, text: string): void {
    this.failTitle.set(title);
    this.errorText.set(text);
    this.state.set('disabled');
  }

  // --- Start -----------------------------------------------------------

  async start(): Promise<void> {
    if (this.state() === 'recording' || this.state() === 'paused') return;

    if (!this.configLoaded) {
      this.voiceApi.getConfig().subscribe((cfg) => {
        this.mode.set(cfg.mode);
        this.cloudReady = cfg.cloudReady;
        this.configLoaded = true;
        this.start();
      });
      return;
    }

    if (this.mode() === 'Disabled' || (this.mode() === 'Cloud' && !this.cloudReady)) {
      this.applyInitialState();
      return;
    }

    if (this.mode() === 'Browser') {
      this.startBrowser();
    } else {
      await this.startCloud();
    }
  }

  retry(): void {
    this.start();
  }

  // --- Browser (Web Speech API) --------------------------------------

  private startBrowser(): void {
    if (!this.speech.supported) {
      this.applyInitialState();
      return;
    }
    const sid = this.resetSession();
    this.elapsed.set(0);
    this.state.set('recording');
    this.startTimer();

    this.speechSub = this.speech.listen().subscribe({
      next: (chunk) => {
        if (sid !== this.sessionId) return;
        this.liveFinal.set(chunk.final);
        this.liveInterim.set(chunk.interim);
      },
      error: (err: unknown) => {
        if (sid !== this.sessionId) return;
        this.stopTimer();
        const code = err instanceof SpeechRecognitionError ? err.code : 'unknown';
        this.log('speech recognition error', code);
        if (code === 'not-allowed') {
          this.state.set('permission');
          this.errorText.set('Microphone permission was denied. Allow access in your browser and retry.');
        } else if (code === 'audio-capture') {
          this.state.set('unavailable');
          this.errorText.set('No microphone was detected on this device.');
        } else if (code === 'not-supported') {
          this.showDisabled(
            'Voice input is not supported here',
            "This browser doesn't support speech recognition. Try Chrome or Edge, or type your task instead.",
          );
        } else if (code === 'network') {
          this.finishWithError(
            'Speech service unreachable',
            'Speech recognition needs an internet connection in this browser. Check your connection and try again.',
          );
        } else {
          this.finishWithError('Voice input failed', 'Something went wrong while listening. Try again or type instead.');
        }
      },
    });
  }

  private finishBrowser(): void {
    this.stopTimer();
    const text = (this.liveFinal() + (this.liveInterim() ? ' ' + this.liveInterim() : '')).trim();
    this.liveInterim.set('');

    if (!text) {
      this.finishWithError(
        'No speech detected',
        "We didn't catch any words. Try again and speak clearly, or type the task instead.",
      );
      return;
    }

    this.transcript = text;
    this.state.set('transcribing');
    // The text re-extract path needs no provider — always available in Browser mode.
    this.voiceApi.reextract(text).subscribe({
      next: (res) => {
        this.fields.set(res.data?.extractedFields ?? this.bareFields(text));
        this.state.set('completed');
      },
      error: () => {
        this.fields.set(this.bareFields(text));
        this.state.set('completed'); // we still have a real transcript to review
      },
    });
  }

  private bareFields(text: string): ExtractedFields {
    return { title: text.slice(0, 120), dueDate: null, dueTime: null, priority: null, reminderOffsetMinutes: null };
  }

  // --- Cloud (MediaRecorder + upload) --------------------------------

  private async startCloud(): Promise<void> {
    const sid = this.resetSession();

    const canRecord = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
    if (!canRecord) {
      this.state.set('unavailable');
      this.errorText.set('This browser cannot record audio. Type your task instead.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.log('getUserMedia rejected', (err as DOMException)?.name);
      const name = (err as DOMException)?.name;
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        this.state.set('unavailable');
        this.errorText.set('No microphone was detected on this device.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        this.state.set('unavailable');
        this.errorText.set('Your microphone is in use by another application.');
      } else {
        this.state.set('permission');
        this.errorText.set('Microphone permission was denied. Allow access in your browser and retry.');
      }
      return;
    }

    if (sid !== this.sessionId) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;

    const mime = this.pickMimeType();
    try {
      this.recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      this.recorder = new MediaRecorder(stream);
    }
    this.recorderMime = this.recorder.mimeType || mime || 'audio/webm';
    this.chunks = [];

    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (this.recorder?.state !== 'inactive' && e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onerror = () => {
      this.log('MediaRecorder error');
      this.finishWithError('Recording error', 'Something went wrong while recording. Try again.');
    };
    this.recorder.onstop = () => this.onRecorderStop(sid);

    const track = stream.getAudioTracks()[0];
    if (track) {
      this.trackEndedHandler = () => this.onTrackEnded();
      track.addEventListener('ended', this.trackEndedHandler);
    }

    this.recorder.start(TIMESLICE_MS);
    this.elapsed.set(0);
    this.state.set('recording');
    this.startTimer();
    this.startVisualizer();
    this.log('recording started', this.recorderMime);
  }

  private pickMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
    const isSupported = (MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported;
    if (typeof isSupported === 'function') {
      for (const c of candidates) if (isSupported(c)) return c;
    }
    return '';
  }

  private extensionFor(mime: string): string {
    const base = mime.split(';')[0].trim();
    return { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav' }[base] ?? 'webm';
  }

  private onRecorderStop(sid: number): void {
    if (sid !== this.sessionId) return;
    this.detachTrackEnded();
    this.releaseTracks();

    const type = (this.recorderMime || 'audio/webm').split(';')[0].trim();
    const blob = new Blob(this.chunks, { type });
    this.log('recorder stopped', `${blob.size} bytes`);

    if (this.chunks.length === 0 || blob.size === 0) {
      this.finishWithError(
        'Nothing was recorded',
        'The recording came out empty. Check that your microphone is working and try again.',
      );
      return;
    }
    if (blob.size > this.maxUploadBytes) {
      this.finishWithError('Recording too long', 'That recording is over the size limit. Record a shorter clip.');
      return;
    }
    this.upload(blob, sid);
  }

  private upload(blob: Blob, sid: number): void {
    if (this.uploading) return;
    this.uploading = true;
    this.state.set('transcribing');

    const filename = `recording.${this.extensionFor(this.recorderMime)}`;
    this.voiceApi.transcribe(blob, filename).subscribe({
      next: (res) => {
        this.uploading = false;
        if (sid !== this.sessionId) return;
        if (res.success && res.data && res.data.rawText?.trim()) {
          this.transcript = res.data.rawText;
          this.fields.set(res.data.extractedFields);
          this.state.set('completed');
        } else {
          this.showApiFailure(undefined, res.message);
        }
      },
      error: (err: NormalizedApiError) => {
        this.uploading = false;
        if (sid !== this.sessionId) return;
        this.log('transcription request failed', `${err?.status} ${err?.message}`);
        this.showApiFailure(err?.status, err?.message);
      },
    });
  }

  private showApiFailure(status?: number, message?: string): void {
    if (status === 503) {
      this.showDisabled(
        'Voice transcription is not configured',
        'The server has no cloud transcription provider set up. You can type your task instead.',
      );
      return;
    }
    if (status === 409) {
      this.showDisabled(
        'Voice upload not accepted',
        message || 'This environment does not accept audio uploads. Type your task instead.',
      );
      return;
    }
    this.failTitle.set('Could not transcribe');
    let text: string;
    if (status === undefined || status === 0) {
      text = 'Could not reach the server to transcribe your recording. Check your connection and try again.';
    } else if (status === 502) {
      text = 'The transcription service could not be reached. Please try again in a moment.';
    } else if (status === 401 || status === 403) {
      text = 'Your session has expired. Sign in again, then retry.';
    } else if (status === 429) {
      text = 'Too many voice requests in a short time. Wait a moment and try again.';
    } else {
      text = message || 'The server could not transcribe this recording. You can type the task instead.';
    }
    this.errorText.set(text);
    this.state.set('failed');
  }

  private onTrackEnded(): void {
    if (this.state() !== 'recording' && this.state() !== 'paused') return;
    this.log('audio track ended (access revoked)');
    this.stop();
  }

  // --- Controls -------------------------------------------------------

  pause(): void {
    if (this.state() !== 'recording' || this.mode() !== 'Cloud') return;
    if (this.recorder?.state === 'recording') this.recorder.pause();
    this.stopTimer();
    this.stopVisualizer();
    this.state.set('paused');
  }

  resume(): void {
    if (this.state() !== 'paused') return;
    if (this.recorder?.state === 'paused') this.recorder.resume();
    this.state.set('recording');
    this.startTimer();
    this.startVisualizer();
  }

  stop(): void {
    if (this.state() !== 'recording' && this.state() !== 'paused') return;
    this.stopTimer();
    this.stopVisualizer();

    if (this.mode() === 'Browser') {
      this.state.set('transcribing');
      this.speechSub?.unsubscribe();
      this.speechSub = undefined;
      this.finishBrowser();
      return;
    }

    this.state.set('processing');
    const r = this.recorder;
    if (r && (r.state === 'recording' || r.state === 'paused')) {
      try {
        r.requestData?.();
      } catch {
        /* not fatal */
      }
      try {
        r.stop();
      } catch {
        this.onRecorderStop(this.sessionId);
      }
    } else {
      this.onRecorderStop(this.sessionId);
    }
  }

  private finishWithError(title: string, text: string): void {
    this.detachTrackEnded();
    this.releaseTracks();
    this.speechSub?.unsubscribe();
    this.speechSub = undefined;
    this.failTitle.set(title);
    this.errorText.set(text);
    this.state.set('failed');
  }

  // --- Transcript review --------------------------------------------

  reextract(): void {
    if (!this.transcript.trim()) return;
    this.voiceApi.reextract(this.transcript).subscribe({
      next: (res) => res.data && this.fields.set(res.data.extractedFields),
      error: () => {},
    });
  }

  createTask(): void {
    if (this.creating()) return;
    const f = this.fields();
    const title = (f?.title || this.transcript.slice(0, 120)).trim();
    if (!title) return;
    this.creating.set(true);
    this.store.createTask({
      title,
      dueDate: f?.dueDate ?? null,
      dueTime: f?.dueTime ?? null,
      priority: f?.priority ?? 'Medium',
      reminderOffsetMinutes: f?.reminderOffsetMinutes ?? null,
      notes: this.transcript,
    });
    this.close();
  }

  fallbackToTyping(): void {
    this.close();
    this.ui.openQuickAdd();
  }

  close(): void {
    this.cleanup();
    this.ui.closeVoice();
    this.state.set('idle');
  }

  mmss(total: number): string {
    return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
  }

  // --- Timers & visualiser ------------------------------------------

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.elapsed.update((v) => v + 1);
      if (this.elapsed() >= MAX_RECORDING_SECONDS) this.stop();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private startVisualizer(): void {
    if (!this.stream || typeof AudioContext === 'undefined') return;
    try {
      this.audioCtx ??= new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const draw = () => {
        this.analyser!.getByteFrequencyData(data);
        const step = Math.floor(data.length / BAR_COUNT) || 1;
        this.bars.set(
          Array.from({ length: BAR_COUNT }, (_, i) => Math.max(8, Math.min(100, (data[i * step] / 255) * 100))),
        );
        this.rafId = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      /* visualiser is decorative */
    }
  }

  private stopVisualizer(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.bars.set(new Array(BAR_COUNT).fill(8));
  }

  // --- Cleanup -----------------------------------------------------

  private detachTrackEnded(): void {
    if (this.trackEndedHandler) {
      this.stream?.getAudioTracks().forEach((t) => t.removeEventListener('ended', this.trackEndedHandler!));
      this.trackEndedHandler = undefined;
    }
  }

  private releaseTracks(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }

  private resetSession(): number {
    const sid = ++this.sessionId;
    this.uploading = false;
    this.stopTimer();
    this.stopVisualizer();
    this.detachTrackEnded();

    this.speechSub?.unsubscribe();
    this.speechSub = undefined;

    const r = this.recorder;
    if (r && r.state !== 'inactive') {
      r.ondataavailable = null;
      r.onstop = null;
      r.onerror = null;
      try {
        r.stop();
      } catch {
        /* noop */
      }
    }
    this.recorder = undefined;
    this.recorderMime = '';
    this.chunks = [];
    this.releaseTracks();

    this.transcript = '';
    this.fields.set(null);
    this.errorText.set('');
    this.failTitle.set('Transcription failed');
    this.liveFinal.set('');
    this.liveInterim.set('');
    this.elapsed.set(0);
    this.creating.set(false);
    return sid;
  }

  private cleanup(): void {
    this.resetSession();
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = undefined;
    this.analyser = undefined;
  }

  private log(...args: unknown[]): void {
    if (this.isDev) console.debug('[voice]', ...args);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
