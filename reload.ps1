# Script de rechargement de l'extension ShieldSign
# Pour appliquer les changements sans recharger manuellement

Write-Host "🔄 Rechargement de ShieldSign..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si Chrome est en cours d'exécution
$chromeProcess = Get-Process chrome -ErrorAction SilentlyContinue

if ($chromeProcess) {
    Write-Host "✓ Chrome est en cours d'exécution" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Pour recharger l'extension :" -ForegroundColor Yellow
    Write-Host "1. Allez sur chrome://extensions/"
    Write-Host "2. Cliquez sur le bouton '🔄' (Recharger) sous ShieldSign"
    Write-Host ""
    Write-Host "Ou utilisez le raccourci : Ctrl+R sur la page chrome://extensions/" -ForegroundColor Cyan
} else {
    Write-Host "❌ Chrome n'est pas en cours d'exécution" -ForegroundColor Red
    Write-Host "Lancez Chrome et chargez l'extension avec test.ps1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Astuce : Installez l'extension 'Extensions Reloader' pour recharger rapidement !" -ForegroundColor Cyan
Write-Host "   https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid" -ForegroundColor Gray
