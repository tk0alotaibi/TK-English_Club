# TK English Club V5.1 FIXED

The live page must visibly show:

- `V5.1 FIXED • AUTO TIMING IS LIVE`
- a yellow `V5.1 FIXED` badge in the upper-right corner
- an orange/teal interface
- the button `Create timing automatically`

## Codespaces commands

After uploading `TK-English-Club-V5-FIXED.zip` to GitHub:

```bash
git pull origin main
unzip -o TK-English-Club-V5-FIXED.zip
git status --short
git add .
git commit -m "Deploy TK English Club V5.1 fixed"
git pull origin main --rebase
git push origin main
```

Do not run npm commands in Codespaces. Vercel installs and builds automatically.
