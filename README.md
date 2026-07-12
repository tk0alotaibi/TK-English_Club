# TK English Club V5

This version has a clearly different orange/teal interface and displays:

`V5 LIVE • AUTOMATIC TIMING`

## Deploy from Codespaces

After uploading `TK-English-Club-V5.zip` to GitHub:

```bash
git pull origin main
unzip -o TK-English-Club-V5.zip
git add .
git commit -m "Deploy TK English Club V5"
git pull origin main --rebase
git push origin main
```

Do not run npm commands in Codespaces. Vercel builds automatically.

## Required Vercel configuration

- `OPENAI_API_KEY`
- A connected Public Vercel Blob store
