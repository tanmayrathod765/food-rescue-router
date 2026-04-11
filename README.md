\# 🍱 Food Rescue Router



Real-time food rescue logistics platform that matches volunteer 

drivers to surplus food donations using custom algorithms.



\## Core Features



\- \*\*TSP Algorithm\*\* — Custom route optimization with time windows

\- \*\*Bipartite Matching\*\* — Driver-food matching by capacity + proximity

\- \*\*Concurrency Safe\*\* — Race condition prevention via DB locks

\- \*\*Live Dashboard\*\* — Real-time map with Socket.io



\## Tech Stack



| Layer | Technology |

|-------|-----------|

| Frontend | React + Vite + TailwindCSS + Leaflet.js |

| Backend | Node.js + Express |

| Database | PostgreSQL + Prisma |

| Realtime | Socket.io |



\## Setup



\### Backend

cd backend

npm install

npx prisma db push --schema=prisma/schema.prisma

node src/prisma/seed.js

npm run dev



\### Frontend

cd frontend

npm install

npm run dev



\## API

Backend: http://localhost:5000

Frontend: http://localhost:5173



\## Tests

cd backend

npm run test:once

## Deployment

### Backend on Render

1. Create a new Web Service from this repository.
2. Set the root directory to `backend`.
3. Use the build command from `render.yaml`:

	`npm install && npx prisma generate && npx prisma db push`

4. Use the start command from `render.yaml`:

	`npm start`

5. Add these environment variables:
	- `DATABASE_URL` from Neon or Supabase
	- `FRONTEND_URL` set to your Vercel URL
	- `NODE_ENV=production`

### Frontend on Vercel

1. Import the `frontend` folder as the Vercel project root.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set environment variables:
	- `VITE_API_URL` to your Render backend URL
	- `VITE_SOCKET_URL` to your Render backend URL

### Database on Neon or Supabase

1. Create a PostgreSQL database.
2. Copy the connection string into `DATABASE_URL`.
3. Re-run Prisma migration sync with `npx prisma db push` from `backend`.

### Production checklist

1. Confirm the backend health endpoint returns `ok`.
2. Confirm the frontend can load the API and Socket.IO endpoint.
3. Verify the admin dashboard, claim flow, and simulation flow in production.

