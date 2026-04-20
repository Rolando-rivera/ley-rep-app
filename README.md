# Plataforma Ley REP - Vue 3 + Vite + Express + PostgreSQL

Aplicación web full stack para proyecto de título, con frontend en **Vue 3 + Vite**, estilos en **CSS nativo responsive** y backend en **Node.js + Express** conectado a **PostgreSQL**.

## Stack
- Frontend: Vue 3 + Vite
- Estilos: CSS nativo, sin Bootstrap
- Backend: Node.js + Express
- Base de datos: PostgreSQL (compatible con Render)
- Despliegue: Render Web Service + PostgreSQL remoto por `DATABASE_URL`

## Estructura
- `frontend/`: aplicación Vue 3 + Vite
- `backend/`: API REST, autenticación demo y conexión a PostgreSQL
- `sql/01_ley_rep_schema.sql`: script de creación y datos semilla
- `render.yaml`: despliegue sugerido en Render

## Desarrollo local
### 1) Backend
```bash
cd backend
npm install
cp .env.example .env
# completa DATABASE_URL y SESSION_SECRET
npm start
```

### 2) Frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Variables de entorno backend
```env
DATABASE_URL=postgresql://usuario:clave@host:5432/base
DATABASE_SSL=true
PORT=3000
SESSION_SECRET=leyrep123
```

## Despliegue en Render
1. Sube el proyecto a GitHub.
2. En Render crea un **Web Service** conectado al repositorio.
3. Usa el `render.yaml` incluido o configura manualmente:
   - Build: `cd frontend && npm install && npm run build && cd ../backend && npm install`
   - Start: `cd backend && npm start`
4. Agrega `DATABASE_URL`, `DATABASE_SSL=true` y `SESSION_SECRET`.
5. Ejecuta el script `sql/01_ley_rep_schema.sql` en tu base PostgreSQL.

## Usuarios demo
- Administrador: `admin@leyrep.cl` / `admin123`
- Gestor: `gestor@leyrep.cl` / `gestor123`
- Productor: `productor@leyrep.cl` / `productor123`
