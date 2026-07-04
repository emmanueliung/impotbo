#!/bin/bash
# =============================================================
# deploy.sh — Script de déploiement VPS pour ImpotBO
# =============================================================
# Usage:
#   ./deploy/deploy.sh           → mise à jour normale
#   ./deploy/deploy.sh --initial → premier déploiement
# =============================================================

set -e  # Arrêter si une commande échoue

# ── Configuration ─────────────────────────────────────────
APP_DIR="/var/www/impotbo"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
SERVICE_NAME="impotbo"
NGINX_CONF="/etc/nginx/sites-available/impotbo"
NGINX_ENABLED="/etc/nginx/sites-enabled/impotbo"
NODE_USER="www-data"

# Couleurs pour les logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log()    { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✔ $1${NC}"; }
warn()   { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠ $1${NC}"; }
error()  { echo -e "${RED}[$(date '+%H:%M:%S')] ✘ $1${NC}"; exit 1; }

# ── Vérifications ─────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Ce script doit être exécuté en tant que root (sudo ./deploy/deploy.sh)"
fi

INITIAL=false
if [ "$1" == "--initial" ]; then
  INITIAL=true
  log "Mode: Installation initiale"
else
  log "Mode: Mise à jour"
fi

# ── INSTALLATION INITIALE ──────────────────────────────────
if [ "$INITIAL" = true ]; then

  log "Mise à jour du système..."
  apt-get update -qq && apt-get upgrade -y -qq

  log "Installation des dépendances système..."
  apt-get install -y -qq curl git nginx postgresql postgresql-contrib

  # Node.js 20 via NodeSource
  log "Installation de Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs

  # PM2
  log "Installation de PM2..."
  npm install -g pm2 --quiet

  # PostgreSQL — créer utilisateur et base
  log "Configuration de PostgreSQL..."
  sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'impotbo') THEN
    CREATE ROLE impotbo WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
  END IF;
END
\$\$;
CREATE DATABASE impuestos_bo OWNER impotbo;
GRANT ALL PRIVILEGES ON DATABASE impuestos_bo TO impotbo;
EOF

  warn "⚠  Pensez à changer le mot de passe PostgreSQL dans le .env !"

  # Cloner le dépôt si pas déjà fait
  if [ ! -d "$APP_DIR/.git" ]; then
    log "Clonage du dépôt GitHub..."
    git clone https://github.com/emmanueliung/impotbo.git "$APP_DIR"
  fi

  # Créer le .env backend
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    log "Création du fichier .env backend..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    warn "⚠  IMPORTANT : Éditez $BACKEND_DIR/.env avec vos vraies valeurs !"
    warn "   nano $BACKEND_DIR/.env"
  fi

  # Copier la config Nginx
  log "Configuration de Nginx..."
  cp "$APP_DIR/deploy/nginx.conf" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
  nginx -t && systemctl reload nginx

  # Copier le service systemd (alternatif à PM2)
  # cp "$APP_DIR/deploy/impotbo.service" /etc/systemd/system/
  # systemctl daemon-reload

  log "Installation initiale terminée !"
  echo ""
  warn "Étapes manuelles restantes :"
  echo "  1. Éditez $BACKEND_DIR/.env avec vos vraies valeurs"
  echo "  2. Relancez ce script sans --initial : sudo ./deploy/deploy.sh"
  exit 0
fi

# ── MISE À JOUR ────────────────────────────────────────────

log "Récupération des dernières modifications depuis GitHub..."
cd "$APP_DIR"
git fetch origin
git pull origin main

# ── BACKEND ────────────────────────────────────────────────
log "Mise à jour du backend..."
cd "$BACKEND_DIR"
npm install --production --quiet

# Migrations/init DB si nécessaire
# npm run db:init  # Décommenter si vous avez des migrations

log "Redémarrage du backend via PM2..."
if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
  pm2 reload "$SERVICE_NAME" --update-env
else
  pm2 start src/app.js \
    --name "$SERVICE_NAME" \
    --node-args="--env-file=.env" \
    --log "/var/log/impotbo/backend.log" \
    --error "/var/log/impotbo/backend-error.log" \
    --time
  pm2 save
  pm2 startup systemd -u root --hp /root
fi

# ── FRONTEND ───────────────────────────────────────────────
log "Build du frontend..."
cd "$FRONTEND_DIR"
npm install --quiet
npm run build

log "Mise à jour des fichiers Nginx..."
# Le build est dans frontend/dist/ — Nginx pointe dessus directement

log "Rechargement de Nginx..."
nginx -t && systemctl reload nginx

# ── FINALISATION ───────────────────────────────────────────
log "Création du répertoire de logs..."
mkdir -p /var/log/impotbo
chown -R $NODE_USER:$NODE_USER /var/log/impotbo 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Déploiement terminé avec succès !   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
log "Statut PM2 :"
pm2 status "$SERVICE_NAME"
