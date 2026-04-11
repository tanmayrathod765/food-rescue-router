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

