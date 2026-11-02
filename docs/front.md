# Front — Agregador_Link_Front

Next.js 14 (App Router) + React 18, Auth.js (`next-auth@5.0.0-beta.32`), Chakra UI 2, Tailwind, react-query 3, mobx, unform.

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
- `app/layout.tsx` + `app/providers.tsx` — Chakra e react-query.
- `app/login/` — `page.tsx` redireciona logado para `/costumer`; `login-client.tsx` carrega a tela sem SSR.
- `app/costumer/` — `layout.tsx` (server) exige sessão (`auth()` → `redirect('/login')`); `shell-client.tsx` carrega o
  `Shell`; `page.tsx` = Links; `appearance/page.tsx` = Aparência.
- `app/[id]/page.tsx` — página pública do perfil.
- `src/Shell.tsx` — casca da área logada (nav, preview do celular, sair). Era o antigo `App.tsx`.
- `src/views/` — telas (Login, Links, Appearance, PerfilId, Preview). **Não** chame de `pages/`: o Next trataria como rotas.
- `src/componentes/` — componentes de UI. `SocialMediaLink.tsx` faz recorte e upload da foto.
- `src/server/api.tsx` — hook `useApi` (axios com `baseURL: '/api/backend'`, sem token no cliente).
- `src/componentes/SimpleLink.tsx` — lista de links com arrastar e soltar (`@dnd-kit`); reordena de forma otimista no cache
  do `ME_KEY` e desfaz se a API recusar.
- `src/hooks/useMe.ts` — **única fonte** do usuário logado (perfil + links), via react-query (`ME_KEY = "me"`).
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

## Estado da aplicação

| O quê | Onde fica |
|---|---|
| Sessão/token | Cookie criptografado do Auth.js (nunca no JS do navegador) |
| Dados do servidor (usuário, links) | react-query, chave `ME_KEY`. Leia com `useMe()`; depois de uma mutation use `queryClient.invalidateQueries(ME_KEY)` (sem `window.location.reload`) |
| Rascunho de Aparência (cor, título, descrição, formato) | MobX em `src/AppState.ts`; o `Preview` reage a ele |
| Configurações do usuário | MongoDB (`User.template`, `title`, `about`), via `POST /user/editProfile` |
| Estado de tela (modais, abas, recorte) | `useState` local |
| `localStorage` | Só a preferência de tema, na chave `chakra-ui-color-mode` (gerida pelo Chakra). Nada de dados do usuário |

Ao sair, o cache do react-query é limpo (`queryClient.clear()`). `app/providers.tsx` remove a chave antiga
`persist:root` que o Redux persistido deixava no navegador.

## Tema claro/escuro

- Fonte única: `useColorMode` do Chakra (`ThemeToggle` no header e no login). Padrão: segue o sistema até o usuário escolher.
- O Tailwind usa `darkMode: "class"`. `ThemeSync` (em `app/providers.tsx`) liga/desliga a classe `dark` no `<html>`, e um
  script inline em `app/layout.tsx` aplica a classe antes da primeira pintura (sem flash).
- Em componente novo, escreva sempre o par: `bg-white dark:bg-zinc-900`, `text-zinc-900 dark:text-zinc-100`,
  `border-zinc-200 dark:border-zinc-800`. Texto secundário: `text-zinc-500 dark:text-zinc-400`.
- O Tailwind instalado é o 3.1.6: **não existem** as cores `zinc-950`, `red-950` etc. (tons 950 vieram na 3.3). Use
  valores arbitrários (`bg-[#0b0b0f]`) ou `/opacidade` (`dark:bg-red-500/20`).
- O preview e a página pública `/:id` usam as cores escolhidas pelo usuário e não mudam com o tema.
