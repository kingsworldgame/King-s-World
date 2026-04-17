# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500 (Regicida removido): Predios 1000 + Militar 500 + Quests 300 + Conselho 250 + Maravilhas 250 + Tribo 200.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 14.98 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 44.84 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 14.9 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 21.15.
- Mortes PvP por seed: 6.
- Players com pico 2500 por seed: 0.

## Tabela de validacao - 20 seeds (5 por perfil)

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-1 | Metropole | 14 | 14 | 23 | 0 | 4 | 10 | 3.44 | 3.18 | 122.27 |
| 90719945 | metropole-2 | Metropole | 14 | 14 | 25 | 0 | 8 | 6 | 3.68 | 3.46 | 99.85 |
| 90727864 | metropole-3 | Metropole | 15 | 15 | 24 | 0 | 7 | 6 | 3.46 | 3.28 | 97.31 |
| 90735783 | metropole-4 | Metropole | 20 | 20 | 26 | 0 | 8 | 3 | 3.58 | 3.4 | 94.15 |
| 90743702 | metropole-5 | Metropole | 13 | 13 | 24 | 0 | 8 | 10 | 3.54 | 3.26 | 104.16 |
| 90751621 | posto-1 | Posto Avancado | 15 | 15 | 20 | 0 | 5 | 9 | 3.42 | 3.38 | 112.12 |
| 90759540 | posto-2 | Posto Avancado | 11 | 11 | 19 | 0 | 7 | 8 | 3.28 | 2.96 | 107.87 |
| 90767459 | posto-3 | Posto Avancado | 7 | 7 | 17 | 0 | 11 | 9 | 4.08 | 2.9 | 93.72 |
| 90775378 | posto-4 | Posto Avancado | 13 | 13 | 17 | 0 | 4 | 5 | 3.58 | 3.44 | 106.41 |
| 90783297 | posto-5 | Posto Avancado | 16 | 16 | 17 | 0 | 2 | 5 | 2.92 | 3.38 | 113.01 |
| 90791216 | bastiao-1 | Bastiao | 14 | 14 | 20 | 0 | 10 | 4 | 2.82 | 3.26 | 102.38 |
| 90799135 | bastiao-2 | Bastiao | 15 | 15 | 21 | 0 | 6 | 7 | 3.5 | 3.3 | 103.98 |
| 90807054 | bastiao-3 | Bastiao | 12 | 12 | 13 | 0 | 7 | 9 | 3.26 | 2.78 | 102.43 |
| 90814973 | bastiao-4 | Bastiao | 15 | 15 | 19 | 0 | 6 | 5 | 3.34 | 3.28 | 107.9 |
| 90822892 | bastiao-5 | Bastiao | 15 | 15 | 18 | 0 | 5 | 5 | 3.38 | 3.26 | 107.23 |
| 90830811 | celeiro-1 | Celeiro | 14 | 14 | 24 | 0 | 4 | 6 | 3.6 | 3.4 | 96.66 |
| 90838730 | celeiro-2 | Celeiro | 12 | 12 | 20 | 0 | 5 | 7 | 3.74 | 3.26 | 94.61 |
| 90846649 | celeiro-3 | Celeiro | 17 | 17 | 22 | 0 | 8 | 7 | 3.14 | 3.2 | 85.85 |
| 90854568 | celeiro-4 | Celeiro | 24 | 24 | 24 | 0 | 2 | 7 | 2.9 | 3.34 | 104.13 |
| 90862487 | celeiro-5 | Celeiro | 22 | 22 | 30 | 0 | 3 | 11 | 3.02 | 3.4 | 101.23 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Conselho | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 0 | 125.83 | 71.78 | 54.05 | 0 | 0 | 0 | 0 | 397.23 | 1.64 |
| 30 | 50 | 0 | 351.07 | 171.48 | 108.1 | 15.7 | 55.8 | 0 | 0 | 635.34 | 3.19 |
| 60 | 50 | 0.1 | 927.7 | 425.06 | 216.09 | 134 | 113.5 | 39.05 | 0 | 1111.78 | 5.5 |
| 90 | 50 | 21.15 | 1429.57 | 737.79 | 324.18 | 162.65 | 165.9 | 39.05 | 0 | 1588.21 | 7.79 |
| 120 | 14.9 | 18.6 | 1327.76 | 499.7 | 325.22 | 162.8 | 165.9 | 46.35 | 127.8 | 826.98 | 5 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 236 | 19.49% | 52.54% | 0% | 1482.16 | 1270.88 | 116.45 | 18.22% | 2.79 |
| tactical | 242 | 38.84% | 56.2% | 0% | 1527.79 | 1409.06 | 119.06 | 11.98% | 2.67 |
| defensive | 261 | 33.72% | 16.09% | 0% | 1255.85 | 1347.57 | 124.33 | 15.33% | 1.77 |
| flow | 261 | 26.82% | 46.36% | 0% | 1464.67 | 1284.02 | 54.1 | 10.34% | 2.65 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 60.2% | 1.31 | 33.02 | 37.38% | 18.34% | 19.03 | 105.64 | 1428.54 |
| Marechal | 48.1% | 1.32 | 41.65 | 41.58% | 18.88% | 22.7 | 113.31 | 1454.36 |
| Navegador | 58.9% | 1.35 | 66.08 | 32.09% | 26.52% | 5.57 | 76.99 | 1338.73 |
| Intendente | 50.9% | 1.16 | 43.63 | 36.74% | 22.61% | 14.13 | 92.11 | 1429.19 |
| Erudito | 43.1% | 1.08 | 39.29 | 37.12% | 24.25% | 12.87 | 107.41 | 1416.94 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 231 | 25.97% | 1535.09 | 1307.94 | 715.41 | 2.74 | 13.21 | 40.22 | 0% |
| Posto Avancado | 250 | 34% | 1510.78 | 1379.01 | 842.53 | 2.65 | 14.76 | 45.56 | 0% |
| Bastiao | 256 | 32.03% | 1218.55 | 1360.94 | 1014.96 | 1.66 | 18.1 | 49.07 | 0% |
| Celeiro | 263 | 27% | 1465.1 | 1264.17 | 727.23 | 2.81 | 13.69 | 44.08 | 0% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.06
- hordeLossBase: 3

