# Front — Agregador_Link_Front

Next.js 14 (App Router) + React 18, Auth.js (`next-auth@5.0.0-beta.32`), Chakra UI 2, Tailwind, Redux Toolkit
(+ redux-persist), react-query 3, mobx, unform.

## Comandos

```
docker compose -f docker-compose.dev.yml up -d --build -V   # next dev em 0.0.0.0:3071
npx tsc --noEmit
```

Precisa do backend no ar antes (a rede `agregador-network` é criada por ele).

## Estrutura

- `auth.ts` — config do Auth.js (Credentials). `authorize` chama `API_INTERNAL_URL/auth/login`; o `accessToken` da API
  fica no JWT de sessão (criptografado), `session` só expõe `user.id/name/email`.
- `app/api/auth/[...nextauth]/route.ts` — handlers do Auth.js.
- `app/api/backend/[...path]/route.ts` — **proxy** para a API. Lista branca de rotas (públicas e privadas); para as
  privadas lê o token com `getToken` e injeta `Authorization`. `/auth/login` não passa por aqui de propósito.
- `app/layout.tsx` + `app/providers.tsx` — Chakra, react-query, Redux (+PersistGate).
- `app/login/` — `page.tsx` redireciona logado para `/costumer`; `login-client.tsx` carrega a tela sem SSR.
- `app/costumer/` — `layout.tsx` (server) exige sessão (`auth()` → `redirect('/login')`); `shell-client.tsx` carrega o
  `Shell`; `page.tsx` = Links; `appearance/page.tsx` = Aparência.
- `app/[id]/page.tsx` — página pública do perfil.
- `src/Shell.tsx` — casca da área logada (nav, preview do celular, sair). Era o antigo `App.tsx`.
- `src/views/` — telas (Login, Links, Appearance, PerfilId, Preview). **Não** chame de `pages/`: o Next trataria como rotas.
- `src/componentes/` — componentes de UI. `SocialMediaLink.tsx` faz recorte e upload da foto.
- `src/server/api.tsx` — hook `useApi` (axios com `baseURL: '/api/backend'`, sem token no cliente).
- `src/redux/` — slices `user` e `aparencer`. Não há mais slice de autenticação (a sessão é do Auth.js).
- `public/assets/` — imagens referenciadas como string (`"/assets/feliz.png"`).
- `next.config.mjs` — reescreve `/media/*` para a API.

## Rotas

`/` → `/costumer` · `/login` · `/costumer` (Links) · `/costumer/appearance` · `/:id` (perfil público)

## Variáveis (`.env`, não versionado; modelo em `.env.example`)

`WEB_PORT_HOST`, `AUTH_SECRET`, `AUTH_URL` (`http://localhost:3071`), `AUTH_TRUST_HOST`,
`API_INTERNAL_URL` (`http://agregador-api-dev:3000` no Docker; `http://localhost:3070` fora dele).

## Armadilhas

- As telas usam `dynamic(..., { ssr: false })` porque leem `window` na renderização (`screenSize`,
  `ButtonHeaderTypeLink`, `SimpleLink`, `Preview`). Ao tornar uma tela SSR, corrija esses acessos primeiro.
- O proxy usa o nome do cookie `authjs.session-token` (http) ou `__Secure-authjs.session-token` (https) como `salt`.
  Se mudar o esquema (https), confira `secureCookie`/`salt` em `app/api/backend/[...path]/route.ts`.
- Upload: o recorte gera data URL → vira `Blob` → `POST /media` (multipart via proxy). `photoURL` guarda o caminho
  relativo `/media/...`.
- `AUTH_SECRET` deve ser estável; trocar invalida as sessões.
- O container usa bind mount `.:/app` e volumes anônimos para `node_modules` e `.next`; rebuild com `-V` ao mexer em
  dependências.
- `redux-persist` avisa "failed to create sync storage" no servidor: inofensivo.
