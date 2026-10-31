param(
    [ValidateSet('start', 'stop')]
    [string]$Task = 'start'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot
try {
    switch ($Task) {
        'start' {
            docker desktop start --timeout 180
            if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop did not start' }
            # --build reuses the layer cache, so unchanged services keep their containers.
            docker compose --profile monitoring up -d --build --wait --wait-timeout 300
            if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
        }
        'stop' {
            # Name filter also covers containers started from core-ai/compose.yaml.
            $containers = docker ps -q --filter 'name=stcare-'
            if ($LASTEXITCODE -ne 0) { Write-Warning 'docker ps failed, skipping containers' }
            if ($containers) { docker stop $containers }
            # Dev servers started outside Docker hold the same ports.
            Get-NetTCPConnection -State Listen -LocalPort 3000, 5001 -ErrorAction SilentlyContinue |
                ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
                Where-Object Name -in 'node', 'python', 'uvicorn' |
                Stop-Process -Force
        }
    }
} finally {
    Pop-Location
}
