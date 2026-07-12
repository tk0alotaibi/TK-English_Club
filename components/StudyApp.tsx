"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { alignTranscriptToWords } from "@/lib/text";
import { deleteLesson, getLessons, saveLesson } from "@/lib/db";
import type { Lesson } from "@/types";

type WordStamp = { word: string; start: number; end: number };

export default function StudyApp() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dictionary, setDictionary] = useState<{ word: string; meaning: string; context: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void refreshLessons();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function refreshLessons() {
    const stored = await getLessons();
    setLessons(stored);
    if (!activeLesson && stored[0]) loadStoredLesson(stored[0]);
  }

  function loadStoredLesson(lesson: Lesson) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const nextUrl = URL.createObjectURL(lesson.audioBlob);
    setAudioUrl(nextUrl);
    setActiveLesson(lesson);
    setCurrentIndex(0);
    setSearch("");
    setError("");
    setTimeout(() => {
      if (audioRef.current) audioRef.current.currentTime = lesson.lastPosition || 0;
    }, 50);
  }

  async function readTranscriptFile(file: File | null) {
    if (!file) return;
    setTranscript(await file.text());
  }

  async function generateLesson() {
    setError("");

    if (!audioFile) return setError("Choose an MP3 file.");
    if (!audioFile.name.toLowerCase().endsWith(".mp3")) return setError("The audio must be an MP3 file.");
    if (!transcript.trim()) return setError("Choose or paste the transcript.");
    if (audioFile.size > 25 * 1024 * 1024) return setError("The MP3 must be 25 MB or smaller.");

    try {
      setStatus("Uploading MP3 securely…");
      setProgress(18);

      const blob = await upload(audioFile.name, audioFile, {
        access: "public",
        handleUploadUrl: "/api/upload"
      });

      setStatus("Generating exact word timing with Whisper…");
      setProgress(48);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, fileName: audioFile.name })
      });

      const result = (await response.json()) as { words?: WordStamp[]; error?: string };
      if (!response.ok || !result.words) {
        throw new Error(result.error || "Timing generation failed.");
      }

      setStatus("Matching the transcript to the audio…");
      setProgress(78);

      const sentences = alignTranscriptToWords(transcript, result.words);
      const lesson: Lesson = {
        id: crypto.randomUUID(),
        title: audioFile.name.replace(/\.mp3$/i, ""),
        transcript: transcript.trim(),
        sentences,
        audioBlob: audioFile,
        createdAt: Date.now(),
        lastPosition: 0
      };

      await saveLesson(lesson);
      setProgress(100);
      setStatus("Lesson ready.");
      setAudioFile(null);
      setTranscript("");
      await refreshLessons();
      loadStoredLesson(lesson);

      setTimeout(() => {
        setStatus("");
        setProgress(0);
      }, 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setStatus("");
      setProgress(0);
    }
  }

  function updateHighlight() {
    if (!activeLesson || !audioRef.current) return;
    const time = audioRef.current.currentTime;
    const index = activeLesson.sentences.findIndex(
      (sentence) => time >= sentence.start && time < sentence.end
    );
    const safeIndex = index >= 0 ? index : Math.max(0, activeLesson.sentences.findLastIndex((s) => s.start <= time));
    if (safeIndex !== currentIndex) {
      setCurrentIndex(safeIndex);
      const element = transcriptRef.current?.querySelector(`[data-index="${safeIndex}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function savePosition() {
    if (!activeLesson || !audioRef.current) return;
    const updated = { ...activeLesson, lastPosition: audioRef.current.currentTime };
    setActiveLesson(updated);
    await saveLesson(updated);
    setLessons((current) => current.map((lesson) => lesson.id === updated.id ? updated : lesson));
  }

  async function removeCurrentLesson() {
    if (!activeLesson) return;
    await deleteLesson(activeLesson.id);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setActiveLesson(null);
    setCurrentIndex(0);
    const stored = await getLessons();
    setLessons(stored);
    if (stored[0]) loadStoredLesson(stored[0]);
  }

  async function openDictionary(word: string, context: string) {
    const cleanWord = word.replace(/[^A-Za-z'-]/g, "");
    setDictionary({ word: cleanWord, meaning: "Loading…", context });

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const meaning = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition ?? "No definition found.";
      setDictionary({ word: cleanWord, meaning, context });
    } catch {
      setDictionary({ word: cleanWord, meaning: "No definition was found.", context });
    }
  }

  const filteredLessons = useMemo(
    () => lessons.filter((lesson) => lesson.title.toLowerCase().includes(search.toLowerCase()) || lesson.transcript.toLowerCase().includes(search.toLowerCase())),
    [lessons, search]
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <small>PRIVATE STUDY PLAYER</small>
          <h1>TK English Club</h1>
        </div>
        <div className="header-actions">
          {activeLesson && <button className="danger-button" onClick={removeCurrentLesson}>Delete lesson</button>}
        </div>
      </header>

      <main className="main-grid">
        <aside className="panel sidebar">
          <h2 className="section-title">Add a lesson</h2>
          <p className="muted">Choose the original MP3 and its transcript. Timing is generated automatically.</p>

          <label className="file-card">
            <span className="file-icon">🎧</span>
            <span>
              <strong>MP3 audio</strong>
              <small>{audioFile?.name ?? "Choose MP3 — maximum 25 MB"}</small>
            </span>
            <input
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="file-card">
            <span className="file-icon">📄</span>
            <span>
              <strong>Transcript file</strong>
              <small>Choose TXT</small>
            </span>
            <input type="file" accept=".txt,text/plain" onChange={(event) => void readTranscriptFile(event.target.files?.[0] ?? null)} />
          </label>

          <label className="field-label" htmlFor="transcript">Or paste transcript</label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Paste the lesson transcript here…"
          />

          <button className="primary-button" disabled={Boolean(status)} onClick={generateLesson}>
            {status ? "Working…" : "Generate timing and save"}
          </button>

          {status && (
            <div className="progress-box">
              {status}
              <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          {error && <div className="error-box">{error}</div>}

          <section className="library">
            <div className="library-head">
              <h3>Lesson library</h3>
              <span className="counter">{lessons.length}</span>
            </div>
            <div className="library-list">
              {lessons.map((lesson) => (
                <button
                  className={`lesson-item ${activeLesson?.id === lesson.id ? "active" : ""}`}
                  key={lesson.id}
                  onClick={() => loadStoredLesson(lesson)}
                >
                  <strong>{lesson.title}</strong>
                  <small>{lesson.sentences.length} sentences</small>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="panel">
          <div className="player-head">
            <div>
              <p className="eyebrow">NOW STUDYING</p>
              <h2>{activeLesson?.title ?? "No lesson loaded"}</h2>
            </div>
            <span className="counter">
              {activeLesson ? `${currentIndex + 1} / ${activeLesson.sentences.length}` : "0 / 0"}
            </span>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            preload="metadata"
            onTimeUpdate={updateHighlight}
            onPause={() => void savePosition()}
            onEnded={() => void savePosition()}
          />

          <div className="toolbar">
            <label className="search">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transcript or lessons" />
            </label>
            <label className="speed">
              <span>Speed</span>
              <select onChange={(event) => {
                if (audioRef.current) audioRef.current.playbackRate = Number(event.target.value);
              }}>
                <option value="0.75">0.75×</option>
                <option value="0.9">0.90×</option>
                <option value="1" selected>1.00×</option>
                <option value="1.1">1.10×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.50×</option>
                <option value="2">2.00×</option>
              </select>
            </label>
          </div>

          <article className="transcript" ref={transcriptRef}>
            {!activeLesson ? (
              <div className="empty">
                <div>
                  <div style={{ fontSize: "3rem" }}>🎙️</div>
                  <h3>Your transcript will appear here</h3>
                  <p>Add an MP3 and transcript to begin.</p>
                </div>
              </div>
            ) : filteredLessons.some((lesson) => lesson.id === activeLesson.id) ? (
              activeLesson.sentences.map((sentence, index) => {
                const isMatch = search && sentence.text.toLowerCase().includes(search.toLowerCase());
                return (
                  <span
                    key={sentence.id}
                    data-index={index}
                    className={`sentence ${index === currentIndex ? "current" : ""} ${isMatch ? "search-match" : ""}`}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = sentence.start;
                        setCurrentIndex(index);
                      }
                    }}
                  >
                    {sentence.text.split(/(\b[A-Za-z]+(?:['’\-][A-Za-z]+)*\b)/g).map((part, partIndex) =>
                      /^[A-Za-z]/.test(part) ? (
                        <span
                          className="word"
                          key={partIndex}
                          onClick={(event) => {
                            event.stopPropagation();
                            void openDictionary(part, sentence.text);
                          }}
                        >
                          {part}
                        </span>
                      ) : part
                    )}{" "}
                  </span>
                );
              })
            ) : (
              <div className="empty"><p>No match in the current lesson.</p></div>
            )}
          </article>
        </section>
      </main>

      {dictionary && (
        <aside className="dictionary">
          <button className="close" onClick={() => setDictionary(null)}>×</button>
          <p className="eyebrow">SIMPLE DEFINITION</p>
          <h3>{dictionary.word}</h3>
          <p>{dictionary.meaning}</p>
          <p className="context">In the lesson: “{dictionary.context}”</p>
        </aside>
      )}
    </div>
  );
}
