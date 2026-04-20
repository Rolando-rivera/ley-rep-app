# Plataforma Ley REP - Render + PostgreSQL

Aplicación web lista para subir a GitHub y desplegar en Render.

## Stack
- Frontend: Vue 3 vía CDN + CSS nativo responsive
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Despliegue: Render Web Service + PostgreSQL remoto mediante `DATABASE_URL`

## Estructura
- `backend/`: API REST, conexión a PostgreSQL y frontend estático servido por Express
- `sql/01_ley_rep_schema.sql`: script completo de creación y datos semilla
- `render.yaml`: configuración base para Render

## Funcionalidades principales
- CRUD de declaraciones REP
- CRUD de categorías REP
- CRUD de metas anuales
- CRUD de reglas de validación
- CRUD de usuarios y perfiles
- Validación operativa por parte del gestor
- Alertas preventivas automáticas
- Auditoría de eventos
- Resumen ejecutivo con métricas clave

## Despliegue rápido en Render
1. Sube este proyecto a un repositorio público en GitHub.
2. En Render, crea un **Web Service** conectado al repositorio.
3. Usa `backend` como carpeta raíz del servicio.
4. Configura estas variables de entorno:
   - `DATABASE_URL`: cadena de conexión PostgreSQL de Render
   - `DATABASE_SSL=true`
   - `NODE_ENV=production`
5. Ejecuta el script `sql/01_ley_rep_schema.sql` en tu base PostgreSQL.
6. Publica el servicio.

## Desarrollo local
1. Crea `backend/.env` a partir de `backend/.env.example`.
2. Instala dependencias en `backend`:
   ```bash
   npm install
   ```
3. Ejecuta el servidor:
   ```bash
   npm start
   ```
4. Abre `http://localhost:3000`.

## Importante
- No subas el archivo `.env` con credenciales reales al repositorio.
- Si ya tienes una base anterior, respalda antes de ejecutar el nuevo script SQL.


## Inicio de sesión demo

Usuarios genéricos incluidos para la presentación:

- Administrador: `admin@leyrep.cl` / `admin123`
- Gestor: `gestor@leyrep.cl` / `gestor123`
- Productor: `productor@leyrep.cl` / `productor123`

Importante: las contraseñas son simples y están pensadas solo para demostración académica.
Si vuelves a crear la base de datos, ejecuta nuevamente `sql/01_ley_rep_schema.sql` para cargar los usuarios demo y la columna `password_hash`.


## Nota sobre la estructura
En esta versión el proyecto quedó separado explícitamente en frontend/ y backend/, para que el avance sea fácil de revisar en el repositorio y se vea claramente que sí existe una interfaz completa con CSS nativo.
"# ley-rep-app" 
