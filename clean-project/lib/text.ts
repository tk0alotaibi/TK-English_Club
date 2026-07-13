import type { TimedSentence } from "@/types";

export type WordStamp = {
  word: string;
  start: number;
  end: number;
};

export function splitSentences(text: string): string[] {
  const clean = text
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const matches = clean.match(/[^.!?…]+(?:[.!?…]+["'’”)]*|$)/g);
  return (matches ?? [clean]).map((part) => part.trim()).filter(Boolean);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9']/g, "");
}

export function alignTranscriptToWords(
  transcript: string,
  words: WordStamp[]
): TimedSentence[] {
  const sentences = splitSentences(transcript);
  const cleanWords = words
    .map((item) => ({ ...item, normalized: normalize(item.word) }))
    .filter((item) => item.normalized);

  let cursor = 0;

  return sentences.map((sentence) => {
    const tokens = (sentence.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) ?? [])
      .map(normalize)
      .filter(Boolean);

    if (!tokens.length || !cleanWords.length) {
      const start = cleanWords[cursor]?.start ?? 0;
      return {
        id: crypto.randomUUID(),
        text: sentence,
        start,
        end: start + 2
      };
    }

    let bestStart = cursor;
    let bestScore = -1;
    const maxStart = Math.min(
      cleanWords.length,
      cursor + Math.max(80, tokens.length * 5)
    );

    for (let candidate = cursor; candidate < maxStart; candidate++) {
      let score = 0;
      let wordIndex = candidate;

      for (const token of tokens) {
        while (
          wordIndex < cleanWords.length &&
          cleanWords[wordIndex].normalized !== token &&
          wordIndex - candidate < tokens.length * 4 + 24
        ) {
          wordIndex++;
        }

        if (
          wordIndex < cleanWords.length &&
          cleanWords[wordIndex].normalized === token
        ) {
          score++;
          wordIndex++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestStart = candidate;
      }

      if (score >= Math.ceil(tokens.length * 0.9)) break;
    }

    let matched = 0;
    let endIndex = bestStart;

    for (
      let index = bestStart;
      index < cleanWords.length && matched < tokens.length;
      index++
    ) {
      if (cleanWords[index].normalized === tokens[matched]) {
        matched++;
        endIndex = index;
      }
      if (index - bestStart > tokens.length * 5 + 24) break;
    }

    if (matched < Math.max(1, Math.floor(tokens.length * 0.35))) {
      endIndex = Math.min(
        cleanWords.length - 1,
        bestStart + Math.max(0, tokens.length - 1)
      );
    }

    const start = cleanWords[bestStart]?.start ?? 0;
    const end = cleanWords[endIndex]?.end ?? start + 2;
    cursor = Math.min(cleanWords.length, endIndex + 1);

    return {
      id: crypto.randomUUID(),
      text: sentence,
      start,
      end: Math.max(end, start + 0.15)
    };
  });
}
