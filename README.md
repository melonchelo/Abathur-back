# Abathur · backend

Express 5, TypeScript strict y SQLite (`better-sqlite3`). Implementa BE-0 a BE-4 de `tickets-backend.md`.

## Levantar

```bash
npm install
npm run seed     # borra data/abathur.sqlite y lo recrea con la semilla
npm run dev      # http://localhost:3000/api, con recarga
```

Otros scripts: `npm test` (políticas y API de punta a punta sobre una base en memoria), `npm run lint`, `npm run typecheck`, `npm run build` y `npm start`.

Variables opcionales: `PORT`, `DB_PATH`, `JWT_SECRET` y `CORS_ORIGIN` (por defecto `http://localhost:4200`).

## Estructura: módulo y controlador

```
src/
  app.ts                 arma Express y monta los módulos bajo /api
  server.ts              abre la base y escucha
  db/                    conexión, esquema SQL y semilla
  shared/                errores ApiError, validación de cuerpos y contenido Markdown
  modules/<módulo>/
    <módulo>.model.ts       tipos del contrato JSON
    <módulo>.repository.ts  SQL y mapeo de filas snake_case a camelCase
    <módulo>.controller.ts  validación, reglas y respuesta HTTP
    <módulo>.routes.ts      rutas con su rol requerido
    *.policy.ts             reglas puras: peso del voto, cierre y tipo de decisión
```

Cada ruta lee el usuario y el rol desde la base en cada pedido. El rol del token no alcanza para escribir.

## Semilla

Contraseña de todas las cuentas: `abathur`.

| Usuario | Rol | Reputación | Peso |
|---|---|---|---|
| `lucia` | admin | 50 | — |
| `tomas` | moderador | 30 | 3 |
| `sofia` | moderador | 30 | 3 |
| `raul` | moderador | 10 | 1 |
| `diego` | moderador | 10 | 1 |
| `ana` | cliente | 15 (10 inicial + 5 por propuesta aceptada) | — |
| `martin` | cliente | 15 (10 inicial + 5 por propuesta aceptada) | — |

Diego existe para la propuesta `controvertida`: con pesos 3, 3 y 1 el total es impar y no puede haber empate.

Los ids de la semilla son legibles (`a-apertura-caja`, `p-en-votacion`, `v-apertura-caja-2`). Los que crea la API son UUID.

## Rutas

Base `http://localhost:3000/api`. Todo error responde `{ code, message }`. Salvo el login, todas piden `Authorization: Bearer <token>`.

| Método y ruta | Rol | Ticket |
|---|---|---|
| `POST /auth/login` | público | BE-0 |
| `GET /me` | autenticado | BE-0 |
| `GET /users` · `GET /users/:id` · `GET /users/:id/reputation` | autenticado | BE-0 |
| `GET /categories` · `GET /categories/:id` | autenticado | BE-0 |
| `GET /articles?q=&categoryId=` · `GET /articles/:id` | autenticado | BE-0 |
| `GET /articles/:id/versions` · `GET /articles/:id/versions/:versionId` | autenticado | BE-0 |
| `GET /proposals?status=&articleId=&authorId=` · `GET /proposals/:id` | autenticado | BE-0 |
| `GET /proposals/:id/comments` · `GET /proposals/:id/votes` | autenticado | BE-0 |
| `POST /articles` | admin | BE-1 |
| `POST /categories` · `PATCH /categories/:id` | admin | BE-1 |
| `POST /proposals` | cliente, moderador | BE-1 |
| `POST /proposals/:id/comments` | cliente, moderador | BE-1 |
| `POST /proposals/:id/voting` | moderador, admin | BE-1 |
| `POST /proposals/:id/votes` | moderador | BE-2 |
| `POST /proposals/:id/close` | moderador, admin | BE-2 |
| `POST /proposals/:id/decision` | admin | BE-3 |
| `POST /users` · `PATCH /users/:id` · `POST /users/:id/sanctions` | admin | BE-4 |
| `GET /audit?action=` | admin | BE-4 |

### Cuerpos de escritura

```ts
// POST /auth/login
{ username: string; password: string }

// POST /articles (ProposedArticle + changeSummary opcional)
{ title; summary; content /* Markdown */; categoryId; tags?: string[]; sources?: { title; url }[]; changeSummary? }

// POST /categories · PATCH /categories/:id
{ name; description?: string | null; parentId?: string | null }

// POST /proposals. Creación: sin articleId ni baseVersionId. Modificación: los dos.
{ articleId?: string | null; baseVersionId?: string | null; proposed: ProposedArticle }

// POST /proposals/:id/comments
{ body: string }

// POST /proposals/:id/votes. Si llega un peso, se ignora.
{ choice: 'a_favor' | 'en_contra' }

// POST /proposals/:id/decision
{ outcome: 'aceptar' | 'rechazar'; reason?: string | null; markBaseAsError?: boolean }

// POST /users
{ alias; username; role: 'admin' | 'moderador' | 'cliente'; initialReputation: number; password? }

// PATCH /users/:id
{ role?: Role; active?: boolean; reason?: string | null }

// POST /users/:id/sanctions
{ reason: string }
```

El JSON usa `camelCase` (`weightAtVote`, `currentVersionId`, `underReview`). La base usa `snake_case` (`weight_at_vote`, `current_version_id`). Los repositorios traducen de una forma a la otra.
