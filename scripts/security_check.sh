#!/usr/bin/env bash
set -e

# ==============================================================================
# Script de Auditoría de Seguridad Local - P2P Reconciliation Ledger
# ==============================================================================

echo "🔍 Iniciando chequeos de seguridad locales..."
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1. Chequeo de permisos en archivos sensibles
echo ""
echo "📁 1. Verificando permisos de base de datos y respaldos..."
DB_FILE="$ROOT_DIR/backend/p2p_reconciliation.db"
if [ -f "$DB_FILE" ]; then
    chmod 600 "$DB_FILE"
    echo "  ✅ Permisos de '$DB_FILE' asegurados a 600 (lectura/escritura exclusiva del usuario)."
else
    echo "  ℹ️ Base de datos local no encontrada aún (se creará en primer arranque)."
fi

BACKUPS_DIR="$ROOT_DIR/backend/backups"
if [ -d "$BACKUPS_DIR" ]; then
    chmod 700 "$BACKUPS_DIR"
    echo "  ✅ Permisos de directorio '$BACKUPS_DIR' asegurados a 700."
fi

# 2. Búsqueda de secretos o credenciales expuestas en el repositorio
echo ""
echo "🔑 2. Buscando posibles credenciales o claves expuestas..."
SUSPICIOUS=$(grep -rnE "(binance.*api[_-]?secret|jwt_secret|private_key|secret_key)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]" "$ROOT_DIR" \
    --exclude-dir={.git,node_modules,.venv,dist,build,graphify-out} \
    --exclude={.env.example,SECURITY.md,*.jsonl} || true)

if [ -n "$SUSPICIOUS" ]; then
    echo "  ⚠️ Se encontraron posibles secretos codificados:"
    echo "$SUSPICIOUS"
else
    echo "  ✅ No se detectaron secretos ni API keys hardcodeadas en código fuente rastreado."
fi

# 3. Auditoría de dependencias Node.js si npm está disponible
echo ""
echo "📦 3. Auditoría de dependencias frontend (npm)..."
if command -v npm &> /dev/null; then
    (cd "$ROOT_DIR/frontend" && npm audit --audit-level=high) || true
    echo "  ✅ Auditoría npm ejecutada."
else
    echo "  ℹ️ npm no disponible en el entorno actual. Se validará automáticamente en CI/GitHub Actions."
fi

# 4. Auditoría de dependencias Python si pip-audit está disponible
echo ""
echo "🐍 4. Auditoría de dependencias backend (Python)..."
if command -v pip-audit &> /dev/null; then
    pip-audit -r "$ROOT_DIR/backend/requirements.txt" || true
    echo "  ✅ Auditoría pip ejecutada."
else
    echo "  ℹ️ pip-audit no instalado localmente. Se validará automáticamente en CI/GitHub Actions."
fi

echo ""
echo "✨ Chequeo de seguridad completado."
