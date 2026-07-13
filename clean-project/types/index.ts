export type TimedSentence = {
  id: string;
  text: string;
  start: number;
  end: number;
};

export type StoredLesson = {
  id: string;
  title: string;
  transcript: string;
  sentences: TimedSentence[];
  audioBlob: Blob;
  createdAt: number;
  lastPosition: number;
};
