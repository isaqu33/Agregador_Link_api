# Agregador de Links — API

Backend do agregador de links (estilo Linktree): cadastro e login por email e senha, perfil, links e upload de
imagens. O front está em [Agregador_Link_Front](https://github.com/isaqu33/Agregador_Link_Front).

- **Stack:** NestJS 8, MongoDB (Mongoose), JWT, Azure Blob Storage (Azurite em desenvolvimento)
- **Docs:** [`docs/`](docs/README.md) — endpoints, modelos, variáveis e armadilhas

## Requisitos

Docker e Docker Compose. Para rodar fora do Docker, Node 20.

## Rodando (desenvolvimento)

```bash
cp .env.example .env            # defina SECRET_JWT (openssl rand -hex 32) e as credenciais SEED_USER_*
docker compose -f docker-compose.dev.yml up -d --build -V
docker compose -f docker-compose.dev.yml exec api npm run seed   # cria o primeiro usuário
```

Suba a API **antes** do front: ela cria a rede `agregador-network` que o front usa.

| Serviço | URL / porta |
|---|---|
| API | http://localhost:3070 |
| MongoDB | localhost:27070 |
| Azurite (blob) | localhost:10070 |

## Principais rotas

| Rota | Auth |
|---|---|
| `POST /auth/register`, `POST /auth/login` | — |
| `GET /user/me`, `POST /user/editProfile` | JWT |
| `POST /links/addLink`, `/links/deletLink`, `/links/editActivet` | JWT |
| `GET /links/getDataUser/:id` (página pública) | — |
| `POST /media` (upload), `GET /media/:userId/:file` | JWT / — |

Detalhes em [`docs/back.md`](docs/back.md).

## Verificação

```bash
npx tsc --noEmit
npx eslint "{src,test}/**/*.ts"
npx jest
```

## Segurança

`.env` não é versionado. O histórico antigo deste repositório contém uma chave do Firebase e um `.env` antigos:
revogue a chave e mantenha o repositório privado.
