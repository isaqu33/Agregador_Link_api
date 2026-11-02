# Backend — Agregador_Link_api

NestJS 8 + Mongoose 6 (`@nestjs/mongoose`). Auth própria (email/senha + JWT). Imagens no Azure Blob.

## Comandos

```
docker compose -f docker-compose.dev.yml up -d --build -V   # sobe api + mongo + azurite
docker compose -f docker-compose.dev.yml exec api npm run seed
npx tsc --noEmit        # typecheck
npx eslint "{src,test}/**/*.ts" --fix
npx jest
```

`-V` recria os volumes anônimos (`node_modules` do container). Use quando `package.json` mudar; sem ele o container
mantém `node_modules` velho.

## Estrutura (`src/`)

- `main.ts` — CORS por `CORS_ORIGINS`, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, `PORT`.
- `auth/` — `register` e `login` (bcryptjs custo 12). Login compara contra hash falso quando o email não existe.
- `jwt/` — `JwtAuthService`, estratégia passport (só `Authorization: Bearer`), `JwtAuthGuard`. Payload `{ sub: userId, username: email }`.
- `user/` — schema `User`, `UserService`, `GET /user/me`, `POST /user/editProfile`.
- `links/` — schema `Link`, `LinksService`, DTOs.
- `storage/` — upload e leitura de imagens no Azure Blob.
- `common/to-json.ts` — `toJSON` dos schemas: `_id` vira `id` (string), sem `__v`.
- `seed.ts` — cria o primeiro usuário a partir de `SEED_USER_*` (idempotente).

## Endpoints

| Rota | Auth | Observação |
|---|---|---|
| `POST /auth/register` | — | `{name,email,password}`; 409 se o email existe; senha 8–72 chars |
| `POST /auth/login` | — | `{email,password}` → `{accessToken,user}`; 401 genérico |
| `GET /user/me` | JWT | usuário + links, sem senha |
| `POST /user/editProfile` | JWT | só `name,photoURL,template,title,about`; campo extra → 400 |
| `POST /links/addLink` | JWT | `{name,link,type}`; `link` só http/https |
| `POST /links/deletLink` | JWT | `{idlink}`; só o dono (senão 404) |
| `POST /links/editLink` | JWT | `{id,name?,link?}`; só o dono (senão 404); `link` só http/https; `type` não é editável (campo extra → 400) |
| `POST /links/reorder` | JWT | `{ids:[...]}` na nova ordem (sem repetidos); todos têm de ser do dono (senão 404); grava `order = posição` |
| `POST /links/editActivet` | JWT | `{id,activation}`; só o dono |
| `GET /links/getDataUser/:id` | — | página pública: sem email, só links ativos; 404 se não existe |
| `POST /media` | JWT | multipart `file`; JPEG/PNG/WebP/GIF até 5 MB → `{url:'/media/<userId>/<uuid>.<ext>'}` |
| `GET /media/:userId/:file` | — | serve a imagem do blob |
| `GET /`, `GET /texte` | — | strings de teste |

Os nomes `deletLink`, `editActivet` e `isActivit` têm erro de digitação, mas são contrato com o front: não renomear
sem mudar os dois lados.

## Modelos (MongoDB, database `agregador`)

- `User`: `name`, `email` (único, minúsculo), `password` (hash, `select:false`), `photoURL`, `template` (JSON em string:
  `{cor, formato}`), `title`, `about`.
- `Link`: `name`, `link`, `type`, `isActivit` (default true), `order` (default 0), `userId` (ObjectId → User). Listagens
  (`/user/me` e página pública) ordenam por `order` e depois `_id`; link novo vai para o fim (`max(order)+1`).

Para consultar o banco: `docker exec mongo-agregador mongosh -u agregador_user -p agregador_pass_local --authenticationDatabase admin agregador`.

## Variáveis de ambiente (`.env`, não versionado; modelo em `.env.example`)

`API_PORT_HOST`, `AZURITE_BLOB_PORT_HOST`, `MONGO_PORT_HOST`, `CORS_ORIGINS`, `MONGO_USERNAME`, `MONGO_PASSWORD`,
`DATABASE_URL`, `SECRET_JWT`, `SEED_USER_NAME/EMAIL/PASSWORD`. No Docker o compose monta a `DATABASE_URL` apontando
para `mongo-agregador` e define `AZURE_STORAGE_CONNECTION_STRING` (Azurite) e `PORT`.
`AZURE_IMAGES_CONTAINER` (opcional, default `agregador-images`).

## Armadilhas

- O container usa bind mount `.:/app` + volumes anônimos para `node_modules` e `dist`.
- Imports do tipo `src/jwt/...` funcionam por `baseUrl: ./`; scripts fora do Nest precisam de `-r tsconfig-paths/register`.
- Nome de blob válido: `<ObjectId 24 hex>/<uuid>.<ext>` (regex em `storage.service.ts`); mudou o tipo de id, mude a regex.
- Mongoose 6: para ObjectId em `@Prop` use `MongooseSchema.Types.ObjectId`, não `Types.ObjectId` (vira Mixed e grava string).
- Prisma/SQLite foram removidos; não há mais `prisma/`.
