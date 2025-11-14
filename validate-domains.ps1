<#
.SYNOPSIS
    Script de validation des domaines de la liste ShieldSign

.DESCRIPTION
    Ce script vérifie chaque domaine de la liste pour :
    1. Vérifier l'accessibilité (HTTP/HTTPS)
    2. Détecter la présence d'un champ password
    3. Valider la légitimité via certificat SSL
    4. Vérifier les redirections et URL finales
    5. Détecter les anomalies de sécurité

.PARAMETER OutputFile
    Fichier JSON de sortie avec les résultats détaillés

.PARAMETER CheckCertificate
    Active la validation approfondie des certificats SSL

.EXAMPLE
    .\validate-domains.ps1
    .\validate-domains.ps1 -OutputFile "validation_results.json" -CheckCertificate
#>

param(
    [string]$InputFile = ".\shieldsign_public_list_v1.json",
    [string]$OutputFile = ".\domain_validation_report.json",
    [switch]$CheckCertificate = $true,
    [int]$TimeoutSeconds = 15,
    [switch]$Verbose
)

# Couleurs pour l'affichage
$script:ColorOK = "Green"
$script:ColorWarning = "Yellow"
$script:ColorError = "Red"
$script:ColorInfo = "Cyan"

# Fonction pour afficher un message avec timestamp
function Write-Log {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

# Fonction pour vérifier le certificat SSL
function Test-SSLCertificate {
    param(
        [string]$Domain
    )
    
    $result = @{
        IsValid = $false
        Issuer = $null
        Subject = $null
        ValidFrom = $null
        ValidTo = $null
        DaysUntilExpiry = $null
        IsTrusted = $false
        Warnings = @()
    }
    
    try {
        $uri = "https://$Domain"
        $request = [System.Net.HttpWebRequest]::Create($uri)
        $request.Timeout = $TimeoutSeconds * 1000
        $request.AllowAutoRedirect = $false
        
        try {
            $response = $request.GetResponse()
            $response.Close()
        } catch {
            # Même en cas d'erreur HTTP, on peut avoir accès au certificat
        }
        
        if ($request.ServicePoint.Certificate) {
            $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]$request.ServicePoint.Certificate
            
            $result.IsValid = $true
            $result.Issuer = $cert.Issuer
            $result.Subject = $cert.Subject
            $result.ValidFrom = $cert.NotBefore
            $result.ValidTo = $cert.NotAfter
            $result.DaysUntilExpiry = ($cert.NotAfter - (Get-Date)).Days
            
            # Vérifier la chaîne de confiance
            $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
            $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
            $result.IsTrusted = $chain.Build($cert)
            
            # Warnings
            if ($result.DaysUntilExpiry -lt 30) {
                $result.Warnings += "Certificat expire dans $($result.DaysUntilExpiry) jours"
            }
            
            if (-not $result.IsTrusted) {
                $result.Warnings += "Chaîne de confiance non validée"
            }
            
            # Vérifier que le domaine correspond au certificat
            $certDomains = @($cert.Subject -replace "CN=", "" -split ",")[0]
            if ($cert.DnsNameList) {
                $certDomains = $cert.DnsNameList.Unicode -join ", "
            }
            
            if ($certDomains -notmatch [regex]::Escape($Domain)) {
                $result.Warnings += "Le domaine ne correspond pas exactement au certificat: $certDomains"
            }
        }
        
    } catch {
        $result.Warnings += "Erreur lors de la vérification du certificat: $($_.Exception.Message)"
    }
    
    return $result
}

# Regex pour détecter un champ password (insensible à la casse)
$passwordRegex = '(?i)<input[^>]*type\s*=\s*["'']password["''][^>]*>'

# Fonction pour tester un domaine avec Selenium/navigateur headless simulation
function Test-DomainWithPasswordField {
    param(
        [string]$Domain
    )
    
    $result = @{
        Domain = $Domain
        Status = "UNKNOWN"
        IsAccessible = $false
        HasPasswordField = $false
        FinalURL = $null
        HTTPStatus = $null
        RedirectCount = 0
        ResponseTime = $null
        ContentType = $null
        HasHTTPS = $false
        Certificate = $null
        Errors = @()
        Warnings = @()
    }
    
    Write-Log "Test de: $Domain" -Color $script:ColorInfo
    
    # Mesurer le temps de réponse
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        # Tester HTTPS d'abord
        $url = "https://$Domain"
        
        # Créer une requête web
        $request = [System.Net.HttpWebRequest]::Create($url)
        $request.Timeout = $TimeoutSeconds * 1000
        $request.AllowAutoRedirect = $true
        $request.MaximumAutomaticRedirections = 10
        $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ShieldSign-Validator/1.0"
        
        # Obtenir la réponse
        try {
            $response = $request.GetResponse()
            $result.IsAccessible = $true
            $result.HasHTTPS = $true
            $result.HTTPStatus = [int]$response.StatusCode
            $result.FinalURL = $response.ResponseUri.ToString()
            $result.ContentType = $response.ContentType
            
            # Compter les redirections
            if ($result.FinalURL -ne $url) {
                $result.RedirectCount = 1  # Approximation
                $result.Warnings += "Redirection vers: $($result.FinalURL)"
            }
            
            # Lire le contenu HTML
            $stream = $response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $html = $reader.ReadToEnd()
            $reader.Close()
            $response.Close()
            
            # Chercher les champs password dans le HTML (regex pré-compilée)
            if ($html -match $passwordRegex) {
                $result.HasPasswordField = $true
                $result.Status = "OK"
                Write-Log "  ✓ Champ password détecté" -Color $script:ColorOK
            } else {
                $result.Status = "NO_PASSWORD"
                $result.Warnings += "Aucun champ password détecté dans le HTML"
                Write-Log "  ⚠ Pas de champ password" -Color $script:ColorWarning
            }
            
        } catch {
            # Si HTTPS échoue, essayer HTTP
            $result.Errors += "HTTPS failed: $($_.Exception.Message)"
            
            try {
                $url = "http://$Domain"
                $request = [System.Net.HttpWebRequest]::Create($url)
                $request.Timeout = $TimeoutSeconds * 1000
                $request.AllowAutoRedirect = $true
                $request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ShieldSign-Validator/1.0"
                
                $response = $request.GetResponse()
                $result.IsAccessible = $true
                $result.HasHTTPS = $false
                $result.HTTPStatus = [int]$response.StatusCode
                $result.FinalURL = $response.ResponseUri.ToString()
                $result.Warnings += "HTTPS non disponible, utilise HTTP (INSECURE!)"
                
                $stream = $response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $html = $reader.ReadToEnd()
                $reader.Close()
                $response.Close()
                
                if ($html -match $passwordRegex) {
                    $result.HasPasswordField = $true
                    $result.Status = "INSECURE"
                    $result.Warnings += "Champ password sur HTTP non sécurisé!"
                    Write-Log "  ⚠ Champ password sur HTTP (INSECURE)" -Color $script:ColorWarning
                } else {
                    $result.Status = "NO_PASSWORD"
                    Write-Log "  ⚠ Pas de champ password" -Color $script:ColorWarning
                }
                
            } catch {
                $result.Status = "UNREACHABLE"
                $result.Errors += "HTTP failed: $($_.Exception.Message)"
                Write-Log "  ✗ Domaine inaccessible" -Color $script:ColorError
            }
        }
        
        # Vérifier le certificat SSL si HTTPS fonctionne
        if ($result.HasHTTPS -and $CheckCertificate) {
            Write-Log "  Vérification du certificat SSL..." -Color $script:ColorInfo
            $certInfo = Test-SSLCertificate -Domain $Domain
            $result.Certificate = $certInfo
            
            if ($certInfo.IsValid) {
                Write-Log "  ✓ Certificat valide (expire dans $($certInfo.DaysUntilExpiry) jours)" -Color $script:ColorOK
            }
            
            foreach ($warning in $certInfo.Warnings) {
                $result.Warnings += "Certificate: $warning"
                Write-Log "  ⚠ $warning" -Color $script:ColorWarning
            }
        }
        
    } catch {
        $result.Status = "ERROR"
        $result.Errors += $_.Exception.Message
        Write-Log "  ✗ Erreur: $($_.Exception.Message)" -Color $script:ColorError
    }
    
    $stopwatch.Stop()
    $result.ResponseTime = $stopwatch.ElapsedMilliseconds
    
    return $result
}

# Fonction principale
function Start-DomainValidation {
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log "  ShieldSign Domain Validator" -Color $script:ColorInfo
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log ""
    
    # Charger le fichier JSON
    if (-not (Test-Path $InputFile)) {
        Write-Log "Erreur: Fichier $InputFile introuvable" -Color $script:ColorError
        return
    }
    
    $listData = Get-Content $InputFile -Raw | ConvertFrom-Json
    $domains = $listData.domains | Select-Object -Unique
    
    Write-Log "Domaines à tester: $($domains.Count)" -Color $script:ColorInfo
    Write-Log "Timeout par domaine: $TimeoutSeconds secondes" -Color $script:ColorInfo
    Write-Log "Vérification SSL: $CheckCertificate" -Color $script:ColorInfo
    Write-Log ""
    
    # Tester chaque domaine
    $results = @()
    $stats = @{
        Total = $domains.Count
        OK = 0
        NoPassword = 0
        Unreachable = 0
        Insecure = 0
        Error = 0
    }
    
    $current = 0
    foreach ($domain in $domains) {
        $current++
        Write-Log "[$current/$($domains.Count)] ───────────────────────────────────────" -Color $script:ColorInfo
        
        $result = Test-DomainWithPasswordField -Domain $domain
        $results += $result
        
        # Statistiques
        switch ($result.Status) {
            "OK" { $stats.OK++ }
            "NO_PASSWORD" { $stats.NoPassword++ }
            "UNREACHABLE" { $stats.Unreachable++ }
            "INSECURE" { $stats.Insecure++ }
            "ERROR" { $stats.Error++ }
        }
        
        Write-Log ""
    }
    
    # Rapport final
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log "  RAPPORT FINAL" -Color $script:ColorInfo
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log ""
    Write-Log "Total de domaines testés: $($stats.Total)" -Color $script:ColorInfo
    Write-Log "  ✓ OK (HTTPS + password):      $($stats.OK)" -Color $script:ColorOK
    Write-Log "  ⚠ Pas de password:            $($stats.NoPassword)" -Color $script:ColorWarning
    Write-Log "  ⚠ Insecure (HTTP):            $($stats.Insecure)" -Color $script:ColorWarning
    Write-Log "  ✗ Inaccessible:               $($stats.Unreachable)" -Color $script:ColorError
    Write-Log "  ✗ Erreur:                     $($stats.Error)" -Color $script:ColorError
    Write-Log ""
    
    # Sauvegarder le rapport JSON
    $report = @{
        GeneratedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        SourceFile = $InputFile
        Statistics = $stats
        Results = $results
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File $OutputFile -Encoding UTF8
    Write-Log "Rapport détaillé sauvegardé: $OutputFile" -Color $script:ColorOK
    
    # Afficher les domaines problématiques
    Write-Log ""
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log "  DOMAINES À VÉRIFIER MANUELLEMENT" -Color $script:ColorInfo
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log ""
    
    $problematic = $results | Where-Object { $_.Status -ne "OK" }
    
    if ($problematic.Count -eq 0) {
        Write-Log "Aucun problème détecté! Tous les domaines sont valides." -Color $script:ColorOK
    } else {
        foreach ($item in $problematic) {
            Write-Log "$($item.Domain) - Status: $($item.Status)" -Color $script:ColorWarning
            if ($item.FinalURL -and $item.FinalURL -ne "https://$($item.Domain)") {
                Write-Log "  → Redirige vers: $($item.FinalURL)" -Color $script:ColorInfo
            }
            foreach ($warning in $item.Warnings) {
                Write-Log "  ⚠ $warning" -Color $script:ColorWarning
            }
            foreach ($error in $item.Errors) {
                Write-Log "  ✗ $error" -Color $script:ColorError
            }
            Write-Log ""
        }
    }
    
    # Suggestions de nettoyage
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log "  SUGGESTIONS DE NETTOYAGE" -Color $script:ColorInfo
    Write-Log "═══════════════════════════════════════════════════════" -Color $script:ColorInfo
    Write-Log ""
    
    $toRemove = $results | Where-Object { $_.Status -in @("UNREACHABLE", "ERROR") }
    if ($toRemove.Count -gt 0) {
        Write-Log "Domaines à supprimer de la liste (inaccessibles):" -Color $script:ColorWarning
        foreach ($item in $toRemove) {
            Write-Log "  - $($item.Domain)" -Color $script:ColorError
        }
        Write-Log ""
    }
    
    $toUpdate = $results | Where-Object { $_.Status -eq "NO_PASSWORD" -and $_.FinalURL }
    if ($toUpdate.Count -gt 0) {
        Write-Log "Domaines à mettre à jour (redirections):" -Color $script:ColorWarning
        foreach ($item in $toUpdate) {
            $finalDomain = ([System.Uri]$item.FinalURL).Host
            if ($finalDomain -ne $item.Domain) {
                Write-Log "  - $($item.Domain) → $finalDomain" -Color $script:ColorInfo
            }
        }
    }
}

# Lancer la validation
Start-DomainValidation
