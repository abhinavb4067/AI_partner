# Cloudflare R2 setup (one-time, ~10 minutes, $0 to start)

This app now supports storing AI-companion chat-generated photos in
Cloudflare R2 instead of local disk. It's off by default (`R2_ENABLED=False`)
so nothing changes until you complete these steps and flip it on.

## 1. Create the bucket

1. Log into the Cloudflare dashboard → **R2 Object Storage** in the left sidebar.
2. If this is your first time, click **Enable R2** (still $0 — no card charge
   at the free tier, though Cloudflare may ask for a card on file).
3. **Create bucket** → name it `avoiga-chat-media` (or whatever you like —
   just update `R2_BUCKET_NAME` in `.env` to match).
4. Leave it **private** (do not enable public access) — access is controlled
   entirely through the app's own auth check, not R2's public URLs.

## 2. Create an API token

1. In the R2 dashboard, go to **Manage R2 API Tokens** (top right).
2. **Create API Token**.
3. Permissions: **Object Read & Write**, scoped to the one bucket you just
   created (don't grant account-wide access).
4. Create it — you'll get three values, shown once:
   - **Access Key ID**
   - **Secret Access Key**
   - Your **Account ID** is shown on the main R2 page (also in the dashboard
     URL: `dash.cloudflare.com/<account_id>/r2`).

## 3. Give me those 4 values (or set them yourself)

Add to `backend/.env` on the server:

```
R2_ENABLED=true
R2_ACCOUNT_ID=<your account id>
R2_ACCESS_KEY_ID=<the access key id>
R2_SECRET_ACCESS_KEY=<the secret access key>
R2_BUCKET_NAME=avoiga-chat-media
```

Then `pip install -r requirements.txt` (adds `boto3`) and
`systemctl restart fastapi`.

**Send the 4 values to me over this chat only if you're comfortable with
that** — I'll set them in `.env` on the server and restart for you. Otherwise
SSH in and set them yourself with the steps above; either way nothing else
needs to change.

## What happens after you flip it on

- **New** chat-generated photos go straight to R2, no local disk write.
- **Old** photos already on local disk keep working — the media route
  checks R2 first, and falls back to local disk if the object isn't there.
- Nothing in the frontend, database, or URLs changes — `/media/<char>/<user>/<file>`
  stays the same shape either way; only where the bytes physically live changes.
- Free tier covers 10GB storage + 10M reads/month, **zero egress fees** — at
  your current usage (single-digit MB) this should cost $0 for a long time.
