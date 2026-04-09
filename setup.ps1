Write-Host "Setting up Food Rescue Router..." -ForegroundColor Green

# Backend folders
$folders = @(
    "backend\src\algorithms\tsp",
    "backend\src\algorithms\matching",
    "backend\src\controllers",
    "backend\src\routes",
    "backend\src\services",
    "backend\src\middleware",
    "backend\src\prisma",
    "backend\src\tests",
    "docs"
)
foreach ($f in $folders) { mkdir $f -Force }

# Backend files
$backendFiles = @(
    "backend\src\algorithms\haversine.js",
    "backend\src\algorithms\tsp\nearestNeighbor.js",
    "backend\src\algorithms\tsp\twoOpt.js",
    "backend\src\algorithms\tsp\timeWindows.js",
    "backend\src\algorithms\tsp\index.js",
    "backend\src\algorithms\matching\scoreCalculator.js",
    "backend\src\algorithms\matching\bipartiteMatch.js",
    "backend\src\algorithms\matching\cascadeMatch.js",
    "backend\src\algorithms\matching\index.js",
    "backend\src\controllers\donor.controller.js",
    "backend\src\controllers\driver.controller.js",
    "backend\src\controllers\shelter.controller.js",
    "backend\src\controllers\pickup.controller.js",
    "backend\src\controllers\admin.controller.js",
    "backend\src\routes\donor.routes.js",
    "backend\src\routes\driver.routes.js",
    "backend\src\routes\shelter.routes.js",
    "backend\src\routes\pickup.routes.js",
    "backend\src\routes\admin.routes.js",
    "backend\src\services\matching.service.js",
    "backend\src\services\routing.service.js",
    "backend\src\services\claim.service.js",
    "backend\src\services\socket.service.js",
    "backend\src\middleware\auth.middleware.js",
    "backend\src\middleware\error.middleware.js",
    "backend\src\middleware\rateLimit.middleware.js",
    "backend\src\prisma\seed.js",
    "backend\src\app.js",
    "backend\src\server.js",
    "backend\.env",
    "backend\.env.example",
    "backend\.gitignore",
    "docs\architecture.md",
    "docs\algorithms.md",
    "docs\api-endpoints.md",
    ".gitignore",
    "README.md"
)
foreach ($f in $backendFiles) { New-Item $f -ItemType File -Force }

Write-Host "Folders and files created!" -ForegroundColor Green

# Backend packages
Write-Host "Installing backend packages..." -ForegroundColor Yellow
Set-Location backend
npm init -y
npm install express cors dotenv socket.io @prisma/client pg
npm install -D prisma nodemon jest supertest
npx prisma init
Set-Location ..

# Frontend
Write-Host "Setting up frontend..." -ForegroundColor Yellow
npm create vite@latest frontend -- --template react
Set-Location frontend
npm install
npm install axios socket.io-client leaflet react-leaflet
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Frontend folders + files
$frontendFolders = @(
    "src\pages",
    "src\components\Map",
    "src\hooks",
    "src\utils"
)
foreach ($f in $frontendFolders) { mkdir $f -Force }

$frontendFiles = @(
    "src\pages\RestaurantDashboard.jsx",
    "src\pages\DriverDashboard.jsx",
    "src\pages\ShelterDashboard.jsx",
    "src\pages\AdminDashboard.jsx",
    "src\components\Map\LiveMap.jsx",
    "src\components\Map\DriverMarker.jsx",
    "src\components\Map\DonorMarker.jsx",
    "src\components\Map\RouteLines.jsx",
    "src\components\AlgorithmPanel.jsx",
    "src\components\StatsBar.jsx",
    "src\components\SimulationControl.jsx",
    "src\hooks\useSocket.js",
    "src\hooks\useSimulation.js",
    "src\utils\api.js",
    ".env",
    ".env.example"
)
foreach ($f in $frontendFiles) { New-Item $f -ItemType File -Force }

Set-Location ..
Write-Host "Setup Complete!" -ForegroundColor Green