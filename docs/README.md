# Agregador de Links — documentação

Dois repositórios, uma aplicação (estilo Linktree):

| Projeto | Repositório | Stack | Doc |
|---|---|---|---|
| Backend | `Agregador_Link_api` | NestJS 8, Mongoose (MongoDB), Azure Blob (Azurite em dev) | [back.md](back.md) |
| Front | `Agregador_Link_Front` | Next.js 14 (App Router), Auth.js v5, Chakra UI, react-query, MobX | [front.md](front.md) |
| Produto | — | Funcionalidades (referência Linktree) e roadmap | [features.md](features.md) |

## Regra de sincronização

A pasta `docs/` é **idêntica nos dois repositórios**. Sempre que um doc mudar em um projeto, copie a pasta para o
outro (`cp docs/*.md ../OUTRO_REPO/docs/`) e commite nos dois. Cada `CLAUDE.md` aponta para cá.

## Como subir tudo (dev)

1. Backend (cria a rede `agregador-network`): em `Agregador_Link_api`
   `docker compose -f docker-compose.dev.yml up -d --build`
2. Front: em `Agregador_Link_Front`
   `docker compose -f docker-compose.dev.yml up -d --build`
3. Primeiro usuário: `docker compose -f docker-compose.dev.yml exec api npm run seed` (no backend)
4. Abrir `http://localhost:3071/login`

Os dois composes usam o mesmo nome de projeto (`agregador_link`), então aparecem agrupados no Docker Desktop. O
Docker avisa de "orphan containers" ao subir um deles: é normal, não use `--remove-orphans`.

## Portas (diferentes de RayAI, worklist, custeio, dicom_router, kairoz)

| Serviço | Host | Container |
|---|---|---|
| Front (Next) | 3071 | 3071 |
| API (Nest) | 3070 | 3000 |
| MongoDB | 27070 | 27017 |
| Azurite (blob) | 10070 | 10000 |

## Fluxo de autenticação (resumo)

1. Login em `/login` (email + senha) → Auth.js chama `POST /auth/login` da API **no servidor do Next**.
2. A API devolve um JWT (24h). O Auth.js guarda esse token dentro do cookie de sessão **criptografado**; o navegador
   nunca o vê.
3. O navegador chama `/api/backend/...` (proxy do Next). O proxy lê o cookie, descriptografa e repassa à API com
   `Authorization: Bearer`.
4. Imagens: `POST /api/backend/media` → API grava no Azure Blob → devolve `/media/<userId>/<arquivo>`; o Next
   reescreve `/media/*` para a API.

## Pendências conhecidas

- Revogar a chave do Firebase que foi commitada no início (histórico do backend).
- Helmet e rate limit no login ainda não existem.
- Telas do front rodam só no navegador (`ssr: false`); a página pública `/:id` não tem SSR.
- Sem testes de auth/links (só o teste de scaffold do `AppController`).
- `next build` ainda não foi validado (só `next dev`).
