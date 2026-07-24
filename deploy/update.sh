#!/bin/bash
# ============================================
# update.sh — Mise à jour ImpotBO depuis GitHub
# Usage: ./update.sh
# ============================================
set -e

APP_DIR="/var/www/impuestos-bo"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN $1${NC}"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERR $1${NC}"; exit 1; }

echo ""
echo "========================================"
echo "   ImpotBO - Mise à jour depuis GitHub"
echo "========================================"
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -d "$APP_DIR" ]; then
  error "Répertoire $APP_DIR introuvable"
fi

log "Sauvegarde du .env backend..."
cp "$APP_DIR/backend/.env" "/tmp/impotbo_env_backup" 2>/dev/null || warn ".env non trouvé, ignoré"

log "Récupération des mises à jour depuis GitHub..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main
log "Code mis à jour depuis GitHub"

# Restaurer le .env (jamais dans Git)
if [ -f "/tmp/impotbo_env_backup" ]; then
  cp "/tmp/impotbo_env_backup" "$APP_DIR/backend/.env"
  log ".env backend restauré"
fi

log "Mise à jour des dépendances backend..."
cd "$APP_DIR/backend"
npm install --omit=dev --quiet
log "Dépendances backend OK"

log "Exécution des migrations de base de données..."
npm run db:init
log "Base de données à jour"

log "Redémarrage du backend via PM2..."
pm2 reload impuestos-backend --update-env
log "Backend redémarré"

log "Build du frontend..."
cd "$APP_DIR/frontend"
npm install --quiet
npm run build
log "Frontend buildé avec succès"

log "Rechargement de Nginx..."
sudo nginx -s reload
log "Nginx rechargé"

echo ""
echo "========================================"
echo "  Mise à jour terminée avec succès !"
echo "========================================"
echo ""
pm2 status impuestos-backend
