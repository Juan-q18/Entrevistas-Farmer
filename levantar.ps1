param(
  [switch]$SkipClient,
  [switch]$SkipServer,
  [switch]$Watch
)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'server'
$clientDir = Join-Path $root 'client'

function Free-Port($port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

function Test-Up($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $r.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Port-Listening($port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Start-ServerProc {
  Start-Process -FilePath "cmd" -ArgumentList "/c", "cd /d `"$serverDir`" && node src/index.js > `"$serverDir\..\server.out.log`" 2> `"$serverDir\..\server.err.log`"" -WindowStyle Hidden
}

function Ensure-Server {
  if (-not (Port-Listening 3001)) {
    Write-Host "[watchdog] server caído -> releyendo :3001" -ForegroundColor Yellow
    Start-ServerProc
  }
}

function Ensure-Client {
  if (-not (Port-Listening 5173)) {
    Write-Host "[watchdog] client caído -> releyendo :5173" -ForegroundColor Yellow
    Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -WindowStyle Hidden
  }
}

Write-Host "== Trabajo Farmer - arranque ==" -ForegroundColor Cyan

if (-not $SkipServer) {
  Write-Host "[server] liberando puerto 3001..." -ForegroundColor Yellow
  Free-Port 3001
  Write-Host "[server] iniciando node src/index.js..." -ForegroundColor Yellow
  Start-ServerProc
}

if (-not $SkipClient) {
  Write-Host "[client] liberando puerto 5173..." -ForegroundColor Yellow
  Free-Port 5173
  Write-Host "[client] iniciando npm run dev..." -ForegroundColor Yellow
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -WindowStyle Hidden
}

Write-Host "Verificando servicios..." -ForegroundColor Yellow
$serverOk = $false
$clientOk = $false
for ($i = 0; $i -lt 15; $i++) {
  if (-not $SkipServer -and -not $serverOk) {
    $serverOk = Test-Up "http://localhost:3001/api/health"
    if ($serverOk) { Write-Host "[server] OK http://localhost:3001" -ForegroundColor Green }
  }
  if (-not $SkipClient -and -not $clientOk) {
    $clientOk = Test-Up "http://localhost:5173/"
    if ($clientOk) { Write-Host "[client] OK http://localhost:5173" -ForegroundColor Green }
  }
  if (($SkipServer -or $serverOk) -and ($SkipClient -or $clientOk)) { break }
  Start-Sleep -Seconds 1
}

if (-not $SkipServer) {
  if ($serverOk) {
    Write-Host "[server] proxy check: $(Test-Up 'http://localhost:5173/api/health')" -ForegroundColor Green
  } else {
    Write-Host "[server] FALLO - no responde en :3001" -ForegroundColor Red
  }
}
if (-not $SkipClient) {
  if ($clientOk) {
    Write-Host "[client] listo: abrí http://localhost:5173" -ForegroundColor Green
  } else {
    Write-Host "[client] FALLO - no responde en :5173" -ForegroundColor Red
  }
}

if ($Watch) {
  Write-Host ""
  Write-Host "== Watchdog activo: supervisando :3001 y :5173 (Ctrl+C para salir) ==" -ForegroundColor Cyan
  while ($true) {
    if (-not $SkipServer) { Ensure-Server }
    if (-not $SkipClient) { Ensure-Client }
    Start-Sleep -Seconds 10
  }
}