# TK English Club

A private iPad-friendly study player for English audio lessons.

## Included

- MP3-only lesson import
- TXT transcript import or paste
- Automatic word timestamps using OpenAI Whisper
- Sentence-level synchronized highlighting
- Tap a sentence to seek
- Tap a word for an English definition
- Search and playback speed
- Lesson library stored locally on the device with IndexedDB
- Last playback position saved
- Temporary cloud MP3 deleted after timing generation

## Required Vercel setup

### 1. Create a Vercel Blob store

Open the Vercel project:

**Storage → Create Database → Blob**

Connect it to this project. Vercel adds:

`BLOB_READ_WRITE_TOKEN`

### 2. Add the OpenAI API key

Open:

**Project Settings → Environment Variables**

Add:

`OPENAI_API_KEY`

Use your OpenAI API key as the value and enable it for Production, Preview, and Development.

### 3. Deploy

Upload all project files to the root of the GitHub repository. Vercel redeploys automatically.

## Limits

- MP3 only
- Maximum MP3 size: 25 MB
- The OpenAI API is billed separately from a ChatGPT subscription
- Lessons and audio are stored inside the browser on the current device
