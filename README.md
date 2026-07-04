# 🇧🇴 ImpotBO — Système de gestion fiscale bolivienne

Application web full-stack de gestion des impôts boliviens (RC-IVA / Formulaire 110).

**Stack :** React + Vite (frontend) · Express.js (backend) · PostgreSQL (base de données)

---

## 📁 Structure du projet

```
impuestos-bo/
├── frontend/          # React 18 + Vite
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── context/
│   └── package.json
├── backend/           # Express.js + PostgreSQL
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── db/
│   │   └── middleware/
│   └── package.json
└── deploy/            # Scripts et configs de déploiement
    ├── nginx.conf
    ├── impotbo.service
    └── deploy.sh
```

---

## 🚀 Démarrage local

### Prérequis
- Node.js 20+
- PostgreSQL 15+

### 1. Cloner le dépôt
```bash
git clone https://github.com/emmanueliung/impotbo.git
cd impotbo
```

### 2. Configurer le backend
```bash
cd backend
cp .env.example .env
# Éditer .env avec vos paramètres (DB, JWT, etc.)
npm install
npm run db:init
npm run dev
```

### 3. Lancer le frontend
```bash
cd frontend
npm install
npm run dev
```

L'app sera disponible sur `http://localhost:5173`

---

## 🖥️ Déploiement sur VPS

### Prérequis VPS
- Ubuntu 22.04 LTS
- Nginx
- Node.js 20 (via nvm)
- PostgreSQL 15
- PM2 (gestionnaire de processus)

### Déploiement initial (première fois)

Connectez-vous en SSH à votre VPS et exécutez :

```bash
# 1. Cloner le dépôt
git clone https://github.com/emmanueliung/impotbo.git /var/www/impotbo

# 2. Lancer le script de déploiement
cd /var/www/impotbo
chmod +x deploy/deploy.sh
./deploy/deploy.sh --initial
```

### Mise à jour (déploiements suivants)

```bash
cd /var/www/impotbo
./deploy/deploy.sh
```

Ou plus simplement, depuis votre machine locale :
```bash
git push origin main
# Puis sur le VPS :
ssh user@votre-vps "cd /var/www/impotbo && ./deploy/deploy.sh"
```

---

## ⚙️ Variables d'environnement (backend)

Copier `backend/.env.example` → `backend/.env` et renseigner :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PORT` | Port Express | `3000` |
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5432` |
| `DB_NAME` | Nom de la base | `impuestos_bo` |
| `DB_USER` | Utilisateur PostgreSQL | `impotbo` |
| `DB_PASSWORD` | Mot de passe | `motdepasse_securise` |
| `JWT_SECRET` | Clé secrète JWT | `chaine_aleatoire_longue` |
| `JWT_EXPIRES` | Durée du token | `7d` |

> ⚠️ **Ne jamais committer le fichier `.env` réel dans Git !**

---

## 📦 Scripts disponibles

### Backend
| Commande | Description |
|----------|-------------|
| `npm start` | Démarrer en production |
| `npm run dev` | Démarrer en développement (watch) |
| `npm run db:init` | Initialiser la base de données |

### Frontend
| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualiser le build |

---

## 🔒 Sécurité

- Les fichiers `.env` sont exclus du dépôt via `.gitignore`
- Les mots de passe sont hashés avec `bcryptjs`
- Authentification par JWT
- CORS configuré pour les domaines autorisés uniquement

---

## 📝 Licence

MIT
