# Portfólio

Portfólio pessoal feito com React, TypeScript, Vite e Three.js.

## Rodando localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # gera a versão final em dist/
npm run preview  # serve o dist/ localmente
```

## Estrutura

- `src/components/`: seções do site (hero, about, projects, nav)
- `public/`: imagens, currículo e favicon, servidos como estão
- `tools/`: scripts Python que geram as imagens de `public/` a partir de `tools/source/`

## Deploy

Publicado na Cloudflare (Workers com assets estáticos, configurado em `wrangler.jsonc`).
Cada push no `master` dispara um novo deploy.
