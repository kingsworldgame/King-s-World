# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500: Infraestrutura 1000 + Governo 500 + Militar 400 + Sociedade 300 + Legado 300.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 15.21 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 44.56 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 15.75 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 27.
- Mortes PvP por seed: 6.13.
- Players com pico 2500 por seed: 1.

## Tabela de validacao - 8 seeds (2 por perfil (1 perfeito + 1 com falhas))

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-perfect | Metropole | 23 | 23 | 41 | 3 | 8 | 9 | 2.56 | 4.74 | 93.96 |
| 90719945 | metropole-lazy | Metropole | 11 | 11 | 31 | 0 | 9 | 9 | 3.4 | 3.36 | 92.7 |
| 90727864 | posto-perfect | Posto Avancado | 13 | 13 | 20 | 1 | 8 | 7 | 3.18 | 3.8 | 94.66 |
| 90735783 | posto-lazy | Posto Avancado | 11 | 11 | 24 | 0 | 7 | 9 | 3.88 | 2.92 | 107.84 |
| 90743702 | bastiao-perfect | Bastiao | 21 | 21 | 27 | 2 | 2 | 6 | 2.4 | 4.44 | 103.75 |
| 90751621 | bastiao-lazy | Bastiao | 13 | 13 | 13 | 0 | 2 | 11 | 2.46 | 2.98 | 116.41 |
| 90759540 | celeiro-perfect | Celeiro | 23 | 23 | 34 | 2 | 5 | 7 | 2.34 | 5.02 | 77.57 |
| 90767459 | celeiro-lazy | Celeiro | 11 | 11 | 26 | 0 | 8 | 10 | 3.62 | 3.1 | 84.22 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Governo | Sociedade | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 0 | 143.82 | 71.91 | 44.95 | 0 | 26.96 | 0 | 0 | 0 | 400.15 | 1.61 |
| 30 | 50 | 0 | 361.97 | 175.11 | 89.59 | 17.38 | 60.21 | 19.69 | 0 | 0 | 640.8 | 3.21 |
| 60 | 50 | 2.88 | 986.83 | 434.25 | 179.32 | 154.38 | 138.83 | 40.43 | 39.63 | 0 | 1122.31 | 5.58 |
| 90 | 50 | 27 | 1534.46 | 751.96 | 268.76 | 188.13 | 229.98 | 56.03 | 39.63 | 0 | 1603.79 | 7.93 |
| 120 | 15.75 | 20.75 | 1430.54 | 555.5 | 269.21 | 189.75 | 251.43 | 56.03 | 41.38 | 67.25 | 849.05 | 5.56 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 86 | 25.58% | 72.09% | 2.33% | 1629.85 | 1436.49 | 98.69 | 12.79% | 2.06 |
| tactical | 100 | 33% | 60% | 1% | 1561.96 | 1388.55 | 116.53 | 22% | 2.7 |
| defensive | 108 | 36.11% | 25.93% | 2.78% | 1384.2 | 1472.78 | 121.62 | 21.3% | 1.4 |
| flow | 106 | 30.19% | 62.26% | 1.89% | 1591.35 | 1422.27 | 49.81 | 11.32% | 2.26 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 59.5% | 1.52 | 33.87 | 39.92% | 19.14% | 20.78 | 99.26 | 1570.43 |
| Marechal | 50.25% | 1.48 | 42.58 | 45.27% | 17.59% | 27.69 | 101.31 | 1625.06 |
| Navegador | 63.75% | 1.46 | 67.04 | 37.25% | 21.38% | 15.88 | 76.16 | 1492.59 |
| Intendente | 54.5% | 1.31 | 43.23 | 44.95% | 15.38% | 29.57 | 86.5 | 1602.61 |
| Erudito | 40% | 1.26 | 38.81 | 43.75% | 23.33% | 20.42 | 103.87 | 1599.44 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 93 | 26.88% | 1672.01 | 1486.7 | 719.92 | 1.98 | 13.43 | 39.56 | 2.15% |
| Posto Avancado | 100 | 33% | 1531.12 | 1361.46 | 857.28 | 2.64 | 15.39 | 45.84 | 1% |
| Bastiao | 101 | 36.63% | 1388.96 | 1495.74 | 1053.43 | 1.36 | 17.41 | 48.68 | 2.97% |
| Celeiro | 106 | 29.25% | 1562.7 | 1384.29 | 759.82 | 2.39 | 14.52 | 43.82 | 1.89% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.16
- hordeLossBase: 3

