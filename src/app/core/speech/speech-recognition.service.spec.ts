import { describe, expect, it, vi } from 'vitest';

import { SpeechRecognitionService } from './speech-recognition.service';

interface FakeRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

const createRecognitionHarness = () => {
  const instances: FakeRecognition[] = [];
  class FakeRecognitionConstructor {
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event?: { error?: string }) => void) | null = null;
    start = vi.fn();
    stop = vi.fn();

    constructor() {
      instances.push(this);
    }
  }
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: FakeRecognitionConstructor,
  });
  return { instances };
};

const resultEvent = (text: string, isFinal: boolean, confidence = 0.9) => ({
  resultIndex: 0,
  results: [
    {
      isFinal,
      0: { transcript: text, confidence },
    },
  ],
});

describe('SpeechRecognitionService lifecycle', () => {
  it('configures continuous interim recognition and emits transcripts', () => {
    const { instances } = createRecognitionHarness();
    const service = new SpeechRecognitionService();
    const transcripts: string[] = [];
    service.transcript$.subscribe((event) => transcripts.push(event.text));

    service.start();
    instances[0]?.onresult?.(resultEvent('hola', false));

    expect(instances[0]?.continuous).toBe(true);
    expect(instances[0]?.interimResults).toBe(true);
    expect(instances[0]?.lang).toBe('es-ES');
    expect(service.isRecognizing()).toBe(true);
    expect(transcripts).toEqual(['hola']);
  });

  it('restarts after an unexpected recognition end', async () => {
    const { instances } = createRecognitionHarness();
    const service = new SpeechRecognitionService();

    service.start();
    instances[0]?.onend?.();
    await Promise.resolve();

    expect(instances).toHaveLength(2);
    expect(instances[1]?.start).toHaveBeenCalledOnce();
  });

  it('does not restart after a permission error', async () => {
    const { instances } = createRecognitionHarness();
    const service = new SpeechRecognitionService();

    service.start();
    instances[0]?.onerror?.({ error: 'not-allowed' });
    instances[0]?.onend?.();
    await Promise.resolve();

    expect(instances).toHaveLength(1);
  });

  it('stops without restarting and removes the active recognition instance', async () => {
    const { instances } = createRecognitionHarness();
    const service = new SpeechRecognitionService();

    service.start();
    service.stop();
    instances[0]?.onend?.();
    await Promise.resolve();

    expect(instances[0]?.stop).toHaveBeenCalledOnce();
    expect(instances).toHaveLength(1);
    expect(service.isRecognizing()).toBe(false);
  });

  it('deduplicates identical final results received within one second', () => {
    const { instances } = createRecognitionHarness();
    const service = new SpeechRecognitionService();
    const transcripts: string[] = [];
    service.transcript$.subscribe((event) => transcripts.push(event.text));

    service.start();
    instances[0]?.onresult?.(resultEvent('esposa', true));
    instances[0]?.onresult?.(resultEvent('esposa', true));

    expect(transcripts).toEqual(['esposa']);
  });
});
