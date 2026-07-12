import type { TimedSentence } from "@/types";

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r/g, "").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const matches = normalized.match(/[^.!?…]+(?:[.!?…]+["'’”)]*|$)/g);
  return (matches ?? [normalized]).map((item) => item.trim()).filter(Boolean);
}

function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9']/g, "");
}

type WordStamp = { word: string; start: number; end: number };

export function alignTranscriptToWords(transcript: string, words: WordStamp[]): TimedSentence[] {
  const sentences = splitSentences(transcript);
  const cleanWords = words
    .map((word) => ({ ...word, normalized: normalizeWord(word.word) }))
    .filter((word) => word.normalized);

  let cursor = 0;

  return sentences.map((sentence, sentenceIndex) => {
    const tokens = (sentence.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g) ?? [])
      .map(normalizeWord)
      .filter(Boolean);

    if (!tokens.length || !cleanWords.length) {
      const fallbackStart = sentenceIndex === 0 ? 0 : sentenceIndex * 2;
      return {
        id: crypto.randomUUID(),
        text: sentence,
        start: fallbackStart,
        end: fallbackStart + 2
      };
    }

    let bestStart = cursor;
    let bestScore = -1;
    const searchEnd = Math.min(cleanWords.length, cursor + Math.max(60, tokens.length * 4));

    for (let candidate = cursor; candidate < searchEnd; candidate++) {
      let score = 0;
      const window = cleanWords.slice(candidate, candidate + tokens.length + 8);
      let wi = 0;
      for (const token of tokens) {
        while (wi < window.length && window[wi].normalized !== token) wi++;
        if (wi < window.length) {
          score++;
          wi++;
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
    for (let index = bestStart; index < cleanWords.length && matched < tokens.length; index++) {
      if (cleanWords[index].normalized === tokens[matched]) {
        matched++;
        endIndex = index;
      }
      if (index - bestStart > tokens.length * 4 + 20) break;
    }

    if (matched < Math.max(1, Math.floor(tokens.length * 0.35))) {
      endIndex = Math.min(cleanWords.length - 1, bestStart + Math.max(0, tokens.length - 1));
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
