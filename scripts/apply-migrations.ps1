# Applies every SQL file in supabase/migrations to your Supabase project.
#
# Uses the Supabase Management API over HTTPS, so it needs no psql, no Docker
# and no open Postgres port -- only a personal access token.
#
#   1. Dashboard -> Account Preferences -> API Tokens -> Generate token
#   2. $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#   3. powershell -ExecutionPolicy Bypass -File .\scripts\apply-migrations.ps1
#
# The token is read from the environment and is never written to disk.

$ErrorActionPreference = "Stop"

$projectRef = if ($env:SUPABASE_PROJECT_REF) {
    $env:SUPABASE_PROJECT_REF
} else {
    "buazpscpiufcndssxgyi"
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
    throw "SUPABASE_ACCESS_TOKEN is not set. Create a token at Dashboard > Account Preferences > API Tokens, then run: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'"
}

$headers = @{ Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN" }
$queryUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$migrationDir = Join-Path $PSScriptRoot "..\supabase\migrations"
if (-not (Test-Path $migrationDir)) {
    throw "Cannot find supabase/migrations relative to $PSScriptRoot"
}

# 001_initial_schema.sql is intentionally empty; skip blank files.
$files = Get-ChildItem $migrationDir -Filter *.sql -File |
    Sort-Object { $_.Name }

Write-Host "Project : $projectRef" -ForegroundColor Cyan
Write-Host "Applying $($files.Count) migration files...`n" -ForegroundColor Cyan

$failed = @()

foreach ($file in $files) {
    $sql = Get-Content $file.FullName -Raw
    if ([string]::IsNullOrWhiteSpace($sql)) {
        Write-Host "SKIP  $($file.Name) (empty)" -ForegroundColor DarkGray
        continue
    }

    Write-Host "RUN   $($file.Name)" -NoNewline
    $body = @{ query = $sql } | ConvertTo-Json -Depth 3

    try {
        Invoke-RestMethod -Uri $queryUrl -Method Post -Body $body `
            -ContentType "application/json" -Headers $headers -TimeoutSec 180 | Out-Null
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED" -ForegroundColor Red
        Write-Host "       $($_.ErrorDetails.Message)" -ForegroundColor Red
        # Keep going: one bad file should not block the rest.
        $failed += $file.Name
    }
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "Completed with $($failed.Count) failure(s):" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Note: 005_customer_ordering.sql uses bare CREATE POLICY without" -ForegroundColor Yellow
    Write-Host "DROP POLICY IF EXISTS, so it fails if applied twice. Before" -ForegroundColor Yellow
    Write-Host "retrying it, drop those policies first:" -ForegroundColor Yellow
    Write-Host '  drop policy if exists "Customers can view active shops" on public.customer_shops;' -ForegroundColor DarkGray
    Write-Host '  drop policy if exists "Customers can view active products" on public.customer_products;' -ForegroundColor DarkGray
    Write-Host '  drop policy if exists "Customers can view their orders" on public.customer_orders;' -ForegroundColor DarkGray
    Write-Host '  drop policy if exists "Customers can view their order items" on public.customer_order_items;' -ForegroundColor DarkGray
    exit 1
}

Write-Host "All migrations applied." -ForegroundColor Green

# Confirm the tables this project depends on now exist.
$publishable = (Get-Content (Join-Path $PSScriptRoot "..\.env") |
        Select-String "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") -replace '.*=\s*', ''
$projectUrl = ((Get-Content (Join-Path $PSScriptRoot "..\.env") |
        Select-String "EXPO_PUBLIC_SUPABASE_URL") -replace '.*=\s*', '').TrimEnd('/')

$expected = @(
    "shops", "products", "reviews", "favourites", "search_history", "reports",
    "customer_shops", "customer_products", "customer_orders", "customer_order_items",
    "settlement_batches", "node_metrics", "report_manifests", "dispatch_settings"
)

Write-Host "`nVerifying tables..." -ForegroundColor Cyan
$missing = @()
foreach ($table in $expected) {
    try {
        Invoke-WebRequest -Uri "$projectUrl/rest/v1/$table`?select=*&limit=1" `
            -Headers @{ apikey = $publishable; Authorization = "Bearer $publishable" } `
            -TimeoutSec 30 -UseBasicParsing | Out-Null
        Write-Host "  ok    $table" -ForegroundColor Green
    } catch {
        Write-Host "  MISS  $table" -ForegroundColor Red
        $missing += $table
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`nStill missing: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "`nAll expected tables exist. Restart the dev server (`npx expo start -c`) and reload the screens." -ForegroundColor Green