# TK English Club — Version 2

This is the visibly redesigned automatic-timing version.

## Features

- MP3-only import
- TXT transcript import or paste
- OpenAI Whisper word timestamps
- Automatic transcript-to-audio alignment
- Synchronized sentence highlighting
- Saved lesson library in IndexedDB
- Saved playback position
- English dictionary popup
- Transcript and library search
- Speed control

## Required Vercel settings

1. `OPENAI_API_KEY` in Environment Variables.
2. A Vercel Blob store connected to the project. This automatically adds `BLOB_READ_WRITE_TOKEN`.

## Deployment

Extract this ZIP at the repository root, then run:

```bash
npm install
npm run build
git add .
git commit -m "Deploy real TK English Club V2"
git push origin main
```
