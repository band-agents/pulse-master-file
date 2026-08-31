# THOTH ERP — Deployment Guide

## Local Development

THOTH is a React + Vite application. It **cannot** be opened via `index.html` directly or with VS Code "Go Live" — those won't work because:
- Vite uses ES modules that require a dev server
- Environment variables (`.env.local`) are injected at build time
- Tailwind CSS compiles on-the-fly through the Vite plugin

### Quick Start

```bash
# Install dependencies (first time only)
pnpm install

# Start dev server
pnpm dev

# App opens at http://localhost:5173
```

The dev server is already configured with `--host 0.0.0.0` so you can access it from your phone on the same network.

### Available Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start development server (hot reload) |
| `pnpm build` | Production build → `dist/public/` |
| `pnpm serve` | Preview the production build locally |
| `pnpm typecheck` | Run TypeScript type checking |

### Mobile Testing (Local Network)

After running `pnpm dev`, open your phone browser and go to:
```
http://<your-computer-ip>:5173
```

Find your IP with: `ipconfig` (Windows) or `ifconfig` / `ip addr` (Mac/Linux)

---

## Environment Variables

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Without these variables**, THOTH runs in **Demo Mode** with sample data (no login required).

---

## Supabase Setup

### 1. Create Project
- Go to https://supabase.com → New Project
- Save the project URL and anon key

### 2. Run Migrations
Run these SQL files in order via Supabase SQL Editor:
1. `supabase/schema.sql` (base schema)
2. `supabase/connected-furniture-engine.sql` (materials/BOM)
3. `supabase/connected-customer-workflow.sql` (activity events, notes)
4. `supabase/users-access-control.sql` (roles, permissions, invitations)

### 3. Auth Configuration
In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: Add:
  - `https://your-domain.com`
  - `http://localhost:5173` (for local dev)

### 4. Enable Email Auth
In Authentication → Providers → Email:
- Enable email/password sign-in
- Optional: Enable magic link

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create thoth-erp --private --push
```

### 2. Connect to Vercel

1. Go to https://vercel.com → Import Git Repository
2. Select your GitHub repo
3. Framework Preset: **Vite**
4. Build Command: `pnpm build`
5. Output Directory: `dist/public`
6. Install Command: `pnpm install`

### 3. Environment Variables (Vercel)

Add in Vercel → Settings → Environment Variables:
- `VITE_SUPABASE_URL` → your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

### 4. Deploy

Click Deploy. Vercel builds and serves at `your-project.vercel.app`.

### 5. Update Supabase Redirect URL

Add your Vercel URL to Supabase Auth → Redirect URLs:
```
https://your-project.vercel.app
```

---

## Deploy to Netlify

1. Push to GitHub (same as above)
2. Go to https://app.netlify.com → Import from Git
3. Build command: `pnpm build`
4. Publish directory: `dist/public`
5. Add environment variables (same as Vercel)
6. Add `_redirects` file for SPA routing:

```bash
echo "/*    /index.html   200" > public/_redirects
```

---

## Production Checklist

- [ ] Environment variables set on hosting platform
- [ ] Supabase migrations run
- [ ] Auth redirect URLs configured
- [ ] Tested on mobile (responsive)
- [ ] Custom domain configured (optional)
- [ ] Supabase RLS policies verified

---

## Why "Go Live" Doesn't Work

VS Code "Go Live" extension serves static files. THOTH requires:
1. **Vite dev server** — compiles TypeScript, JSX, Tailwind on the fly
2. **Environment injection** — `import.meta.env.VITE_*` variables
3. **Module resolution** — `@/` path aliases, bare imports
4. **HMR** — Hot Module Replacement for instant updates

**Always use `pnpm dev` for local development.**
