# Script de création des paquets pour Chrome Web Store et Firefox Add-ons

$ErrorActionPreference = "Stop"

# Version depuis manifest.json
$manifest = Get-Content manifest.json | ConvertFrom-Json
$version = $manifest.version
$projectName = "ShieldSign"

# Créer le dossier releases
$outputDir = ".\releases"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Création des paquets $projectName" -ForegroundColor Cyan
Write-Host "  Version: $version" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Fichiers à inclure
$includeItems = @(
    "manifest.json",
    "background.js",
    "content.js",
    "icons",
    "popup",
    "options",
    "_locales",
    "schemas",
    "shieldsign_public_list_v1.json"
)

# === PAQUET CHROME ===
Write-Host "[Chrome] Création du paquet..." -ForegroundColor Yellow
$chromeZip = Join-Path $outputDir "${projectName}_v${version}_chrome.zip"
if (Test-Path $chromeZip) { Remove-Item $chromeZip -Force }
Compress-Archive -Path $includeItems -DestinationPath $chromeZip -CompressionLevel Optimal
$chromeSize = [math]::Round((Get-Item $chromeZip).Length / 1KB, 2)
Write-Host "[Chrome] ✓ Créé: $chromeSize KB" -ForegroundColor Green
Write-Host ""

# === PAQUET FIREFOX ===
Write-Host "[Firefox] Création du paquet..." -ForegroundColor Yellow

# Sauvegarder le manifest original
$originalManifest = "manifest.json"
$firefoxManifest = "manifest.firefox.json"
$manifestBackup = "manifest.backup.json"

Copy-Item $originalManifest $manifestBackup -Force
Copy-Item $firefoxManifest $originalManifest -Force

try {
    $firefoxZip = Join-Path $outputDir "${projectName}_v${version}_firefox.zip"
    if (Test-Path $firefoxZip) { Remove-Item $firefoxZip -Force }
    Compress-Archive -Path $includeItems -DestinationPath $firefoxZip -CompressionLevel Optimal
    $firefoxSize = [math]::Round((Get-Item $firefoxZip).Length / 1KB, 2)
    Write-Host "[Firefox] ✓ Créé: $firefoxSize KB" -ForegroundColor Green
} finally {
    # Restaurer le manifest original
    Copy-Item $manifestBackup $originalManifest -Force
    Remove-Item $manifestBackup -Force
}
Write-Host ""

# === RÉSUMÉ ===
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Paquets créés avec succès!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Chrome: $chromeZip ($chromeSize KB)"
Write-Host "Firefox: $firefoxZip ($firefoxSize KB)"
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Tester sur Firefox: about:debugging > This Firefox > Load Temporary Add-on"
Write-Host "  2. Chrome Web Store: https://chrome.google.com/webstore/devconsole"
Write-Host "  3. Firefox Add-ons: https://addons.mozilla.org/developers/"
