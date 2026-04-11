\# API Endpoints



\## Health

GET /health



\## Donors

GET    /api/donors

POST   /api/donors/food-posting

GET    /api/donors/:id/postings



\## Drivers

GET    /api/drivers

GET    /api/drivers/available

PUT    /api/drivers/:id/availability

PUT    /api/drivers/:id/location



\## Shelters

GET    /api/shelters

PUT    /api/shelters/:id/capacity

PUT    /api/shelters/:id/accepting



\## Pickups

GET    /api/pickups

POST   /api/pickups/claim

PUT    /api/pickups/:id/picked-up

PUT    /api/pickups/:id/delivered



\## Admin

GET    /api/admin/stats

POST   /api/admin/expire-old-postings

