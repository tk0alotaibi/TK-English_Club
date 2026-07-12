# TK English Club — Version 4

V4 avoids the Codespaces npm problem completely.

## Deploy

Upload this ZIP to the GitHub repository, then in Codespaces run only:

```bash
git pull origin main
unzip -o TK-English-Club-V4.zip
git add .
git commit -m "Deploy TK English Club V4"
git pull origin main --rebase
git push origin main
```

Do **not** run `npm install`, `npm ci`, or `npm run build` in Codespaces.
Vercel installs dependencies and builds the project automatically.

## Required Vercel settings

- `OPENAI_API_KEY`
- A connected Public Vercel Blob store, which adds `BLOB_READ_WRITE_TOKEN`
