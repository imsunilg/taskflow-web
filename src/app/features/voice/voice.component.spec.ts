import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { VoiceComponent } from './voice.component';
import { VoiceApiService } from './voice-api.service';
import { TaskStore } from '../../core/services/task.store';
import { UiStateService } from '../../core/services/ui-state.service';
import {
  SpeechChunk,
  SpeechRecognitionError,
  SpeechRecognitionService,
} from '../../core/services/speech-recognition.service';
import { VoiceConfig } from '../../core/models/voice.model';

const SAMPLE_SENTENCE = 'Remind me to submit the quarterly report tomorrow at 3pm, high priority.';

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus' || t === 'audio/webm';
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_s: unknown, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? '';
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  pause() {
    this.state = 'paused';
  }
  resume() {
    this.state = 'recording';
  }
  requestData() {}
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
  feed(bytes = 1024) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)], { type: 'audio/webm' }) });
  }
}

function fakeStream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), kind: 'audio' };
  return { getTracks: () => [track], getAudioTracks: () => [track], _track: track } as unknown as MediaStream & {
    _track: { stop: ReturnType<typeof vi.fn> };
  };
}

const BROWSER: VoiceConfig = { mode: 'Browser', cloudReady: false, maxAudioBytes: 10485760, allowedMimeTypes: ['audio/webm'] };
const CLOUD_READY: VoiceConfig = { mode: 'Cloud', cloudReady: true, maxAudioBytes: 10485760, allowedMimeTypes: ['audio/webm'] };
const CLOUD_UNSET: VoiceConfig = { mode: 'Cloud', cloudReady: false, maxAudioBytes: 10485760, allowedMimeTypes: ['audio/webm'] };
const DISABLED: VoiceConfig = { mode: 'Disabled', cloudReady: false, maxAudioBytes: 10485760, allowedMimeTypes: [] };

describe('VoiceComponent (provider-aware)', () => {
  let speechStream: Subject<SpeechChunk>;
  const voiceApi = { getConfig: vi.fn(), transcribe: vi.fn(), reextract: vi.fn() };
  const store = { createTask: vi.fn() };
  const ui = { closeVoice: vi.fn(), openQuickAdd: vi.fn() };
  const speech = { supported: true, listen: (() => {}) as unknown as SpeechRecognitionService['listen'] };
  let getUserMedia: ReturnType<typeof vi.fn>;

  async function setup(config: VoiceConfig = BROWSER) {
    voiceApi.getConfig.mockReturnValue(of(config));
    await TestBed.configureTestingModule({
      imports: [VoiceComponent],
      providers: [
        { provide: VoiceApiService, useValue: voiceApi },
        { provide: TaskStore, useValue: store },
        { provide: UiStateService, useValue: ui },
        { provide: SpeechRecognitionService, useValue: speech },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(VoiceComponent);
    fixture.detectChanges(); // runs ngOnInit → loads config
    return fixture.componentInstance;
  }

  const currentRecorder = () => FakeMediaRecorder.instances[FakeMediaRecorder.instances.length - 1];

  beforeEach(() => {
    vi.restoreAllMocks();
    voiceApi.getConfig.mockReset();
    voiceApi.transcribe.mockReset();
    voiceApi.reextract.mockReset().mockReturnValue(
      of({ success: true, data: { rawText: '', extractedFields: { title: 'X', dueDate: null, dueTime: null, priority: null, reminderOffsetMinutes: null } } }),
    );
    store.createTask.mockReset();
    ui.closeVoice.mockReset();
    ui.openQuickAdd.mockReset();
    FakeMediaRecorder.instances = [];

    speechStream = new Subject<SpeechChunk>();
    speech.supported = true;
    speech.listen = (() => speechStream.asObservable()) as unknown as SpeechRecognitionService['listen'];

    getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
    (navigator as unknown as { mediaDevices: unknown }).mediaDevices = { getUserMedia };
    (globalThis as Record<string, unknown>)['MediaRecorder'] = FakeMediaRecorder;
    (globalThis as Record<string, unknown>)['AudioContext'] = class {
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      createAnalyser() {
        return { fftSize: 0, frequencyBinCount: 8, getByteFrequencyData: () => {} };
      }
      close() {
        return Promise.resolve();
      }
    };
    globalThis.requestAnimationFrame = (() => 0) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as unknown as typeof cancelAnimationFrame;
    globalThis.URL.createObjectURL = (() => 'blob:mock') as unknown as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = (() => {}) as unknown as typeof URL.revokeObjectURL;
  });

  // --- mode selection --------------------------------------------------

  it('Browser mode: idle and ready when speech recognition is supported', async () => {
    const cmp = await setup(BROWSER);
    expect(cmp.mode()).toBe('Browser');
    expect(cmp.state()).toBe('idle');
  });

  it('Browser mode without speech support: shows the disabled "type instead" state', async () => {
    speech.supported = false;
    const cmp = await setup(BROWSER);
    expect(cmp.state()).toBe('disabled');
    expect(cmp.errorText()).toContain("doesn't support speech recognition");
  });

  it('Disabled mode: never records, shows disabled state', async () => {
    const cmp = await setup(DISABLED);
    expect(cmp.state()).toBe('disabled');
    await cmp.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(voiceApi.transcribe).not.toHaveBeenCalled();
  });

  it('Cloud mode but server not configured: disabled state, no recording', async () => {
    const cmp = await setup(CLOUD_UNSET);
    expect(cmp.state()).toBe('disabled');
    expect(cmp.failTitle()).toContain('not configured');
    expect(cmp.errorText()).toContain('no cloud transcription provider');
    await cmp.start();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  // --- Browser flow --------------------------------------------------

  it('Browser mode: does NOT call /api/voice/transcribe with audio; real spoken text reaches review', async () => {
    voiceApi.reextract.mockReturnValue(
      of({ success: true, data: { rawText: 'take the dog to the vet', extractedFields: { title: 'Take the dog to the vet', dueDate: null, dueTime: null, priority: null, reminderOffsetMinutes: null } } }),
    );
    const cmp = await setup(BROWSER);
    await cmp.start();
    expect(cmp.state()).toBe('recording');

    speechStream.next({ final: 'take the dog to the vet', interim: '' });
    cmp.stop();

    expect(voiceApi.transcribe).not.toHaveBeenCalled();
    expect(voiceApi.reextract).toHaveBeenCalledWith('take the dog to the vet');
    expect(cmp.transcript).toBe('take the dog to the vet');
    expect(cmp.transcript).not.toContain('quarterly report');
    expect(cmp.state()).toBe('completed');
  });

  it('Browser mode: shows live interim text while listening', async () => {
    const cmp = await setup(BROWSER);
    await cmp.start();
    speechStream.next({ final: 'buy milk', interim: 'and eggs' });
    expect(cmp.liveFinal()).toBe('buy milk');
    expect(cmp.liveInterim()).toBe('and eggs');
  });

  it('Browser mode: no speech → failed, never a canned transcript', async () => {
    const cmp = await setup(BROWSER);
    await cmp.start();
    cmp.stop();
    expect(cmp.state()).toBe('failed');
    expect(cmp.transcript).toBe('');
    expect(cmp.failTitle()).toContain('No speech');
  });

  it('Browser mode: permission denied maps to the permission state', async () => {
    speech.listen = (() =>
      throwError(() => new SpeechRecognitionError('not-allowed', 'no'))) as unknown as SpeechRecognitionService['listen'];
    const cmp = await setup(BROWSER);
    await cmp.start();
    expect(cmp.state()).toBe('permission');
  });

  it('Browser mode: recognition network error is reported honestly', async () => {
    speech.listen = (() =>
      throwError(() => new SpeechRecognitionError('network', 'offline'))) as unknown as SpeechRecognitionService['listen'];
    const cmp = await setup(BROWSER);
    await cmp.start();
    expect(cmp.state()).toBe('failed');
    expect(cmp.errorText().toLowerCase()).toContain('internet connection');
  });

  // --- Cloud flow --------------------------------------------------

  it('Cloud mode: records and uploads exactly one multipart request, returns real text', async () => {
    voiceApi.transcribe.mockReturnValue(
      of({ success: true, data: { rawText: 'call the plumber monday', extractedFields: { title: 'Call the plumber', dueDate: null, dueTime: null, priority: null, reminderOffsetMinutes: null } } }),
    );
    const cmp = await setup(CLOUD_READY);
    expect(cmp.state()).toBe('idle');

    await cmp.start();
    expect(cmp.mode()).toBe('Cloud');
    currentRecorder().feed(2048);

    cmp.stop();
    cmp.stop();

    expect(voiceApi.transcribe).toHaveBeenCalledTimes(1);
    const [blob, filename] = voiceApi.transcribe.mock.calls[0];
    expect((blob as Blob).size).toBeGreaterThan(0);
    expect(filename).toBe('recording.webm');
    expect(cmp.transcript).toBe('call the plumber monday');
    expect(cmp.state()).toBe('completed');
  });

  it('Cloud mode: empty recording is not uploaded', async () => {
    const cmp = await setup(CLOUD_READY);
    await cmp.start();
    cmp.stop();
    expect(voiceApi.transcribe).not.toHaveBeenCalled();
    expect(cmp.state()).toBe('failed');
  });

  it('Cloud mode: a 503 from the server drops to the disabled state', async () => {
    voiceApi.transcribe.mockReturnValue(throwError(() => ({ status: 503, message: 'not configured', errors: [] })));
    const cmp = await setup(CLOUD_READY);
    await cmp.start();
    currentRecorder().feed();
    cmp.stop();
    expect(cmp.state()).toBe('disabled');
  });

  it('Cloud mode: a 502 upstream error is shown as a retryable failure', async () => {
    voiceApi.transcribe.mockReturnValue(throwError(() => ({ status: 502, message: 'gateway', errors: [] })));
    const cmp = await setup(CLOUD_READY);
    await cmp.start();
    currentRecorder().feed();
    cmp.stop();
    expect(cmp.state()).toBe('failed');
    expect(cmp.errorText()).toContain('could not be reached');
  });

  it('Cloud mode: permission denied maps to the permission state', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    const cmp = await setup(CLOUD_READY);
    await cmp.start();
    expect(cmp.state()).toBe('permission');
  });

  it('Cloud mode: Cancel stops the mic tracks and uploads nothing', async () => {
    const stream = fakeStream();
    getUserMedia.mockResolvedValueOnce(stream);
    const cmp = await setup(CLOUD_READY);
    await cmp.start();
    currentRecorder().feed();
    cmp.close();
    expect(stream._track.stop).toHaveBeenCalled();
    expect(voiceApi.transcribe).not.toHaveBeenCalled();
    expect(cmp.state()).toBe('idle');
  });

  // --- shared -----------------------------------------------------

  it('createTask forwards fields once then closes', async () => {
    const cmp = await setup(BROWSER);
    cmp.transcript = 'Book flights';
    cmp.fields.set({ title: 'Book flights', dueDate: '2026-02-01', dueTime: null, priority: 'High', reminderOffsetMinutes: null });
    cmp.createTask();
    cmp.createTask();
    expect(store.createTask).toHaveBeenCalledTimes(1);
    expect(ui.closeVoice).toHaveBeenCalled();
  });

  it('never references the hard-coded sample sentence', async () => {
    const cmp = await setup(BROWSER);
    await cmp.start();
    speechStream.next({ final: 'water the plants', interim: '' });
    cmp.stop();
    expect(cmp.transcript).not.toBe(SAMPLE_SENTENCE);
  });
});
