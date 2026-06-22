# Design — Tablet responsivo (portrait) King's World

Data: 2026-06-05. Aprovado pelo dono. Spec fora do git (preferência do dono).

## Intenção
Hoje o app é mobile-first puro (só ~9 breakpoints no app todo). Em tablet ele
abre como coluna de celular esticada/centralizada — funciona, mas desperdiça a
tela. Objetivo: quem tem **tablet (retrato)** gostar de usar — aproveitar a
largura/altura extra, sem mexer no celular.

## Decisões (confirmadas com o dono)
- **Orientação:** retrato (portrait). Tablet em pé, perto do layout mobile atual.
- **Escopo:** todas as telas, **fatiado em fases**.
- **Abordagem:** breakpoints Tailwind `md:` (768px+) incrementais nos componentes
  existentes. NÃO criar shell de layout separado. Mobile-first intacto: regras
  `md:` só ativam em tela grande → **zero risco pro celular**.
- **Validação:** a cada fase, rodar `simulations/store-screenshots.mjs` em
  tablet retrato e revisar o resultado REAL (não mockup).

## Padrão de tablet (régua reutilizável)
- Container de conteúdo com **max-width confortável** (não esticar cards a tela toda).
- Seções de cards que hoje empilham em 1 coluna → **`md:grid-cols-2`** (usa a largura).
- Espaçamento e fonte um pouco maiores em `md:` (alvos de toque/legibilidade).
- Mobile (abaixo de `md`) **não muda**.

## Fases
| Fase | Telas | Mudança |
|------|-------|---------|
| F1 — Fundação + conteúdo | lobby, império, cidade, perfil | container max-width + grids 2 col + espaçamento/fonte maiores |
| F2 — Mapa | board (StrategicMap) | aproveitar altura/largura: mapa maior, controles/painéis melhor posicionados, toque maior |
| F3 — Secundárias | intelligence, guide, paywall | mesma régua da F1 |

## Não-escopo
- Layout landscape de tablet (foi decidido portrait).
- Layout desktop dedicado.
- Mudança de mecânica/dados (só apresentação/CSS).

## Sucesso
Em tablet retrato: telas de conteúdo usam a largura (2 colunas, sem cards
esticados feios), mapa aproveita a tela, legível e tocável. Celular idêntico ao
de hoje. Validado por screenshots reais por fase.
