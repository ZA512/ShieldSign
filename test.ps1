# Script de test rapide pour ShieldSign
# Ouvre tous les domaines de la liste officielle dans Firefox (ou Chrome)

param(
    [switch]$Chrome,
    [int]$Delay = 2
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  🛡️  ShieldSign - Test Firefox" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Charger la liste des domaines
$jsonPath = ".\shieldsign_public_list_v1.json"
if (-not (Test-Path $jsonPath)) {
    Write-Host "❌ Erreur: $jsonPath introuvable!" -ForegroundColor Red
    exit 1
}

$json = Get-Content $jsonPath | ConvertFrom-Json
$domains = $json.domains | Select-Object -Unique

Write-Host "📋 Domaines trouvés: $($domains.Count)" -ForegroundColor Green
Write-Host "⏱️  Délai entre les ouvertures: $Delay secondes" -ForegroundColor Gray
Write-Host ""

# Détecter le navigateur
if ($Chrome) {
    $browserName = "Chrome"
    $browserPaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
} else {
    $browserName = "Firefox"
    $browserPaths = @(
        "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
        "$env:ProgramFiles(x86)\Mozilla Firefox\firefox.exe"
    )
}

$browserPath = $browserPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browserPath) {
    Write-Host "❌ Erreur: $browserName introuvable!" -ForegroundColor Red
    Write-Host "Chemins vérifiés:" -ForegroundColor Yellow
    $browserPaths | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    exit 1
}

Write-Host "🌐 Navigateur: $browserPath" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Assurez-vous d'avoir chargé l'extension dans $browserName avant de continuer!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur ENTER pour commencer le test..." -ForegroundColor Cyan
Read-Host

$count = 0
foreach ($domain in $domains) {
    $count++
    $url = "https://$domain"
    
    Write-Host "[$count/$($domains.Count)] 🔗 $url" -ForegroundColor Cyan
    
    Start-Process -FilePath $browserPath -ArgumentList $url
    
    if ($count -lt $domains.Count) {
        Start-Sleep -Seconds $Delay
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  ✅ Test terminé!" -ForegroundColor Green
Write-Host "  $count onglets ouverts" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Vérifiez que le banner ShieldSign s'affiche sur les pages avec champ mot de passe" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Astuce: Utilisez -Chrome pour tester avec Chrome au lieu de Firefox" -ForegroundColor Gray
Write-Host "   Exemple: .\test.ps1 -Chrome -Delay 1" -ForegroundColor Gray
