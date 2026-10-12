# Realtime Code Collaborator

A browser-based editor where several people write the same code at the same time, run it in ten languages, review it with an AI assistant, and keep its history. Think of Google Docs, built for code.

**Live demo:** https://realtime-code-collaborator.vercel.app


## Features

**Collaboration**
- Create a session and share its link. Guests join without an account.
- Real-time editing with conflict-free merging (CRDT), live cursors with names, and a presence list.
- Follow mode: track another person's scroll position.
- In-session chat and inline comments that stay attached to their line when code moves.

**Running code**
- Run JavaScript, TypeScript, Python, Java, C, C++, Go, Rust, PHP and Ruby in a sandbox.
- An interactive console: programs can ask for input while they run, and you type the answer in the console.

**Control and safety**
- The owner can switch a session to view-only, set a room password, or set an expiry time. These are enforced on the server.
- When a session expires, all of its data is permanently deleted and connected users are disconnected.
- Passwords are stored as Argon2 hashes. Owner tokens are stored only as hashes.

**History**
- Automatic snapshots, named checkpoints, a diff view, and restore (owner only).

**Accounts**
- Sign in with email, Google or GitHub (Supabase Auth). A dashboard lists your sessions, and ownership can be recovered on another device.

**AI**
- An in-session assistant that explains and improves the code, a code review that marks problems in the editor, and optional inline suggestions while you type. The provider is configurable (Groq by default).
- Suggestion lists for the eight languages Monaco has no built-in support for.

**Export**
- Export the code to a GitHub Gist, or commit it as a file in a repository, using a one-time GitHub authorisation that is discarded right after.

**Interface**
- Responsive layout for phones, tablets and desktops, with a dark theme.

## Architecture

```
Browser ──► Vercel (React app)
   │
   └──► HTTPS / WSS ──► AWS EC2 server (Docker Compose)
                          ├─ Caddy     HTTPS, automatic certificates
                          ├─ Backend   FastAPI: REST + WebSockets
                          └─ Piston    code sandbox (internal only)
                                │
                                └──► Supabase (Postgres + Auth)

Backend ──► AI provider (OpenAI-compatible API, Groq by default)
```

- **Real-time sync:** each browser keeps a Yjs document and syncs it with the backend over a WebSocket (`/ws/{slug}`). The backend holds the live document for each session, saves it to the database, and enforces permissions on every update.
- **Running code:** the browser opens `/ws/run/{slug}`. The backend relays input and output to Piston's interactive endpoint.
- **Access control:** the backend decides who may read, edit, run or administer a session using an owner token, an optional room password, and the Supabase login token.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, React Router |
| Editor | Monaco Editor, Yjs, y-websocket, y-monaco |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, pycrdt and pycrdt-websocket |
| Database and login | Supabase (Postgres, Auth) |
| Code execution | Piston (self-hosted, Docker) |
| AI | Any OpenAI-compatible API (Groq by default) |
| Hosting | Vercel (frontend), AWS EC2 with Docker Compose and Caddy (backend and Piston) |

## Repository structure

```
.
├── frontend/     React app (see frontend/README.md)
├── backend/      FastAPI app, database models, migrations, Dockerfile
│   ├── app/
│   │   ├── routers/    HTTP and WebSocket endpoints
│   │   ├── sync/       real-time sync server and permission checks
│   │   ├── services/   code execution, AI, expiry cleanup, GitHub export
│   │   ├── auth/       owner tokens, passwords, access rules
│   │   ├── models/     database tables
│   │   └── schemas/    request and response shapes
│   └── alembic/        database migrations
├── piston/       local Piston setup and language install scripts
└── deploy/       production Docker Compose, Caddy config, server scripts
```

## Getting started (local development)

### Prerequisites

- Node.js 20 or newer
- Python 3.12
- Docker Desktop (for Piston)
- A Supabase project (free tier is fine)
- Optional: an API key from Groq, for the AI features

### 1. Database and login (Supabase)

1. Create a project. In **Connect**, copy the **Session pooler** connection string.
2. From **Settings → API**, copy the project URL and the publishable (anon) key.
3. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to the Redirect URLs.
4. Optional: enable the Google and GitHub providers under **Authentication → Providers**.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
Copy-Item .env.example .env         # macOS/Linux: cp .env.example .env
# fill in .env (see "Configuration" below)
alembic upgrade head                # creates the database tables
python -m uvicorn app.main:app --reload --port 8000
```

Check it: http://localhost:8000/health should show `{"status":"ok"}`, and `/health/db` should say `connected`. The interactive API docs are at http://localhost:8000/docs (development only).

### 3. Code runner (Piston)

```powershell
cd piston
docker compose up -d
.\install-languages.ps1             # downloads the languages, takes several minutes
.\test-languages.ps1                # runs a hello-world in each language
```

### 4. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173.

## Configuration

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase session pooler connection string |
| `FRONTEND_ORIGIN` | Exact address of the frontend. One address only, no trailing slash. Used for CORS and the WebSocket origin check |
| `ENVIRONMENT` | `development` (default) or `production`. Production hides the `/docs` pages |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Used to verify login tokens |
| `PISTON_URL` | Default `http://localhost:2000/api/v2` |
| `PUBLIC_BACKEND_URL` | The backend's public address, used by the GitHub export callback |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth app for the export feature |
| `AI_ENABLED` | `true` or `false` |
| `AI_PROVIDER` | `groq` (preset) or any name, with `AI_BASE_URL` set |
| `AI_API_KEY` | Key for the AI provider |
| `AI_BASE_URL` | Optional override of the provider address |
| `AI_CHAT_MODEL`, `AI_REVIEW_MODEL`, `AI_COMPLETION_MODEL` | Model names |
| `AI_REASONING_EFFORT`, `AI_TOKEN_HEADROOM` | Settings for models that think before answering |
| `AI_CHAT_PER_MINUTE`, `AI_REVIEW_PER_MINUTE`, `AI_COMPLETE_PER_MINUTE`, `AI_DAILY_CHAT`, `AI_DAILY_COMPLETE` | Request limits |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend address, for example `http://localhost:8000` |
| `VITE_YJS_URL` | WebSocket address for sync, for example `ws://localhost:8000/ws` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Public Supabase values |
| `VITE_RUN_WS_URL` | Optional. Derived from `VITE_API_URL` when not set |

Never put a secret in a `VITE_` variable. Everything in them is visible in the browser.

## Deployment

The app runs as three parts: the frontend on Vercel, and the backend with its code sandbox on one Linux server.

### Frontend (Vercel)

1. Import the repository in Vercel and set the **Root Directory** to `frontend`.
2. Add the four `VITE_` variables, using `https://` and `wss://` addresses for the backend.
3. Deploy. Every push to `main` redeploys automatically. Environment changes need a redeploy, since they are read at build time.

### Backend and Piston (AWS EC2)

Prerequisites: an Ubuntu 24.04 server (at least 2 GB of memory, 4 GB recommended), a fixed IP address, and a hostname that points at it (for example `<ip-with-dashes>.sslip.io`). Open ports 80 and 443 to everyone, and SSH only to your own address.

```bash
git clone https://github.com/Chfaez12/Realtime-Code-Collaborator.git ~/app
cd ~/app/deploy
cp .env.example .env && nano .env        # set the hostname, database and keys
docker compose build
docker compose run --rm --no-deps backend alembic upgrade head
docker compose up -d
bash install-piston-languages.sh         # first time only, takes 5-15 minutes
```

To update after pushing new code:

```bash
cd ~/app/deploy
git pull && docker compose build && docker compose up -d
```

Do not run `docker compose down -v`. It deletes the HTTPS certificate and the installed languages.

After deploying, set the backend's `FRONTEND_ORIGIN` to the Vercel address, and add that address to Supabase's Site URL and Redirect URLs and, for Google login, to the allowed JavaScript origins.

### Useful commands on the server

| Task | Command |
|---|---|
| See what is running | `docker compose ps` |
| Read backend logs | `docker compose logs --tail 100 backend` |
| Restart the backend | `docker compose restart backend` |
| Apply a changed `.env` | `docker compose up -d --force-recreate backend` |

## How the main parts work

- **Sessions and ownership.** Creating a session returns an owner token once. Only its hash is stored. Signed-in creators also get the session linked to their account, so they can recover ownership on another device.
- **Permissions.** View-only mode, room passwords and expiry are checked on the server when a client connects and on every update, so the interface cannot be bypassed.
- **Persistence.** The live document is saved a couple of seconds after each change and when the last person leaves. History keeps automatic snapshots and named checkpoints.
- **Expiry.** A background task deletes expired, non-persistent sessions with all of their data.
- **Code execution.** Programs run in Piston, a privileged Docker container with its network switched off, on an internal Docker network only.

## Security notes

- Piston is never reachable from outside the server.
- The backend accepts exactly one frontend address, for both HTTP and WebSocket connections.
- Requests to run code, use the AI, and enter room passwords are rate limited.
- `.env` files are never committed. Keep a private copy of the server's `.env` and of the SSH key.
- Piston runs untrusted code on the same server as the backend's secrets. For a public product, move it to its own server.

## Known limitations

- **Session replay (FR-17 in the SRS) is not implemented.** History keeps snapshots only.
- The backend runs as a single process, because live sessions and rate limits are held in memory. It cannot be scaled to several copies.
- Manual checkpoints and restores are owner-only. GitHub export commits a single file.
- Guest names are not verified. The AI features use free-tier quotas.
- Restoring a version can move inline comments to the first line.

## Project status

All functional requirements of the SRS are implemented except FR-17. Frontend deployment is automatic through Vercel. Backend deployment is manual for now, and GitHub Actions is planned.

