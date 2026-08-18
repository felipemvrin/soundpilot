import { Injectable, inject } from '@angular/core';

import { TextNormalizerService } from './text-normalizer.service';

export interface TranscriptSegment {
  text: string;
  match: boolean;
}

/** Splits a transcript into plain and highlighted segments for the matched trigger. */
@Injectable({ providedIn: 'root' })
export class TranscriptHighlighterService {
  private readonly normalizer = inject(TextNormalizerService);

  highlight(text: string, trigger?: string): TranscriptSegment[] {
    if (!text) return [];
    const tokens = text.split(/(\s+)/).filter((token) => token.length);
    const triggerWords = trigger
      ? this.normalizer.normalize(trigger).split(' ').filter(Boolean)
      : [];
    if (!triggerWords.length) return [{ text, match: false }];

    const wordIndexes = tokens
      .map((token, index) => ({ token, index }))
      .filter(({ token }) => token.trim().length);

    let matchedIndexes: number[] = [];
    for (let start = 0; start + triggerWords.length <= wordIndexes.length; start += 1) {
      const window = wordIndexes.slice(start, start + triggerWords.length);
      const equal = window.every(
        ({ token }, offset) => this.normalizer.normalize(token) === triggerWords[offset],
      );
      if (equal) {
        matchedIndexes = window.map(({ index }) => index);
        break;
      }
    }

    if (!matchedIndexes.length) return [{ text, match: false }];

    const from = Math.min(...matchedIndexes);
    const to = Math.max(...matchedIndexes);
    const segments: TranscriptSegment[] = [];
    for (const [index, token] of tokens.entries()) {
      const match = index >= from && index <= to;
      const previous = segments[segments.length - 1];
      if (previous && previous.match === match) {
        previous.text += token;
      } else {
        segments.push({ text: token, match });
      }
    }
    return segments;
  }
}
