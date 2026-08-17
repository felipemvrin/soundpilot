import { describe, expect, it } from 'vitest';

import { TextNormalizerService } from './text-normalizer.service';

describe('TextNormalizerService', () => {
  const service = new TextNormalizerService();

  it.each([
    ['ESPOSA', 'esposa'],
    ['Esposa', 'esposa'],
    ['¡ESPOSA!', 'esposa'],
    ['esposa,', 'esposa'],
    ['  Mi   Señora. ', 'mi senora'],
  ])('normalizes %s', (source, expected) => {
    expect(service.normalize(source)).toBe(expected);
  });
});
