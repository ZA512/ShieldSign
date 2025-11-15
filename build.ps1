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
# Staging dossier pour garantir séparateurs POSIX dans l'archive
$chromeStaging = Join-Path $env:TEMP "${projectName}_chrome_staging"
if (Test-Path $chromeStaging) { Remove-Item $chromeStaging -Recurse -Force }
New-Item -ItemType Directory -Path $chromeStaging | Out-Null
foreach($item in $includeItems){
    Copy-Item $item -Destination $chromeStaging -Recurse -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$chromeZipFull = (Get-Item $outputDir).FullName + '\' + "${projectName}_v${version}_chrome.zip"
if (Test-Path $chromeZipFull) { Remove-Item $chromeZipFull -Force }
[IO.Compression.ZipFile]::Open($chromeZipFull, [IO.Compression.ZipArchiveMode]::Create).Dispose()
$zipStream = [System.IO.File]::Open($chromeZipFull, [System.IO.FileMode]::Open)
$zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $files = Get-ChildItem -Path $chromeStaging -Recurse -File
    foreach ($f in $files) {
        $relative = $f.FullName.Substring($chromeStaging.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $entryName = $relative -replace '\\','/'
        $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($f.FullName)
        try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose(); $entryStream.Dispose() }
    }
} finally {
    $zip.Dispose()
    $zipStream.Dispose()
}
Remove-Item $chromeStaging -Recurse -Force
$chromeSize = [math]::Round((Get-Item $chromeZip).Length / 1KB, 2)
Write-Host "[Chrome] Cree: $chromeSize KB" -ForegroundColor Green
Write-Host ""

# === PAQUET FIREFOX ===
Write-Host "[Firefox] Création du paquet..." -ForegroundColor Yellow

# Sauvegarder le manifest original
$originalManifest = "manifest.json"
$firefoxManifest = "manifest.firefox.json"
$manifestBackup = "manifest.backup.json"

Copy-Item $originalManifest $manifestBackup -Force
Copy-Item $firefoxManifest $originalManifest -Force

$firefoxZip = Join-Path $outputDir "${projectName}_v${version}_firefox.zip"
if (Test-Path $firefoxZip) { Remove-Item $firefoxZip -Force }
$firefoxStaging = Join-Path $env:TEMP "${projectName}_firefox_staging"
if (Test-Path $firefoxStaging) { Remove-Item $firefoxStaging -Recurse -Force }
New-Item -ItemType Directory -Path $firefoxStaging | Out-Null
foreach($item in $includeItems){
    Copy-Item $item -Destination $firefoxStaging -Recurse -Force
}
# Create zip via tar (works well) and also create .xpi via .NET API to ensure Firefox acceptance
# Create firefox zip using same ZIP writer to ensure consistent entries
$firefoxZipFull = (Get-Item $outputDir).FullName + '\' + "${projectName}_v${version}_firefox.zip"
if (Test-Path $firefoxZipFull) { Remove-Item $firefoxZipFull -Force }
[IO.Compression.ZipFile]::Open($firefoxZipFull, [IO.Compression.ZipArchiveMode]::Create).Dispose()
$zipStreamF = [System.IO.File]::Open($firefoxZipFull, [System.IO.FileMode]::Open)
$zipF = New-Object System.IO.Compression.ZipArchive($zipStreamF, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $files = Get-ChildItem -Path $firefoxStaging -Recurse -File
    foreach ($f in $files) {
        $relative = $f.FullName.Substring($firefoxStaging.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $entryName = $relative -replace '\\','/'
        $entry = $zipF.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($f.FullName)
        try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose(); $entryStream.Dispose() }
    }
} finally {
    $zipF.Dispose()
    $zipStreamF.Dispose()
}

# Also produce .xpi using a ZIP writer that normalizes entry names to use '/' (required by Firefox)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$firefoxXpi = Join-Path $outputDir "${projectName}_v${version}.xpi"
if (Test-Path $firefoxXpi) { Remove-Item $firefoxXpi -Force }

# Create zip archive with forward-slash entries
[IO.Compression.ZipFile]::Open($firefoxXpi, [IO.Compression.ZipArchiveMode]::Create).Dispose()
$zipStream = [System.IO.File]::Open($firefoxXpi, [System.IO.FileMode]::Open)
$zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $files = Get-ChildItem -Path $firefoxStaging -Recurse -File
    foreach ($f in $files) {
        $relative = $f.FullName.Substring($firefoxStaging.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
        $entryName = $relative -replace '\\','/'
        $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::OpenRead($f.FullName)
        try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose(); $entryStream.Dispose() }
    }
} finally {
    $zip.Dispose()
    $zipStream.Dispose()
}

Remove-Item $firefoxStaging -Recurse -Force
$firefoxSize = [math]::Round((Get-Item $firefoxZip).Length / 1KB, 2)
Write-Host "[Firefox] Cree: $firefoxSize KB (xpi: $firefoxXpi)" -ForegroundColor Green
# Restaurer le manifest original
Copy-Item $manifestBackup $originalManifest -Force
Remove-Item $manifestBackup -Force
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
