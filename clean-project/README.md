# TK English Club — Clean Final

Single clean project with MP3 upload, TXT transcript import, OpenAI Whisper timing,
automatic sentence highlighting, dictionary, saved lessons, search, speed control,
saved playback position, delete, and timing JSON export.

## Required Vercel setup

- `OPENAI_API_KEY`
- Connected Public Vercel Blob store (`BLOB_READ_WRITE_TOKEN`)

## Install over the old repository

```bash
git pull origin main
unzip -o TK-English-Club-Clean-Final.zip
bash install-clean-project.sh
git add -A
git commit -m "Install clean final TK English Club"
git pull origin main --rebase
git push origin main
```

Do not run npm commands in Codespaces. Vercel installs and builds automatically.
