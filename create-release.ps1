# Script PowerShell para crear release automático de JKTV
# Uso: .\create-release.ps1 -Version "1.1.0" -Description "Descripción de cambios"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$Description = "Nueva versión"
)

Write-Host "🚀 Creando release v$Version..." -ForegroundColor Cyan

# 1. Verificar que no haya cambios sin commitear
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  Hay cambios sin commitear. Commiteando..." -ForegroundColor Yellow
    git add .
    git commit -m "Release v${Version}: $Description"
}

# 2. Push a main
Write-Host "📤 Subiendo a GitHub..." -ForegroundColor Cyan
git push origin main

# 3. Crear tag
Write-Host "🏷️  Creando tag v$Version..." -ForegroundColor Cyan
git tag "v$Version"
git push origin "v$Version"

Write-Host ""
Write-Host "✅ Tag creado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Ve a: https://github.com/luisjavierugaldea/JKTV/releases/new"
Write-Host "2. Selecciona el tag: v$Version"
Write-Host "3. Title: JKTV v$Version"
Write-Host "4. Description: $Description"
Write-Host "5. Arrastra el APK desde: frontend\android\app\build\outputs\apk\release\app-release.apk"
Write-Host "6. Click en 'Publish release'"
Write-Host ""
Write-Host "7. Copia la URL del APK (clic derecho en el archivo → Copiar dirección del enlace)"
Write-Host "8. Actualiza backend\routes\appVersion.js con la nueva URL:"
Write-Host "   downloadUrl: 'https://github.com/luisjavierugaldea/JKTV/releases/download/v$Version/app-release.apk'" -ForegroundColor Cyan
Write-Host ""

# Abrir GitHub Releases en navegador
Write-Host "🌐 Abriendo GitHub Releases..." -ForegroundColor Cyan
Start-Process "https://github.com/luisjavierugaldea/JKTV/releases/new"
