# KingsWorld - 10 Seeds (Analise de Balanceamento)

## Resultado geral (10 seeds)
- Sobreviventes no Portal por seed: 14
- Elegiveis >=1500 no D90 por seed: 7.6
- ETA medio Nav+Flow: 53.06h (P90 57.34h)
- Pico 2500 por seed: 0
- Max influencia observado: 2150

## 10 jornadas selecionadas (mix elite/medio/fraco)
- Seed 90712026 | H05 (elite) | Build: Posto Avancado + Tatica | Herois Eng/Mar/Nav/Eru | Quests 3/3 | Maravilhas 2/5 | Influencia D15/D30/D60/D90/D120: 167/471/1246/1886/1856 | 2 aldeia D11, 1 lvl100 D45, D90 9 aldeias -> D120 6 (perdeu 3), marcha D92 ETA 159.6h, Entrou no Portal.
- Seed 90751621 | H03 (medio) | Build: Bastiao + Defensiva | Herois Eng/Int/Eru | Quests 1/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 66/301/626/926/1302 | 2 aldeia D21, 1 lvl100 D50, D90 6 aldeias -> D120 6 (perdeu 0), marcha D102 ETA 110.82h, Barrado por influencia.
- Seed 90791216 | B20 (fraco) | Build: Celeiro + Fluxo | Herois Nav | Quests 1/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 62/183/507/720/382 | 2 aldeia D16, 1 lvl100 D49, D90 5 aldeias -> D120 1 (perdeu 4), marcha D98 ETA 56.89h, Barrado por influencia.
- Seed 90830811 | H02 (elite) | Build: Bastiao + Defensiva | Herois Eng/Mar/Nav | Quests 2/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 73/359/831/1231/1795 | 2 aldeia D16, 1 lvl100 D51, D90 8 aldeias -> D120 8 (perdeu 0), marcha D92 ETA 113.32h, Entrou no Portal.
- Seed 90719945 | B18 (medio) | Build: Metropole + Fluxo | Herois Eng/Int | Quests 0/3 | Maravilhas 1/5 | Influencia D15/D30/D60/D90/D120: 235/442/997/1524/1306 | 2 aldeia D8, 1 lvl100 D31, D90 10 aldeias -> D120 8 (perdeu 3), marcha D101 ETA 76.32h, Barrado por influencia.
- Seed 90759540 | B28 (fraco) | Build: Posto Avancado + Tatica | Herois Eng | Quests 1/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 107/382/688/984/556 | 2 aldeia D21, 1 lvl100 D47, D90 5 aldeias -> D120 1 (perdeu 4), marcha D99 ETA 183.61h, Barrado por influencia.
- Seed 90799135 | B49 (elite) | Build: Bastiao + Tatica | Herois Eng/Mar/Nav/Int | Quests 1/3 | Maravilhas 1/5 | Influencia D15/D30/D60/D90/D120: 150/343/837/1354/1847 | 2 aldeia D15, 1 lvl100 D52, D90 7 aldeias -> D120 8 (perdeu 0), marcha D92 ETA 119.82h, Entrou no Portal.
- Seed 90838730 | B23 (medio) | Build: Posto Avancado + Tatica | Herois Mar/Nav/Eru | Quests 1/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 153/300/748/1322/1350 | 2 aldeia D12, 1 lvl100 D48, D90 7 aldeias -> D120 6 (perdeu 2), marcha D96 ETA 141.06h, Barrado por influencia.
- Seed 90727864 | B09 (fraco) | Build: Metropole + Urbana | Herois Nav | Quests 0/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 106/195/551/877/622 | 2 aldeia D11, 1 lvl100 D38, D90 8 aldeias -> D120 4 (perdeu 4), marcha D98 ETA 133.59h, Barrado por influencia.
- Seed 90767459 | H07 (elite) | Build: Bastiao + Defensiva | Herois Eng/Mar/Eru | Quests 3/3 | Maravilhas 0/5 | Influencia D15/D30/D60/D90/D120: 106/439/1041/1653/2150 | 2 aldeia D16, 1 lvl100 D41, D90 9 aldeias -> D120 10 (perdeu 0), marcha D95 ETA 186.21h, Entrou no Portal.

## Sinais de injustica / falta de decisao forte
- Basti?o dominante no late: portal rate 50.0%, perda media de aldeias 0.23 (nao-Bastiao 2.46).
- Branch Defensiva muito acima das outras no portal: 44.78% vs Urbana 25.66%, Tatica 24.32%, Fluxo 14.29%.
- Regra "horda D110 pune quem ficar parado" praticamente nao entra no jogo: 0 nao-Bastiao ficaram com marchStartDay > 110.
- ETA virou pouco decisivo para vitoria porque quase todos iniciam marcha cedo (media ~D95) e cabem ETAs altos (>100h).
- 2500 ficou inacessivel (max 2150), entao topo de excelencia do endgame sumiu.

## Feedback pratico para deixar decisoes importarem
- Janela de marcha real: impedir partida antes de D104-D106, ou aplicar custo progressivo por dia em marcha cedo (desgaste, desertao, perda de influencia).
- Horda D110 orientada a evento: se marcha iniciar apos D110, aplicar perda instantanea de 50-70% em nao-Bastiao; hoje o gatilho quase nunca ativa.
- Reequilibrar Defensiva/Bastiao: reduzir bonus passivo de sobrevivencia (~10-15%) e transferir parte para timing/execucao (ex.: defesa so escala max se quest 2 e 3 forem concluidas).
- Fortalecer rotas alternativas para 1500: Tatica e Urbana precisam ganho de influencia em risco/execucao (quests militares, saque de hotspot, controle de rota).
- ETA com risco log?stico: acima de 72h aumentar chance de interceptacao e consumo de suprimento; abaixo de 60h reduzir risco. Assim Nav+Flow vira vantagem real sem ser auto-win.
- Reabrir teto 2500 de forma rara: target 0.3-1.0 player/seed em 2500 (hoje 0), via cadeia dificil de maravilhas + quests + militar top.
