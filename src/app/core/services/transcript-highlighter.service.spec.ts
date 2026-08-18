import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { TextNormalizerService } from './text-normalizer.service';
import { TranscriptHighlighterService } from './transcript-highlighter.service';

const createHighlighter = (): TranscriptHighlighterService => {
  const injector = createEnvironmentInjector([
    { provide: TextNormalizerService, useValue: new TextNormalizerService() },
  ]);
  return runInInjectionContext(injector, () => new TranscriptHighlighterService());
};

describe('TranscriptHighlighterService', () => {
  it('highlights a single-word trigger ignoring case and accents', () => {
    const segments = createHighlighter().highlight('...y mi Esposa, me dijo', 'esposa');
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual([
      'Esposa,',
    ]);
  });

  it('highlights multi-word triggers as a single block', () => {
    const segments = createHighlighter().highlight('cuando mi esposa llegó', 'mi esposa');
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual([
      'mi esposa',
    ]);
  });

  it('returns the plain text when there is no trigger match', () => {
    const segments = createHighlighter().highlight('hola buenas tardes', 'esposa');
    expect(segments).toEqual([{ text: 'hola buenas tardes', match: false }]);
  });
});
