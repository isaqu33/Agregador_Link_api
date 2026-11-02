# Funcionalidades — referência Linktree e roadmap do FaceLink

Objetivo: ter um produto completo no estilo Linktree, mas com a **nossa identidade** (visual claro e minimalista,
roxo como destaque, nome FaceLink). Não é cópia pixel a pixel: pegamos o que gera valor e adaptamos.

> **Fontes e confiabilidade.** Levantado em 02/11/2026 na [página de preços do Linktree](https://linktr.ee/s/pricing),
> na [central de ajuda (visão geral dos recursos pagos)](https://intercom.help/linktree-ff524ba1864c/en/articles/5434140-an-overview-of-paid-features-available-on-linktree)
> e em comparativos de terceiros. Os planos e preços mudam com frequência e as fontes divergem sobre qual recurso está
> em qual plano; por isso **não** registramos preços nem a divisão exata por plano. Itens marcados com `*` vêm do
> conhecimento geral do produto e não foram confirmados nessas fontes.

## O que já temos (estado atual)

| Área | Situação |
|---|---|
| Cadastro, login e sessão (Auth.js + JWT) | Pronto |
| Links: criar, listar, ativar/desativar, excluir | Pronto |
| Tipos de link com ícone | 6: Link, Spotify, YouTube, WhatsApp, Twitch, Email |
| Editar link (título/URL) | Pronto (`POST /links/editLink`; o tipo não é editável) |
| Foto de perfil com recorte e upload | Pronto |
| Título e descrição do perfil | Pronto |
| Aparência: cor sólida (4) e gradiente (4), formato do botão (3) | Pronto, mas poucas opções |
| Preview ao vivo em celular | Pronto (só desktop) |
| Página pública `/:id` | Pronta, **sem SSR/SEO** e sem o nosso novo visual |
| Reordenar links | Pronto (arrastar e soltar, `POST /links/reorder`) |
| Analytics (cliques/visitas) | **Não existe** |

## Catálogo de funcionalidades do Linktree

Prioridade: **P1** = base que falta para parecer um produto; **P2** = diferencial que agrega muito; **P3** = avançado /
depende de infraestrutura ou pagamento; **Fora** = não vamos copiar agora.

### Links e conteúdo

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| Links ilimitados | P1 | Já é assim |
| Editar link existente | P1 | **Feito** |
| Reordenar por arrastar e soltar | P1 | **Feito** (`@dnd-kit`, campo `order`) |
| Miniatura/ícone por link | P2 | Upload via `/media`; campo `thumbnail` |
| Mais tipos de link (Instagram, TikTok, X, LinkedIn, GitHub, Telegram, Pix…) | P1 | Só estende `typesSocialMediaa` |
| Ícones de redes no topo da página | P1 | Lista `socials` no usuário |
| Cabeçalhos/divisores para agrupar links | P2 | Novo `type: "header"` |
| Link em destaque (maior, com imagem) | P2 | Linktree limita a 2 no plano grátis |
| Agendar link (data de início/fim) | P2 | Campos `startAt`/`endAt` + filtro na API pública |
| Link com aviso de conteúdo sensível / idade `*` | P3 | |
| Link protegido por senha `*` | P3 | |
| Incorporar vídeo/música (YouTube, Spotify) na página | P2 | Embed no lugar do botão |
| Links de redirecionamento / curtos | Fora | |

### Aparência e marca

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| Temas prontos (conjunto de cor + fonte + botão) | P1 | Substitui as 4 cores soltas de hoje |
| Fundo: cor, gradiente | P1 | Já existe; ampliar a paleta |
| Fundo: imagem/vídeo `*` | P2 | |
| Fonte e cor do texto | P1 | Hoje o texto é fixo |
| Estilos de botão: formato, borda, sombra, preenchido/contorno | P1 | Hoje só o formato |
| Remover marca do app (rodapé "FaceLink") | P3 | Só faz sentido com planos |
| Domínio próprio | Fora | Exige infra de DNS/TLS |

### Compartilhamento e descoberta

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| URL pública curta e personalizável (`/@usuario`) | P1 | Hoje é o id do Mongo, feio e longo |
| SEO e Open Graph (título, descrição, imagem) | P1 | Exige SSR na página pública |
| QR Code do perfil | P2 | Gerado no cliente, baixar PNG/SVG |
| Botão "Compartilhar" na página pública | P2 | |
| Página de perfil verificado `*` | Fora | |

### Analytics

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| Visitas ao perfil e cliques por link | P1 | Coleção `Event` na API; contagem no clique |
| Gráfico por período | P2 | |
| Origem (referrer), país, dispositivo | P2 | |
| Exportar dados | P3 | |
| Pixel Meta / Google Analytics | P3 | Campo de ID por usuário, injetado na página pública |

### Captação e monetização

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| Coleta de e-mail (formulário na página) | P2 | Coleção `Lead`; exportar CSV |
| Coleta de telefone/SMS | Fora | Depende de provedor de SMS |
| Loja / venda de produtos digitais | Fora | Exige gateway de pagamento |
| Gorjeta / apoio (Pix) `*` | P3 | |
| Afiliados | Fora | |
| Agendador de redes sociais (Social Planner) | Fora | Produto à parte |
| Resposta automática no Instagram `*` | Fora | Depende da API da Meta |

### Conta e plataforma

| Funcionalidade | Prio | Nota para o FaceLink |
|---|---|---|
| Recuperar senha / confirmar e-mail | P1 | Hoje não existe |
| Login com Google `*` | P2 | Auth.js já suporta |
| Várias páginas por conta `*` | P3 | |
| Planos e cobrança | Fora | Só se o produto virar SaaS |
| Modo escuro no painel | P3 | |

## Roadmap sugerido

1. **Fundamentos (P1):** editar link, reordenar, mais tipos de link, redes sociais no topo, URL personalizada
   (`/@usuario`), SSR + SEO na página pública, analytics básico (visitas e cliques), temas/fonte/botões, recuperar senha.
2. **Diferenciais (P2):** miniaturas, destaque, cabeçalhos, agendamento, embeds, QR Code, compartilhar, coleta de
   e-mail, gráficos de analytics, login com Google.
3. **Avançado (P3):** pixels, exportação, gorjeta, senha por link, várias páginas.

Mudanças de API previstas: `Link` ganha `order`, `thumbnail`, `startAt`, `endAt` e `type` aceitando `header`; `User`
ganha `username` (único), `socials` e `seo`; novas coleções `Event` e `Lead`; ~~rota de edição de link~~ (feita). Cada uma exige
atualizar a lista branca do proxy (`app/api/backend/[...path]/route.ts`).
