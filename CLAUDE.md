# Agregador_Link_api (backend)

API NestJS 8 + MongoDB (Mongoose) do agregador de links. O front fica em `../Agregador_Link_Front` (Next.js).

**Contexto completo em `docs/`** (`README.md`, `back.md`, `front.md`). Leia antes de mexer; tem portas, endpoints,
fluxo de auth, variáveis e armadilhas.

## Regras de trabalho

- **`docs/` é idêntica nos dois repositórios.** Ao alterar qualquer doc (ou algo que ele descreva: endpoint, porta,
  variável, fluxo), atualize `docs/` aqui e copie para `../Agregador_Link_Front/docs/` (`cp docs/*.md ../Agregador_Link_Front/docs/`).
  Avise o usuário para commitar nos dois repos.
- Mudou contrato da API (rota, campo, status)? Atualize `docs/back.md` e verifique `../Agregador_Link_Front` (`src/server/api.tsx`,
  `app/api/backend/[...path]/route.ts`, que tem lista branca de rotas).
- Não commite `.env`. Não faça commit nem push sem o usuário pedir.
- Nomes `deletLink`, `editActivet`, `isActivit` são contrato com o front; não renomeie sozinho.

## Comandos

- Subir: `docker compose -f docker-compose.dev.yml up -d --build -V` (cria a rede `agregador-network`; suba antes do front).
- Seed do primeiro usuário: `docker compose -f docker-compose.dev.yml exec api npm run seed`.
- Verificar: `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts" --fix`, `npx jest`.
- Portas: API 3070, Mongo 27070, Azurite 10070 (front 3071).

## Convenções

- Respostas em JSON com `id` string (ver `src/common/to-json.ts`); a senha nunca sai (`select: false`).
- Validação por DTO + `ValidationPipe` global com `forbidNonWhitelisted`. Toda rota nova autenticada usa `JwtAuthGuard`
  e o `req.user.sub` (id do usuário) para checar o dono do recurso.
- Idioma das mensagens de erro: português.
