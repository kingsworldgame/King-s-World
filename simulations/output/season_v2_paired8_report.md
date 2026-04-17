# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500 (Regicida removido): Predios 1000 + Militar 500 + Quests 300 + Conselho 250 + Maravilhas 250 + Tribo 200.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 14.78 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 43.69 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 17.38 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 23.5.
- Players com pico 2500 por seed: 1.

## Tabela de validacao - 8 seeds (2 por perfil (1 perfeito + 1 com falhas))

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes trilha | Perda media aldeias (Horda) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-perfect | Metropole | 22 | 22 | 32 | 1 | 13 | 2.72 | 3.4 | 125.45 |
| 90719945 | metropole-lazy | Metropole | 17 | 17 | 23 | 0 | 13 | 3.3 | 2.94 | 129.61 |
| 90727864 | posto-perfect | Posto Avancado | 17 | 17 | 21 | 3 | 12 | 2.72 | 3.38 | 127.48 |
| 90735783 | posto-lazy | Posto Avancado | 11 | 11 | 16 | 0 | 8 | 3.54 | 2.76 | 102.46 |
| 90743702 | bastiao-perfect | Bastiao | 20 | 20 | 23 | 3 | 11 | 2.08 | 3.42 | 124.55 |
| 90751621 | bastiao-lazy | Bastiao | 15 | 15 | 20 | 0 | 11 | 2.94 | 3.12 | 110.32 |
| 90759540 | celeiro-perfect | Celeiro | 26 | 26 | 32 | 1 | 8 | 2.44 | 3.68 | 92.89 |
| 90767459 | celeiro-lazy | Celeiro | 11 | 11 | 21 | 0 | 13 | 3.24 | 3.18 | 102.78 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Conselho | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 38.88 | 0 | 141.79 | 87.98 | 53.81 | 0 | 0 | 0 | 0 | 401.92 | 1.67 |
| 30 | 38.88 | 0 | 385.47 | 209.51 | 107.58 | 13.88 | 54.5 | 0 | 0 | 642.68 | 3.22 |
| 60 | 38.88 | 0.38 | 1001.66 | 495.21 | 215.07 | 131.63 | 110.5 | 49.25 | 0 | 1124.44 | 5.56 |
| 90 | 38.88 | 23.5 | 1483.54 | 783.89 | 322.65 | 160.75 | 167 | 49.25 | 0 | 1606.18 | 7.89 |
| 120 | 38.88 | 20.63 | 1415.57 | 565.5 | 324.2 | 161.75 | 167 | 64.63 | 132.5 | 796.15 | 5.66 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 100 | 32% | 45% | 1% | 1508.88 | 1394.63 | 139.1 | 28% | 3.11 |
| tactical | 91 | 40.66% | 68.13% | 3.3% | 1602.77 | 1472.49 | 126.77 | 25.27% | 3.08 |
| defensive | 102 | 31.37% | 30.39% | 1.96% | 1361.18 | 1384.42 | 133.01 | 23.53% | 2.48 |
| flow | 107 | 35.51% | 46.73% | 1.87% | 1475.09 | 1416.42 | 63.21 | 13.08% | 2.85 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 59.5% | 1.28 | 34.64 | 48.32% | 14.81% | 33.5 | 116.62 | 1570.54 |
| Marechal | 43.75% | 1.35 | 42.69 | 46.29% | 25.78% | 20.51 | 124.76 | 1545.75 |
| Navegador | 58% | 1.35 | 67.75 | 42.67% | 23.81% | 18.86 | 87.1 | 1506.04 |
| Intendente | 56.75% | 1.14 | 45.08 | 44.49% | 21.97% | 22.53 | 104.75 | 1569.99 |
| Erudito | 43% | 1.08 | 38.7 | 38.37% | 32.02% | 6.35 | 121.27 | 1504.8 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 107 | 31.78% | 1538.07 | 1400.91 | 673.6 | 3.07 | 13.77 | 39.4 | 0.93% |
| Posto Avancado | 96 | 36.46% | 1520.55 | 1396.67 | 862.24 | 3.23 | 14.73 | 44.61 | 3.13% |
| Bastiao | 98 | 37.76% | 1371.99 | 1422.05 | 978.99 | 2.32 | 16.81 | 48.4 | 3.06% |
| Celeiro | 99 | 33.33% | 1499.12 | 1443.33 | 683.54 | 2.87 | 13.92 | 42.76 | 1.01% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.18
- hordeLossBase: 3

