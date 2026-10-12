# Frontend: Realtime Code Collaborator

The React app for the editor. It talks to the FastAPI backend over REST and two WebSockets.

**Live:** https://realtime-code-collaborator.vercel.app

## Stack

- React and TypeScript, built with Vite
- Tailwind CSS v4, through the `@tailwindcss/vite` plugin
- React Router for pages
- Monaco Editor (`@monaco-editor/react`), Yjs, `y-websocket` and `y-monaco` for real-time editing
- Supabase JavaScript client for login

## Scripts

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies |
| `npm run dev` | Starts the dev server at http://localhost:5173 |
| `npm run build` | Type-checks and builds to `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs the linter |

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend address, such as `http://localhost:8000` (`https://...` in production) |
| `VITE_YJS_URL` | Sync WebSocket address, such as `ws://localhost:8000/ws` (`wss://.../ws` in production) |
| `VITE_SUPABASE_URL` | Supabase project address |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key |
| `VITE_RUN_WS_URL` | Optional. By default the run-code socket is derived from `VITE_API_URL` |

Vite reads these when the dev server starts or when the site is built. After changing one, restart `npm run dev`, or redeploy on Vercel. Everything beginning with `VITE_` is public, so never put a secret in one.

## Pages

| Address | Page |
|---|---|
| `/` | Landing: create or join a session |
| `/s/:sessionId` | The editor |
| `/login` | Sign in or sign up (email, Google, GitHub) |
| `/dashboard` | Your sessions |

`vercel.json` rewrites every address to `index.html`, so refreshing a session page works on Vercel.

## Source layout

```
src/
├── pages/        one file per page
├── components/
│   ├── editor/       CodeEditor (the main screen), language selector
│   ├── session/      share, settings, participants, password prompt, GitHub export
│   ├── chat/         in-session chat
│   ├── comments/     inline comments panel
│   ├── ai/           AI assistant and review panel
│   ├── history/      version history and diff viewer
│   ├── execution/    run button and interactive console
│   └── ui/           shared building blocks (Button, Popover, DropdownMenu, icons)
├── hooks/        behaviour: sync, awareness, chat, comments, AI, follow mode, runner
├── lib/          API calls, WebSocket setup, Supabase client
├── context/      authentication state
├── utils/        language list, suggestion lists, small helpers
├── router.tsx    routes
└── index.css     Tailwind import, theme colours, base styles
```

## How it talks to the backend

**REST** (`src/lib/sessionsApi.ts`, `src/lib/aiApi.ts`): sessions, settings, history, the dashboard, AI requests and GitHub export. Requests carry whatever proves access: the owner token (`X-Owner-Token`), the room password (`X-Session-Password`, URL-encoded), and the login token (`Authorization: Bearer ...`).

**Sync WebSocket** (`src/lib/websocket.ts`): a standard y-websocket connection to `${VITE_YJS_URL}/<session id>`. Right after connecting it sends three extra messages that the backend understands:

| Message type | Content |
|---|---|
| 100 | The owner token, if this browser owns the session |
| 101 | The room password, if there is one |
| 102 | Display name and, if signed in, the login token |

The backend closes the connection with these codes, which the app handles: `4401` wrong or missing password, `4403` origin not allowed, `4404` session not found, `4410` session expired.

**Run-code WebSocket** (`src/lib/runSocket.ts`): `${API address}/ws/run/<session id>`. The first message carries the code and credentials. After that the browser sends typed input and the backend streams output back.

## Where things are stored in the browser

| Data | Where |
|---|---|
| Owner token for a session | `localStorage`, key `collab-owner:<id>` |
| Room password you entered | `sessionStorage`, per tab |
| Guest name and colour | `sessionStorage`, per tab |
| "AI suggestions" switch | `localStorage` |

## Responsive layout

The editor screen adapts with Tailwind's breakpoints:

- **Large screens (1024px and up):** one side panel (Chat, Comments or AI) docks beside the editor.
- **Smaller screens:** the panel slides over the editor with a backdrop, and the toolbar wraps. Secondary actions are in the ⋯ menu.
- **Narrow screens (under 768px):** the output console starts collapsed, and long lines wrap in the editor.

Check it in your browser's device toolbar at 375, 768 and 1280 pixels wide.

## Styling

Colours come from the theme in `src/index.css` (`bg-canvas`, `bg-surface`, `bg-raised`, `border-line`, `text-muted`, `bg-accent`). Use these names in class lists instead of fixed colour codes, so the whole app can be re-themed in one place. Shared pieces (`Button`, `IconButton`, `Popover`, `DropdownMenu`) are in `src/components/ui/`.

## Adding a language

1. `src/utils/languages.ts`: add the language (label, Monaco id, Piston id, file extension).
2. `src/utils/completions.ts`: add a suggestion list, if Monaco has no built-in support for it.
3. Backend: add it to `LANGUAGES` in `app/services/piston_client.py` and to the allowed list in `app/schemas/session.py`, and install its package in Piston.

## Build and deploy

The app deploys to Vercel from the `frontend` folder. Settings:

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm run build`, output directory: `dist`
- Environment variables: the four `VITE_` variables above, with production addresses

Every push to `main` deploys automatically. The backend only accepts one frontend address (its `FRONTEND_ORIGIN` setting), so preview deployments on other addresses cannot connect.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Page is white | A `VITE_` variable is missing. Check them, restart the dev server or redeploy |
| "Could not reach the server" or a CORS error | The backend's `FRONTEND_ORIGIN` doesn't match this site's address exactly (`https`, no trailing slash) |
| The toolbar dot stays orange | `VITE_YJS_URL` is wrong. In production it must start with `wss://` |
| Refreshing a session page shows a 404 on Vercel | `vercel.json` is missing, or the root directory isn't `frontend` |
| After login you land on `localhost` | The Supabase Site URL still points at localhost |
| `npm run build` fails on types | Fix the reported unused import or type error. Vercel runs the same build |