# HomeSKED

A home maintenance scheduler inspired by the US Navy's Planned Maintenance System (SKED/PMS).  
Organise maintenance tasks, cleaning schedules, and inspections by Home → Room → Equipment → Task.

---

## Deployment: GitHub + Portainer

This is the recommended workflow. Your code lives on GitHub; Portainer pulls and runs it.  
You never touch secrets in the repo — they live only in Portainer's environment variable UI.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/homesked.git
git push -u origin main
```

> `.gitignore` already excludes `node_modules/`, `data/`, `.env`, and any `.db` files.

---

### 2. Create a Stack in Portainer

1. Open Portainer → **Stacks** → **+ Add Stack**
2. Name it `homesked`
3. Choose **Repository** as the build method
4. Fill in:
   - **Repository URL:** `https://github.com/YOUR_USERNAME/homesked`
   - **Repository reference:** `refs/heads/main`
   - **Compose path:** `docker-compose.yml`
   - If it's a private repo, add your GitHub credentials
5. Scroll to **Environment variables** and add:

   | Variable | Value |
   |---|---|
   | `JWT_SECRET` | (any long random string, e.g. 64 random chars) |
   | `HOST_PORT` | `3000` (or whatever port you want on your host) |
   | `CORS_ORIGINS` | `*` (or your server IP, e.g. `http://192.168.1.50:3000`) |

6. Click **Deploy the stack**

Portainer will clone the repo, build the image, and start the container.  
Your database persists in the `homesked-data` Docker volume — it survives redeployments.

---

### 3. Set up Auto-Deploy on Git Push (Webhook)

This makes Portainer redeploy automatically whenever you push to GitHub.

**In Portainer:**
1. Open the `homesked` stack → **Edit**
2. Enable **"Automatic updates"** → choose **Webhook**
3. Copy the webhook URL shown (it looks like `https://your-portainer:9443/api/stacks/webhooks/xxxx`)

**In GitHub:**
1. Go to your repo → **Settings** → **Webhooks** → **Add webhook**
2. Paste the Portainer webhook URL into **Payload URL**
3. Set **Content type** to `application/json`
4. Choose **Just the push event**
5. Click **Add webhook**

Now every `git push` to `main` triggers a Portainer redeploy.  
Zero manual steps to ship an update.

---

### Updating the App

```bash
# Make your changes, then:
git add .
git commit -m "describe your change"
git push
```

GitHub notifies Portainer → Portainer rebuilds and restarts the container → database is untouched.

---

### Changing Environment Variables

Go to **Portainer → Stacks → homesked → Edit**, update the env vars, click **Update the stack**.  
Nothing in GitHub changes. Secrets stay off the internet.

---

## Local Development

Requires Node.js 18+.

```bash
cp .env.example .env    # edit .env with your local values
npm install
npm run dev             # auto-reloads on file changes
```

App runs at `http://localhost:3000`.

---

## Data Backup

```bash
# Backup
docker cp homesked:/data/homesked.db ./homesked-backup.db

# Restore
docker cp ./homesked-backup.db homesked:/data/homesked.db
docker restart homesked
```

---

## Mobile App (Future)

The backend is a clean REST API — it's already ready for a mobile client.

When you build the Android APK (React Native or Flutter recommended):

1. Point your API base URL to your server's IP, e.g. `http://192.168.1.50:3000/api`
2. All the same `/api/auth`, `/api/homes`, `/api/rooms`, `/api/equipment`, `/api/tasks`, `/api/dashboard` endpoints work as-is
3. Store the JWT token in secure device storage (not localStorage)
4. Update `CORS_ORIGINS` in Portainer to include your app's origin if needed

### API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/dashboard` | Stats + overdue/upcoming tasks |
| GET/POST | `/api/homes` | List / create homes |
| PUT/DELETE | `/api/homes/:id` | Update / delete home |
| GET/POST | `/api/rooms?home_id=` | List / create rooms |
| GET/POST | `/api/equipment?room_id=` | List / create equipment |
| GET/POST | `/api/tasks?equipment_id=` | List / create tasks |
| POST | `/api/tasks/:id/complete` | Mark task done |
| GET  | `/api/tasks/:id/history` | Completion history |

All routes except register/login require: `Authorization: Bearer <token>`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Internal container port (don't change) |
| `HOST_PORT` | `3000` | Host port exposed to your network |
| `DB_PATH` | `/data/homesked.db` | SQLite file path |
| `JWT_SECRET` | *(insecure default)* | **Always override in Portainer** |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (`better-sqlite3`) — file-based, zero config
- **Auth:** JWT (30-day tokens, `bcryptjs` password hashing)
- **Frontend:** Plain HTML / CSS / JS — no build step, no framework
- **Container:** Docker + Compose
- **Recommended deployment:** Portainer Stacks from GitHub
