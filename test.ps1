# Script de test rapide pour ShieldSign
# Charge l'extension dans Chrome et ouvre des pages de test

Write-Host "🛡️  ShieldSign - Script de test" -ForegroundColor Cyan
Write-Host ""

# Vérifier si Chrome est installé
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $chromePath)) {
    Write-Host "❌ Chrome n'est pas installé ou n'a pas été trouvé" -ForegroundColor Red
    Write-Host "Veuillez charger manuellement l'extension dans chrome://extensions/" -ForegroundColor Yellow
    exit
}

# Chemin de l'extension
$extensionPath = $PSScriptRoot

Write-Host "📂 Chemin de l'extension : $extensionPath" -ForegroundColor Green
Write-Host ""

# Instructions
Write-Host "📋 Instructions :" -ForegroundColor Yellow
Write-Host "1. Chrome va s'ouvrir avec la page chrome://extensions/"
Write-Host "2. Activez le 'Mode développeur' (toggle en haut à droite)"
Write-Host "3. Cliquez sur 'Charger l'extension non empaquetée'"
Write-Host "4. Sélectionnez le dossier : $extensionPath"
Write-Host ""

# Demander confirmation
$response = Read-Host "Appuyez sur Entrée pour ouvrir Chrome..."

# Ouvrir Chrome avec la page des extensions
Start-Process $chromePath "chrome://extensions/"

Write-Host ""
Write-Host "✅ Chrome ouvert !" -ForegroundColor Green
Write-Host ""

# Attendre un peu
Start-Sleep -Seconds 3

# Proposer d'ouvrir des pages de test
Write-Host "🧪 Voulez-vous ouvrir des pages de test ? (o/n)" -ForegroundColor Cyan
$testResponse = Read-Host

if ($testResponse -eq "o" -or $testResponse -eq "O") {
    Write-Host ""
    Write-Host "📝 Ouverture des pages de test..." -ForegroundColor Green
    
    # Liste des pages de test
    $testPages = @(
        "https://accounts.google.com",
        "https://login.microsoftonline.com",
        "https://www.facebook.com",
        "https://github.com/login"
    )
    
    foreach ($page in $testPages) {
        Write-Host "  → $page" -ForegroundColor Gray
        Start-Process $chromePath $page
        Start-Sleep -Milliseconds 500
    }
    
    Write-Host ""
    Write-Host "✨ Pages de test ouvertes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔍 Comportement attendu :" -ForegroundColor Yellow
    Write-Host "  • Google, Microsoft, Facebook : Bandeau bleu 'Page validée par...'"
    Write-Host "  • GitHub : Pas de bandeau (cliquez sur l'icône ShieldSign pour approuver)"
    Write-Host ""
}

Write-Host "📖 Consultez TESTING.md pour plus d'informations sur les tests" -ForegroundColor Cyan
Write-Host ""
Write-Host "Terminé ! 🎉" -ForegroundColor Green
