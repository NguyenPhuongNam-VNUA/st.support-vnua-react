# Script tải trực tiếp các model Hugging Face về core-ai/models
param (
    [string]$OutputDir = "models"
)

$ErrorActionPreference = "Stop"

# Chuyển về thư mục core-ai
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CoreAiDir = Split-Path -Parent $ScriptDir
Set-Location $CoreAiDir

Write-Host "=== TẢI CÁC MODEL TỪ HUGGING FACE CHO ST-CARE CORE-AI ===" -ForegroundColor Cyan

$TargetDir = Join-Path $CoreAiDir $OutputDir
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$Models = @(
    @{
        Name = "Prompt Guard (Meta Llama)";
        RepoId = "meta-llama/Llama-Prompt-Guard-2-86M";
        Folder = "Llama-Prompt-Guard-2-86M"
    },
    @{
        Name = "Reranker (BGE Reranker v2 M3)";
        RepoId = "BAAI/bge-reranker-v2-m3";
        Folder = "bge-reranker-v2-m3"
    }
)

foreach ($model in $Models) {
    $Dest = Join-Path $TargetDir $model.Folder
    Write-Host "`n>> Đang tải: $($model.Name)" -ForegroundColor Yellow
    Write-Host "   Repo: $($model.RepoId)"
    Write-Host "   Lưu tại: $Dest"

    # Sử dụng hf CLI thông qua uv run
    uv run hf download $model.RepoId --local-dir $Dest

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   -> Thành công: $($model.Name)!" -ForegroundColor Green
    } else {
        Write-Host "   -> Có lỗi khi tải $($model.Name). Lưu ý model Meta yêu cầu chấp nhận License trên Hugging Face!" -ForegroundColor Red
    }
}

Write-Host "`n=== HOÀN TẤT TẢI CÁC MODEL ===" -ForegroundColor Cyan
