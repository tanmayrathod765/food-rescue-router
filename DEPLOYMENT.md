# Production Deployment Playbook

This project is ready to deploy with:

- Backend on Render
- Frontend on Vercel
- PostgreSQL on Neon or Supabase

## 1. Create the production database

Use Neon or Supabase and create a PostgreSQL database.

Copy the connection string and keep it ready for `DATABASE_URL`.

Example format:

```text
postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
```

## 2. Deploy the backend on Render

The repo already includes [render.yaml](render.yaml) with the backend service definition.

Use these values in Render:

- Root directory: `backend`
- Build command: `npm install && npx prisma generate && npx prisma db push`
- Start command: `npm start`
- Environment variables:
  - `NODE_ENV=production`
  - `PORT=10000`
  - `DATABASE_URL=<your Neon or Supabase connection string>`
  - `FRONTEND_URL=<your Vercel frontend URL>`

After deploy, copy the Render service URL. This becomes your backend API URL.

## 3. Deploy the frontend on Vercel

The repo already includes [frontend/vercel.json](frontend/vercel.json) for SPA routing.

Use these values in Vercel:

- Project root: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_API_URL=<your Render backend URL>`
  - `VITE_SOCKET_URL=<your Render backend URL>`

After deploy, copy the Vercel URL. This becomes your frontend URL.

## 4. Link the two environments

Set the URLs like this:

- Render `FRONTEND_URL` = your Vercel URL
- Vercel `VITE_API_URL` = your Render URL
- Vercel `VITE_SOCKET_URL` = your Render URL

If you later rename either service, update these env vars again.

## 5. Sync Prisma to production

From the backend folder, the production schema sync command is:

```bash
npx prisma db push
```

If you need Prisma client generation separately:

```bash
npx prisma generate
```

## 6. Production smoke test

After both deploys finish, verify:

1. `GET /health` on the backend returns `ok`.
2. The frontend loads without CORS errors.
3. Restaurant posting works.
4. Driver claim, pickup, and delivery work.
5. Admin dashboard updates live.
6. Impact popup appears after a delivery or simulation completion.

## 7. Notes

- The backend already allows both `http://localhost:5173` and `http://127.0.0.1:5173` for local development, plus the configured production frontend URL.
- The frontend already has an SPA rewrite so Vercel routes refreshes correctly.
- I can’t click the external dashboards for you, but the repo is now set up for a straight deploy.