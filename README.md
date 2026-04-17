# KingsWorld

Scaffold inicial do app em `Next.js + TypeScript` com rotas base do produto e dados mockados.

## O que ja existe

- `app/` com login, cadastro, lobby, perfil e shell do mundo
- abas do mundo: `Imperio`, `Operacoes`, `Base`, `Tabuleiro`, `Inteligencia`
- `lib/mock-data.ts` com estado fake do mundo
- `03_SUPABASE_SCHEMA.sql` em hold para aplicar depois no Supabase
- simulador oficial de temporada em `simulations/simulate-season-v2.mjs`
- documentacao de produto, banco, backlog e fluxos no root do projeto

## Como subir depois

No PowerShell daqui, use `cmd /c npm ...` por causa da policy.

```powershell
cmd /c npm install
cmd /c npm run dev
cmd /c npm run sim:season
```

Depois abra:

- `/lobby`
- `/profile`
- `/world/world-01/base`

## Proximo passo tecnico

1. instalar dependencias
2. validar que o scaffold sobe
3. conectar auth real
4. trocar mocks por chamadas de API
5. ligar Supabase ao schema SQL