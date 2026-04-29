#!/bin/bash
# Script para crear release automático de JKTV
# Uso: ./create-release.sh 1.1.0 "Descripción de los cambios"

VERSION=$1
DESCRIPTION=$2

if [ -z "$VERSION" ]; then
  echo "❌ Error: Debes proporcionar una versión"
  echo "Uso: ./create-release.sh 1.1.0 'Descripción de cambios'"
  exit 1
fi

echo "🚀 Creando release v$VERSION..."

# 1. Verificar que no haya cambios sin commitear
if [[ -n $(git status -s) ]]; then
  echo "⚠️  Hay cambios sin commitear. Commiteando..."
  git add .
  git commit -m "Release v$VERSION: $DESCRIPTION"
fi

# 2. Push a main
echo "📤 Subiendo a GitHub..."
git push origin main

# 3. Crear tag
echo "🏷️  Creando tag v$VERSION..."
git tag "v$VERSION"
git push origin "v$VERSION"

echo ""
echo "✅ Tag creado exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Ve a: https://github.com/luisjavierugaldea/JKTV/releases/new"
echo "2. Selecciona el tag: v$VERSION"
echo "3. Title: JKTV v$VERSION"
echo "4. Description: $DESCRIPTION"
echo "5. Arrastra el APK desde: frontend/android/app/build/outputs/apk/release/app-release.apk"
echo "6. Publish release"
echo ""
echo "7. Copia la URL del APK (clic derecho en el archivo)"
echo "8. Actualiza backend/routes/appVersion.js con la nueva URL"
echo ""
