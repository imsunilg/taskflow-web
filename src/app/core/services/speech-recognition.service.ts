import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SpeechChunk {
  /** Everything the engine has finalised this session (only ever grows). */
  final: string;
  /** Words still being refined — transient, safe to show greyed out. */
  interim: string;
}

export type SpeechErrorCode =
  | 'not-supported'
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown';

export class SpeechRecognitionError extends Error {
  constructor(readonly code: SpeechErrorCode, message: string) {
    super(message);
  }
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
}

/** Wraps the Web Speech API. Keeps listening (auto-restarts on silence) until unsubscribed. */
@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  private readonly zone = inject(NgZone);

  private get ctor(): (new () => SpeechRecognitionLike) | undefined {
    const w = window as unknown as Record<string, unknown>;
    return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
      | (new () => SpeechRecognitionLike)
      | undefined;
  }

  get supported(): boolean {
    return !!this.ctor;
  }

  listen(lang = navigator.language || 'en-US'): Observable<SpeechChunk> {
    const Ctor = this.ctor;
    return new Observable<SpeechChunk>((subscriber) => {
      if (!Ctor) {
        subscriber.error(
          new SpeechRecognitionError('not-supported', 'Speech recognition is not supported in this browser.'),
        );
        return;
      }

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalText = '';
      let stopping = false;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript ?? '';
          if (res.isFinal) finalText += (finalText ? ' ' : '') + text.trim();
          else interim += text;
        }
        this.zone.run(() => subscriber.next({ final: finalText.trim(), interim: interim.trim() }));
      };

      recognition.onnomatch = () => {
        this.zone.run(() => subscriber.next({ final: finalText.trim(), interim: '' }));
      };

      recognition.onerror = (event: any) => {
        const code = this.mapError(event?.error);
        if (code === 'no-speech' || (stopping && code === 'aborted')) return; // non-fatal, onend follows
        this.zone.run(() =>
          subscriber.error(new SpeechRecognitionError(code, `Speech recognition error: ${event?.error ?? code}`)),
        );
      };

      recognition.onend = () => {
        if (stopping) {
          this.zone.run(() => {
            subscriber.next({ final: finalText.trim(), interim: '' });
            subscriber.complete();
          });
          return;
        }
        // Chrome ends the session after a pause — restart so we keep listening until Stop.
        try {
          recognition.start();
        } catch {
          this.zone.run(() => {
            subscriber.next({ final: finalText.trim(), interim: '' });
            subscriber.complete();
          });
        }
      };

      try {
        recognition.start();
      } catch (err) {
        subscriber.error(
          new SpeechRecognitionError('unknown', (err as Error)?.message ?? 'Could not start recognition.'),
        );
        return;
      }

      return () => {
        stopping = true;
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      };
    });
  }

  private mapError(raw: string | undefined): SpeechErrorCode {
    switch (raw) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'not-allowed';
      case 'no-speech':
        return 'no-speech';
      case 'audio-capture':
        return 'audio-capture';
      case 'network':
        return 'network';
      case 'aborted':
        return 'aborted';
      default:
        return 'unknown';
    }
  }
}
