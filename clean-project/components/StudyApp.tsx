"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { alignTranscriptToWords, type WordStamp } from "@/lib/text";
import { deleteLesson, getLessons, saveLesson } from "@/lib/db";
import type { StoredLesson } from "@/types";

type DictionaryState = {
  word: string;
  meaning: string;
  context: string;
};

type ServiceStatus = {
  openai: boolean;
  blob: boolean;
};

export default function StudyApp() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lessons, setLessons] = useState<StoredLesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<StoredLesson | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lessonSearch, setLessonSearch] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dictionary, setDictionary] = useState<DictionaryState | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void refreshLibrary();
    void checkServices();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function checkServices() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setServiceStatus((await response.json()) as ServiceStatus);
    } catch {
      setServiceStatus({ openai: false, blob: false });
    }
  }

  function exportTimingJson() {
    if (!activeLesson) return;

    const payload = {
      title: activeLesson.title,
      transcript: activeLesson.transcript,
      sentences: activeLesson.sentences
    };

    const file = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeLesson.title}-timing.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function refreshLibrary() {
    const saved = await getLessons();
    setLessons(saved);

    if (!activeLesson && saved[0]) {
      openLesson(saved[0]);
    }
  }

  function openLesson(lesson: StoredLesson) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioUrl(URL.createObjectURL(lesson.audioBlob));
    setActiveLesson(lesson);
    setCurrentIndex(0);
    setTranscriptSearch("");
    setError("");

    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = lesson.lastPosition || 0;
      }
    }, 80);
  }

  async function chooseTranscript(file: File | null) {
    if (!file) return;
    setTranscript(await file.text());
  }

  async function generateTiming() {
    setError("");

    if (!audioFile) {
      setError("Choose an MP3 file first.");
      return;
    }

    if (!audioFile.name.toLowerCase().endsWith(".mp3")) {
      setError("Only MP3 files are accepted.");
      return;
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      setError("The MP3 must be 25 MB or smaller.");
      return;
    }

    if (!transcript.trim()) {
      setError("Choose a TXT file or paste the transcript.");
      return;
    }

    setWorking(true);

    try {
      setStatus("1 of 3 — Uploading MP3 securely");
      setProgress(20);

      const blob = await upload(audioFile.name, audioFile, {
        access: "public",
        handleUploadUrl: "/api/upload"
      });

      setStatus("2 of 3 — Whisper is finding every word");
      setProgress(55);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          fileName: audioFile.name
        })
      });

      const result = (await response.json()) as {
        words?: WordStamp[];
        error?: string;
      };

      if (!response.ok || !result.words) {
        throw new Error(result.error || "Automatic timing failed.");
      }

      setStatus("3 of 3 — Matching your transcript");
      setProgress(84);

      const sentences = alignTranscriptToWords(transcript, result.words);

      const lesson: StoredLesson = {
        id: crypto.randomUUID(),
        title: audioFile.name.replace(/\.mp3$/i, ""),
        transcript: transcript.trim(),
        sentences,
        audioBlob: audioFile,
        createdAt: Date.now(),
        lastPosition: 0
      };

      await saveLesson(lesson);
      setLessons((current) => [lesson, ...current]);
      openLesson(lesson);

      setProgress(100);
      setStatus("Ready — timing saved on this iPad");
      setAudioFile(null);
      setTranscript("");

      setTimeout(() => {
        setProgress(0);
        setStatus("");
      }, 2200);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong."
      );
      setStatus("");
      setProgress(0);
    } finally {
      setWorking(false);
    }
  }

  function updateHighlight() {
    if (!activeLesson || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    let index = activeLesson.sentences.findIndex(
      (sentence) => time >= sentence.start && time < sentence.end
    );

    if (index < 0) {
      index = Math.max(
        0,
        activeLesson.sentences.findLastIndex(
          (sentence) => sentence.start <= time
        )
      );
    }

    if (index !== currentIndex) {
      setCurrentIndex(index);
      transcriptRef.current
        ?.querySelector(`[data-sentence-index="${index}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function saveCurrentPosition() {
    if (!activeLesson || !audioRef.current) return;

    const updated = {
      ...activeLesson,
      lastPosition: audioRef.current.currentTime
    };

    setActiveLesson(updated);
    setLessons((current) =>
      current.map((lesson) => (lesson.id === updated.id ? updated : lesson))
    );
    await saveLesson(updated);
  }

  async function removeActiveLesson() {
    if (!activeLesson) return;

    await deleteLesson(activeLesson.id);

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    const remaining = lessons.filter(
      (lesson) => lesson.id !== activeLesson.id
    );

    setLessons(remaining);
    setActiveLesson(null);
    setAudioUrl("");
    setCurrentIndex(0);

    if (remaining[0]) openLesson(remaining[0]);
  }

  async function showDefinition(word: string, context: string) {
    const clean = word.replace(/[^A-Za-z'-]/g, "");
    setDictionary({
      word: clean,
      meaning: "Loading definition…",
      context
    });

    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
      );

      if (!response.ok) throw new Error();

      const data = await response.json();
      const meaning =
        data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition ??
        "No definition was found.";

      setDictionary({ word: clean, meaning, context });
    } catch {
      setDictionary({
        word: clean,
        meaning: "No definition was found.",
        context
      });
    }
  }

  const visibleLessons = useMemo(() => {
    const query = lessonSearch.trim().toLowerCase();
    if (!query) return lessons;

    return lessons.filter(
      (lesson) =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.transcript.toLowerCase().includes(query)
    );
  }, [lessonSearch, lessons]);

  return (
    <div className="app-shell">
      <header className="hero-header">
        <div>
          <div className="version-pill">CLEAN FINAL • AUTOMATIC TIMING</div>
          <h1>TK English Club <span className="v5-mark">FINAL</span></h1>
          <p>MP3 + transcript → automatic timing and synchronized highlighting.</p>
        </div>

        <div className="hero-badge" aria-label="Automatic timing enabled">
          <span>AI</span>
          <strong>Auto Sync</strong>
        </div>
      </header>

      <main className="workspace">
        <aside className="card import-card">
          <div className="step-number">START</div>
          <h2>Create a synced lesson</h2>

          <div className="service-check">
            <div>
              <span className={`status-dot ${serviceStatus?.openai ? "ok" : "bad"}`} />
              OpenAI
            </div>
            <div>
              <span className={`status-dot ${serviceStatus?.blob ? "ok" : "bad"}`} />
              MP3 storage
            </div>
          </div>
          {serviceStatus && (!serviceStatus.openai || !serviceStatus.blob) && (
            <div className="setup-warning">
              {!serviceStatus.openai && <div>OPENAI_API_KEY is missing.</div>}
              {!serviceStatus.blob && <div>Connect a Vercel Blob store before uploading MP3 files.</div>}
            </div>
          )}
          <p className="subtle">
            The original MP3 stays in your personal lesson library on this
            device.
          </p>

          <label className="upload-box">
            <span className="upload-icon">🎧</span>
            <span>
              <strong>Choose MP3</strong>
              <small>{audioFile?.name ?? "Original AJ audio • up to 25 MB"}</small>
            </span>
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={(event) =>
                setAudioFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <label className="upload-box">
            <span className="upload-icon">📄</span>
            <span>
              <strong>Choose transcript</strong>
              <small>TXT file</small>
            </span>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(event) =>
                void chooseTranscript(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <div className="or-row"><span>or paste it</span></div>

          <textarea
            className="transcript-input"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Paste the complete lesson transcript here…"
          />

          <button
            className="generate-button"
            disabled={working}
            onClick={generateTiming}
          >
            <span>✦</span>
            {working ? "Generating timing…" : "Create automatic timing"}
          </button>

          {status && (
            <div className="progress-panel">
              <strong>{status}</strong>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <div className="error-panel">{error}</div>}

          <section className="library-section">
            <div className="section-heading">
              <div>
                <span className="mini-label">SAVED ON THIS DEVICE</span>
                <h3>Lesson library</h3>
              </div>
              <span className="count-badge">{lessons.length}</span>
            </div>

            <input
              className="library-search"
              value={lessonSearch}
              onChange={(event) => setLessonSearch(event.target.value)}
              placeholder="Search saved lessons"
            />

            <div className="lesson-list">
              {visibleLessons.length === 0 ? (
                <div className="library-empty">No saved lessons yet.</div>
              ) : (
                visibleLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    className={`lesson-card ${
                      activeLesson?.id === lesson.id ? "active" : ""
                    }`}
                    onClick={() => openLesson(lesson)}
                  >
                    <span className="lesson-play">▶</span>
                    <span>
                      <strong>{lesson.title}</strong>
                      <small>{lesson.sentences.length} timed sentences</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="card player-card">
          <div className="player-title-row">
            <div>
              <span className="mini-label">V5 PLAYER • NOW STUDYING</span>
              <h2>{activeLesson?.title ?? "Choose your first lesson"}</h2>
            </div>

            <div className="player-actions">
              <span className="sentence-counter">
                {activeLesson
                  ? `${currentIndex + 1} / ${activeLesson.sentences.length}`
                  : "0 / 0"}
              </span>
              {activeLesson && (
                <>
                  <button className="export-button" onClick={exportTimingJson}>
                    Export JSON
                  </button>
                  <button
                    className="delete-button"
                    onClick={removeActiveLesson}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload="metadata"
            onTimeUpdate={updateHighlight}
            onPause={() => void saveCurrentPosition()}
            onEnded={() => void saveCurrentPosition()}
          />

          <div className="player-tools">
            <label className="transcript-search">
              <span>⌕</span>
              <input
                value={transcriptSearch}
                onChange={(event) =>
                  setTranscriptSearch(event.target.value)
                }
                placeholder="Search inside this transcript"
              />
            </label>

            <label className="speed-control">
              <span>Speed</span>
              <select
                defaultValue="1"
                onChange={(event) => {
                  if (audioRef.current) {
                    audioRef.current.playbackRate = Number(
                      event.target.value
                    );
                  }
                }}
              >
                <option value="0.75">0.75×</option>
                <option value="0.9">0.90×</option>
                <option value="1">1.00×</option>
                <option value="1.1">1.10×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.50×</option>
                <option value="2">2.00×</option>
              </select>
            </label>
          </div>

          <article className="reader" ref={transcriptRef}>
            {!activeLesson ? (
              <div className="reader-empty">
                <div className="reader-symbol">✦</div>
                <h3>Automatic timing is ready</h3>
                <p>
                  Add one MP3 and its transcript, then press the purple button.
                </p>
              </div>
            ) : (
              activeLesson.sentences.map((sentence, index) => {
                const match =
                  transcriptSearch.trim() &&
                  sentence.text
                    .toLowerCase()
                    .includes(transcriptSearch.trim().toLowerCase());

                return (
                  <span
                    key={sentence.id}
                    data-sentence-index={index}
                    className={`timed-sentence ${
                      currentIndex === index ? "current" : ""
                    } ${match ? "search-match" : ""}`}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = sentence.start;
                        setCurrentIndex(index);
                      }
                    }}
                  >
                    {sentence.text
                      .split(/(\b[A-Za-z]+(?:['’\-][A-Za-z]+)*\b)/g)
                      .map((part, partIndex) =>
                        /^[A-Za-z]/.test(part) ? (
                          <span
                            key={partIndex}
                            className="dictionary-word"
                            onClick={(event) => {
                              event.stopPropagation();
                              void showDefinition(part, sentence.text);
                            }}
                          >
                            {part}
                          </span>
                        ) : (
                          part
                        )
                      )}{" "}
                  </span>
                );
              })
            )}
          </article>

          <footer className="reader-footer">
            <span>Tap a sentence to jump to it.</span>
            <span>Tap a word for its English definition.</span>
          </footer>
        </section>
      </main>

      {dictionary && (
        <aside className="dictionary-popover">
          <button
            className="dictionary-close"
            onClick={() => setDictionary(null)}
          >
            ×
          </button>
          <span className="mini-label">SIMPLE DEFINITION</span>
          <h3>{dictionary.word}</h3>
          <p>{dictionary.meaning}</p>
          <div className="dictionary-context">
            In the lesson: “{dictionary.context}”
          </div>
        </aside>
      )}
    </div>
  );
}
