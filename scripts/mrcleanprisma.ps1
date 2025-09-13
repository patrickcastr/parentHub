<# 
.SYNOPSIS
  Clean & regenerate Prisma client (Windows), run migration, optional backfill, and restart dev server.

.PARAMETER ServerDir
  Path to the API/server folder containing package.json (default: ".\server")

.PARAMETER SchemaPath
  Path to prisma schema relative to ServerDir (default: "prisma\schema.prisma")

.PARAMETER MigrationName
  Name for prisma migrate dev (default: "add_group_endsOn")

.PARAMETER Backfill
  Switch: if set, backfills endsOn from endDate in Postgres.

.PARAMETER StartScript
  npm script to run after (default: "dev")

.EXAMPLE
  .\scripts\prisma-clean.ps1 -Backfill
#>

param(
  [string]$ServerDir    = ".\server",
  [string]$SchemaPath   = "prisma\schema.prisma",
  [string]$MigrationName = "add_group_endsOn",
  [switch]$Backfill,
  [string]$StartScript  = "dev"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}
function Write-Ok($msg) {
  Write-Host "✓ $msg" -ForegroundColor Green
}
function Write-Warn($msg) {
  Write-Host "! $msg" -ForegroundColor Yellow
}

# 0) Resolve paths
$serverFull = Resolve-Path $ServerDir
$schemaFull = Join-Path $serverFull $SchemaPath

# 1) Kill Node processes that may lock Prisma engines
Write-Step "Stopping Node processes (dev server, TS servers, etc.)"
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300
Write-Ok "Node processes stopped (if any)"

# 2) Remove generated Prisma client + engine artifacts
$prismaClientDir = Join-Path $serverFull "node_modules\.prisma\client"
$npmClientDir    = Join-Path $serverFull "node_modules\@prisma\client"
Write-Step "Removing generated Prisma artifacts"
Remove-Item -Recurse -Force $prismaClientDir -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $npmClientDir -ErrorAction SilentlyContinue
Write-Ok "Removed .prisma\client and @prisma\client (if present)"

# 3) npm install (server)
Write-Step "Running npm install in $serverFull"
Push-Location $serverFull
npm install
Write-Ok "npm install complete"

# 4) prisma generate
Write-Step "Running prisma generate"
npx prisma generate --schema $schemaFull
Write-Ok "prisma generate complete"

# 5) prisma migrate dev
Write-Step "Running prisma migrate dev --name $MigrationName"
npx prisma migrate dev --name $MigrationName --schema $schemaFull
Write-Ok "migration complete"

# 6) prisma generate again (ensure fresh client)
Write-Step "Re-running prisma generate"
npx prisma generate --schema $schemaFull
Write-Ok "second prisma generate complete"

# 7) Optional backfill endsOn from endDate (Postgres)
if ($Backfill) {
  Write-Step "Backfilling endsOn from endDate (Postgres)"
  $sql = @"
UPDATE "Group"
SET "endsOn" = "endDate"
WHERE "endsOn" IS NULL AND "endDate" IS NOT NULL;
"@
  # Pipe SQL to prisma db execute --stdin using PowerShell pipeline
  $sql | npx prisma db execute --stdin
  Write-Ok "Backfill executed"
}

# 8) Restart dev server
Write-Step "Starting npm run $StartScript"
npm run $StartScript
Pop-Location