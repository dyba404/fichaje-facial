# Descarga buffalo_l (insightface v0.7) y deja en models/ solo los 2 ONNX del pipeline.
# ADR-0002: los pesos son de uso NO comercial — solo demo/validación interna.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$models = Join-Path $root "models"
New-Item -ItemType Directory -Force -Path $models | Out-Null

$need = @("det_10g.onnx", "w600k_r50.onnx")
$missing = @($need | Where-Object { -not (Test-Path (Join-Path $models $_)) })
if ($missing.Count -eq 0) {
    Write-Host "Modelos ya presentes:"
    Get-ChildItem $models
    exit 0
}

$zip = Join-Path $env:TEMP "buffalo_l.zip"
if (-not (Test-Path $zip)) {
    Write-Host "Descargando buffalo_l.zip (~275 MB) desde insightface v0.7..."
    Invoke-WebRequest -Uri "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip" -OutFile $zip
}

$tmp = Join-Path $env:TEMP "buffalo_l_extract"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Write-Host "Extrayendo..."
Expand-Archive -Path $zip -DestinationPath $tmp -Force

foreach ($name in $need) {
    $src = Get-ChildItem -Path $tmp -Recurse -Filter $name | Select-Object -First 1
    if (-not $src) { throw "No se encontró $name dentro del zip" }
    Move-Item -Force $src.FullName (Join-Path $models $name)
}

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Remove-Item -Force $zip -ErrorAction SilentlyContinue

Write-Host "Modelos listos en $models :"
Get-ChildItem $models
