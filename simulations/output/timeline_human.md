# KingsWorld - Auditoria de Temporada

- Esta auditoria mostra o que a temporada realmente registrou por run representativa, dia a dia.
- Onde o simulador atual nao persiste granularidade fina, o arquivo marca isso explicitamente em vez de inventar regra nova.

## Limites conhecidos

- O simulador de temporada nao persiste estoque inicial real; o saldo de recursos desta auditoria e normalizado a partir do Dia 1.
- O motor atual nao registra tipos individuais de tropa; a auditoria expõe totais e perdas agregadas.
- A abertura exata/estado aberto de cada quest nao e persistido; a auditoria registra gates, conclusoes e bloqueios observaveis.
- A trilha tribal atual e booleana no simulador; a auditoria registra ativacao, efeito e marcos do fluxo final.

## Jogador em foco

- Cenario: metropole-perfect
- Seed: 90712026
- Jogador: H01
- Perfil: metropole
- Branch: urban
- Resultado: Entrou no Portal com 2500 de influencia.

### Dias criticos do jogador em foco

- D12: 2a aldeia fundada: Primeiro salto territorial confirmado pela run.
- D39: 1a aldeia 100/100: A capital ou vila foco fechou o primeiro teto estrutural.
- D90: Gate do Portal: A run passou do corte de 1500 de influencia.
- D91: Inicio do Exodus: A fase final do mundo ficou ativa.
- D114: Marcha iniciada: A run iniciou a marcha final com ETA 82.39h.
- D117: Entrada no Portal: Entrada confirmada com 2500 de influencia.
- D120: tropas gastas em confronto

| Dia | Fase | Recursos | Infl. | Tropas | Eventos | Resumo |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | I: Consolidacao | M 1755 | S 1726 | E 1324 | I 212 | 78 | 184 | Fazendas -> Nv 2 + Minas -> Nv 2 | Influencia 78 (+78) | aldeias 1 | tropas 184 | 2 upgrade(s) | sem confronto |
| 2 | I: Consolidacao | M 652 | S 1374 | E 968 | I 29 | 83 | 198 | Palacio -> Nv 2 + Senado -> Nv 2 | Influencia 83 (+5) | aldeias 1 | tropas 198 | 2 upgrade(s) | sem confronto |
| 3 | I: Consolidacao | M 0 | S 1143 | E 811 | I 0 | 89 | 213 | Fazendas -> Nv 3 + Minas -> Nv 3 | Influencia 89 (+6) | aldeias 1 | tropas 213 | 2 upgrade(s) | sem confronto |
| 4 | I: Consolidacao | M 0 | S 698 | E 366 | I 0 | 95 | 228 | Palacio -> Nv 3 + Senado -> Nv 3 | Influencia 95 (+6) | aldeias 1 | tropas 228 | 2 upgrade(s) | sem confronto |
| 5 | I: Consolidacao | M 177 | S 809 | E 465 | I 20 | 100 | 243 | Sem marco novo | Influencia 100 (+5) | aldeias 1 | tropas 243 | sem upgrade estrutural | sem confronto |
| 6 | I: Consolidacao | M 354 | S 920 | E 564 | I 40 | 106 | 257 | Sem marco novo | Influencia 106 (+6) | aldeias 1 | tropas 257 | sem upgrade estrutural | sem confronto |
| 7 | I: Consolidacao | M 531 | S 1029 | E 663 | I 60 | 112 | 272 | Sem marco novo | Influencia 112 (+6) | aldeias 1 | tropas 272 | sem upgrade estrutural | sem confronto |
| 8 | I: Consolidacao | M 708 | S 1138 | E 762 | I 80 | 116 | 287 | Expedicao territorial (7 frentes) | Influencia 116 (+4) | aldeias 1 | tropas 287 | sem upgrade estrutural | sem confronto |
| 9 | I: Consolidacao | M 885 | S 1246 | E 861 | I 100 | 123 | 302 | Sem marco novo | Influencia 123 (+7) | aldeias 1 | tropas 302 | sem upgrade estrutural | sem confronto |
| 10 | I: Consolidacao | M 1062 | S 1354 | E 960 | I 120 | 130 | 316 | Formou a primeira reserva militar na Capital | Influencia 130 (+7) | aldeias 1 | tropas 316 | sem upgrade estrutural | sem confronto |
| 11 | I: Consolidacao | M 1239 | S 1461 | E 1059 | I 140 | 136 | 331 | Sem marco novo | Influencia 136 (+6) | aldeias 1 | tropas 331 | sem upgrade estrutural | sem confronto |
| 12 | I: Consolidacao | M 1603 | S 1704 | E 1280 | I 181 | 213 | 346 | [MARCO] 2a aldeia fundada + Conquistou/Fundou a 2a aldeia | Influencia 213 (+77) | aldeias 2 | tropas 346 | sem upgrade estrutural | sem confronto |
| 13 | I: Consolidacao | M 1967 | S 1947 | E 1501 | I 222 | 220 | 360 | Sem marco novo | Influencia 220 (+7) | aldeias 2 | tropas 360 | sem upgrade estrutural | sem confronto |
| 14 | I: Consolidacao | M 2331 | S 2188 | E 1722 | I 263 | 227 | 375 | Sem marco novo | Influencia 227 (+7) | aldeias 2 | tropas 375 | sem upgrade estrutural | sem confronto |
| 15 | I: Consolidacao | M 2695 | S 2429 | E 1943 | I 304 | 236 | 390 | Sem marco novo | Influencia 236 (+9) | aldeias 2 | tropas 390 | sem upgrade estrutural | sem confronto |
| 16 | I: Consolidacao | M 3059 | S 2669 | E 2164 | I 345 | 244 | 405 | Sem marco novo | Influencia 244 (+8) | aldeias 2 | tropas 405 | sem upgrade estrutural | sem confronto |
| 17 | I: Consolidacao | M 3609 | S 3046 | E 2506 | I 406 | 323 | 419 | Sem marco novo | Influencia 323 (+79) | aldeias 3 | tropas 419 | sem upgrade estrutural | sem confronto |
| 18 | I: Consolidacao | M 4159 | S 3421 | E 2848 | I 467 | 332 | 434 | Sem marco novo | Influencia 332 (+9) | aldeias 3 | tropas 434 | sem upgrade estrutural | sem confronto |
| 19 | I: Consolidacao | M 4709 | S 3796 | E 3190 | I 528 | 341 | 449 | Sem marco novo | Influencia 341 (+9) | aldeias 3 | tropas 449 | sem upgrade estrutural | sem confronto |
| 20 | I: Consolidacao | M 5439 | S 4311 | E 3612 | I 689 | 384 | 463 | Concluiu Quest 1/3 | Influencia 384 (+43) | aldeias 3 | tropas 463 | sem upgrade estrutural | sem confronto |
| 21 | II: Expansao | M 5989 | S 4684 | E 3954 | I 750 | 393 | 478 | Sem marco novo | Influencia 393 (+9) | aldeias 3 | tropas 478 | sem upgrade estrutural | sem confronto |
| 22 | II: Expansao | M 6539 | S 5057 | E 4296 | I 811 | 402 | 493 | Sem marco novo | Influencia 402 (+9) | aldeias 3 | tropas 493 | sem upgrade estrutural | sem confronto |
| 23 | II: Expansao | M 7089 | S 5429 | E 4638 | I 872 | 409 | 508 | Sem marco novo | Influencia 409 (+7) | aldeias 3 | tropas 508 | sem upgrade estrutural | sem confronto |
| 24 | II: Expansao | M 7639 | S 5801 | E 4980 | I 933 | 418 | 522 | Sem marco novo | Influencia 418 (+9) | aldeias 3 | tropas 522 | sem upgrade estrutural | sem confronto |
| 25 | II: Expansao | M 8189 | S 6171 | E 5322 | I 994 | 477 | 537 | Contratou Engenheiro | Influencia 477 (+59) | aldeias 3 | tropas 537 | sem upgrade estrutural | sem confronto |
| 26 | II: Expansao | M 8739 | S 6541 | E 5664 | I 1055 | 485 | 552 | Sem marco novo | Influencia 485 (+8) | aldeias 3 | tropas 552 | sem upgrade estrutural | sem confronto |
| 27 | II: Expansao | M 9476 | S 7046 | E 6128 | I 1137 | 624 | 567 | Contratou Erudito | Influencia 624 (+139) | aldeias 4 | tropas 567 | sem upgrade estrutural | sem confronto |
| 28 | II: Expansao | M 10213 | S 7551 | E 6592 | I 1219 | 634 | 581 | Sem marco novo | Influencia 634 (+10) | aldeias 4 | tropas 581 | sem upgrade estrutural | sem confronto |
| 29 | II: Expansao | M 10950 | S 8054 | E 7056 | I 1301 | 642 | 596 | Sem marco novo | Influencia 642 (+8) | aldeias 4 | tropas 596 | sem upgrade estrutural | sem confronto |
| 30 | II: Expansao | M 11687 | S 8557 | E 7520 | I 1383 | 652 | 611 | Chegou a 4 aldeias | Influencia 652 (+10) | aldeias 4 | tropas 611 | sem upgrade estrutural | sem confronto |
| 31 | II: Expansao | M 12424 | S 9060 | E 7984 | I 1465 | 661 | 625 | Sem marco novo | Influencia 661 (+9) | aldeias 4 | tropas 625 | sem upgrade estrutural | sem confronto |
| 32 | II: Expansao | M 13161 | S 9561 | E 8448 | I 1547 | 670 | 640 | Sem marco novo | Influencia 670 (+9) | aldeias 4 | tropas 640 | sem upgrade estrutural | sem confronto |
| 33 | II: Expansao | M 13898 | S 10061 | E 8912 | I 1629 | 679 | 655 | Sem marco novo | Influencia 679 (+9) | aldeias 4 | tropas 655 | sem upgrade estrutural | sem confronto |
| 34 | II: Expansao | M 14635 | S 10561 | E 9376 | I 1711 | 692 | 670 | Sem marco novo | Influencia 692 (+13) | aldeias 4 | tropas 670 | sem upgrade estrutural | sem confronto |
| 35 | II: Expansao | M 15372 | S 11061 | E 9840 | I 1793 | 705 | 684 | Sem marco novo | Influencia 705 (+13) | aldeias 4 | tropas 684 | sem upgrade estrutural | sem confronto |
| 36 | II: Expansao | M 16109 | S 11559 | E 10304 | I 1875 | 718 | 699 | Sem marco novo | Influencia 718 (+13) | aldeias 4 | tropas 699 | sem upgrade estrutural | sem confronto |
| 37 | II: Expansao | M 17032 | S 12194 | E 10889 | I 1977 | 823 | 714 | Sem marco novo | Influencia 823 (+105) | aldeias 5 | tropas 714 | sem upgrade estrutural | sem confronto |
| 38 | II: Expansao | M 17955 | S 12829 | E 11474 | I 2079 | 837 | 728 | Sem marco novo | Influencia 837 (+14) | aldeias 5 | tropas 728 | sem upgrade estrutural | sem confronto |
| 39 | II: Expansao | M 18878 | S 13462 | E 12059 | I 2181 | 902 | 743 | [MARCO] 1a aldeia 100/100 + Primeira aldeia atingiu 100/100 + Contratou Engenheiro (2a vaga) | Influencia 902 (+65) | aldeias 5 | tropas 743 | sem upgrade estrutural | sem confronto |
| 40 | II: Expansao | M 19801 | S 14094 | E 12644 | I 2283 | 1018 | 758 | Sem marco novo | Influencia 1018 (+116) | aldeias 5 | tropas 758 | sem upgrade estrutural | sem confronto |
| 41 | II: Expansao | M 20724 | S 14726 | E 13229 | I 2385 | 1032 | 773 | Sem marco novo | Influencia 1032 (+14) | aldeias 5 | tropas 773 | sem upgrade estrutural | sem confronto |
| 42 | II: Expansao | M 21647 | S 15358 | E 13814 | I 2487 | 1047 | 787 | Sem marco novo | Influencia 1047 (+15) | aldeias 5 | tropas 787 | sem upgrade estrutural | sem confronto |
| 43 | II: Expansao | M 22570 | S 15988 | E 14399 | I 2589 | 1062 | 802 | Ergueu/garantiu Maravilha 1 | Influencia 1062 (+15) | aldeias 5 | tropas 802 | sem upgrade estrutural | sem confronto |
| 44 | II: Expansao | M 23493 | S 16617 | E 14984 | I 2691 | 1077 | 817 | Sem marco novo | Influencia 1077 (+15) | aldeias 5 | tropas 817 | sem upgrade estrutural | sem confronto |
| 45 | II: Expansao | M 24416 | S 17246 | E 15569 | I 2793 | 1093 | 832 | Sem marco novo | Influencia 1093 (+16) | aldeias 5 | tropas 832 | sem upgrade estrutural | sem confronto |
| 46 | II: Expansao | M 25339 | S 17875 | E 16154 | I 2895 | 1154 | 846 | Contratou Erudito (2a vaga) | Influencia 1154 (+61) | aldeias 5 | tropas 846 | sem upgrade estrutural | sem confronto |
| 47 | II: Expansao | M 26449 | S 18639 | E 16861 | I 3018 | 1267 | 861 | Sem marco novo | Influencia 1267 (+113) | aldeias 6 | tropas 861 | sem upgrade estrutural | sem confronto |
| 48 | II: Expansao | M 27559 | S 19402 | E 17568 | I 3141 | 1274 | 876 | Sem marco novo | Influencia 1274 (+7) | aldeias 6 | tropas 876 | sem upgrade estrutural | sem confronto |
| 49 | II: Expansao | M 28669 | S 20166 | E 18275 | I 3264 | 1281 | 890 | Sem marco novo | Influencia 1281 (+7) | aldeias 6 | tropas 890 | sem upgrade estrutural | sem confronto |
| 50 | II: Expansao | M 29779 | S 20928 | E 18982 | I 3387 | 1338 | 905 | Contratou Intendente | Influencia 1338 (+57) | aldeias 6 | tropas 905 | sem upgrade estrutural | sem confronto |
| 51 | II: Expansao | M 30889 | S 21689 | E 19689 | I 3510 | 1345 | 920 | Sem marco novo | Influencia 1345 (+7) | aldeias 6 | tropas 920 | sem upgrade estrutural | sem confronto |
| 52 | II: Expansao | M 32259 | S 22670 | E 20516 | I 3733 | 1387 | 935 | Concluiu Quest 2/3 | Influencia 1387 (+42) | aldeias 6 | tropas 935 | sem upgrade estrutural | sem confronto |
| 53 | II: Expansao | M 33369 | S 23431 | E 21223 | I 3856 | 1394 | 949 | Sem marco novo | Influencia 1394 (+7) | aldeias 6 | tropas 949 | sem upgrade estrutural | sem confronto |
| 54 | II: Expansao | M 34479 | S 24190 | E 21930 | I 3979 | 1451 | 964 | Contratou Engenheiro (3a vaga) | Influencia 1451 (+57) | aldeias 6 | tropas 964 | sem upgrade estrutural | sem confronto |
| 55 | II: Expansao | M 35589 | S 24948 | E 22637 | I 4102 | 1459 | 979 | Sem marco novo | Influencia 1459 (+8) | aldeias 6 | tropas 979 | sem upgrade estrutural | sem confronto |
| 56 | II: Expansao | M 36885 | S 25844 | E 23465 | I 4245 | 1572 | 993 | Sem marco novo | Influencia 1572 (+113) | aldeias 7 | tropas 993 | sem upgrade estrutural | sem confronto |
| 57 | II: Expansao | M 38181 | S 26738 | E 24293 | I 4388 | 1580 | 1008 | Sem marco novo | Influencia 1580 (+8) | aldeias 7 | tropas 1008 | sem upgrade estrutural | sem confronto |
| 58 | II: Expansao | M 39477 | S 27631 | E 25121 | I 4531 | 1637 | 1023 | Contratou Intendente (2a vaga) + Ergueu/garantiu Maravilha 2 | Influencia 1637 (+57) | aldeias 7 | tropas 1023 | sem upgrade estrutural | sem confronto |
| 59 | II: Expansao | M 40773 | S 28523 | E 25949 | I 4674 | 1644 | 1038 | Sem marco novo | Influencia 1644 (+7) | aldeias 7 | tropas 1038 | sem upgrade estrutural | sem confronto |
| 60 | II: Expansao | M 42069 | S 29416 | E 26777 | I 4817 | 1701 | 1052 | Contratou Marechal + Mid game com 7 aldeias | Influencia 1701 (+57) | aldeias 7 | tropas 1052 | sem upgrade estrutural | sem confronto |
| 61 | III: Fortificacao | M 43365 | S 30307 | E 27605 | I 4960 | 1709 | 1067 | Sem marco novo | Influencia 1709 (+8) | aldeias 7 | tropas 1067 | sem upgrade estrutural | sem confronto |
| 62 | III: Fortificacao | M 44661 | S 31197 | E 28433 | I 5103 | 1715 | 1082 | Sem marco novo | Influencia 1715 (+6) | aldeias 7 | tropas 1082 | sem upgrade estrutural | sem confronto |
| 63 | III: Fortificacao | M 45957 | S 32087 | E 29261 | I 5246 | 1723 | 1097 | Sem marco novo | Influencia 1723 (+8) | aldeias 7 | tropas 1097 | sem upgrade estrutural | sem confronto |
| 64 | III: Fortificacao | M 47253 | S 32977 | E 30089 | I 5389 | 1730 | 1111 | Sem marco novo | Influencia 1730 (+7) | aldeias 7 | tropas 1111 | sem upgrade estrutural | sem confronto |
| 65 | III: Fortificacao | M 48549 | S 33865 | E 30917 | I 5532 | 1737 | 1126 | Sem marco novo | Influencia 1737 (+7) | aldeias 7 | tropas 1126 | sem upgrade estrutural | sem confronto |
| 66 | III: Fortificacao | M 50032 | S 34889 | E 31867 | I 5696 | 1853 | 1141 | Sem marco novo | Influencia 1853 (+116) | aldeias 8 | tropas 1141 | sem upgrade estrutural | sem confronto |
| 67 | III: Fortificacao | M 51515 | S 35914 | E 32817 | I 5860 | 1861 | 1155 | Sem marco novo | Influencia 1861 (+8) | aldeias 8 | tropas 1155 | sem upgrade estrutural | sem confronto |
| 68 | III: Fortificacao | M 52998 | S 36937 | E 33767 | I 6024 | 1867 | 1170 | Sem marco novo | Influencia 1867 (+6) | aldeias 8 | tropas 1170 | sem upgrade estrutural | sem confronto |
| 69 | III: Fortificacao | M 54481 | S 37959 | E 34717 | I 6188 | 1875 | 1185 | Sem marco novo | Influencia 1875 (+8) | aldeias 8 | tropas 1185 | sem upgrade estrutural | sem confronto |
| 70 | III: Fortificacao | M 55964 | S 38980 | E 35667 | I 6352 | 1883 | 1200 | Sem marco novo | Influencia 1883 (+8) | aldeias 8 | tropas 1200 | sem upgrade estrutural | sem confronto |
| 71 | III: Fortificacao | M 57447 | S 40002 | E 36617 | I 6516 | 1889 | 1214 | Sem marco novo | Influencia 1889 (+6) | aldeias 8 | tropas 1214 | sem upgrade estrutural | sem confronto |
| 72 | III: Fortificacao | M 58930 | S 41022 | E 37567 | I 6680 | 1997 | 1229 | Contratou Navegador (2a vaga) + Contratou Navegador (2a vaga) | Influencia 1997 (+108) | aldeias 8 | tropas 1229 | sem upgrade estrutural | sem confronto |
| 73 | III: Fortificacao | M 60413 | S 42041 | E 38517 | I 6844 | 2005 | 1244 | Ergueu/garantiu Maravilha 3 | Influencia 2005 (+8) | aldeias 8 | tropas 1244 | sem upgrade estrutural | sem confronto |
| 74 | III: Fortificacao | M 61896 | S 43061 | E 39467 | I 7008 | 2011 | 1258 | Sem marco novo | Influencia 2011 (+6) | aldeias 8 | tropas 1258 | sem upgrade estrutural | sem confronto |
| 75 | III: Fortificacao | M 63379 | S 44079 | E 40417 | I 7172 | 2019 | 1273 | Sem marco novo | Influencia 2019 (+8) | aldeias 8 | tropas 1273 | sem upgrade estrutural | sem confronto |
| 76 | III: Fortificacao | M 65048 | S 45233 | E 41488 | I 7356 | 2127 | 1288 | Sem marco novo | Influencia 2127 (+108) | aldeias 9 | tropas 1288 | sem upgrade estrutural | sem confronto |
| 77 | III: Fortificacao | M 66717 | S 46386 | E 42559 | I 7540 | 2133 | 1303 | Sem marco novo | Influencia 2133 (+6) | aldeias 9 | tropas 1303 | sem upgrade estrutural | sem confronto |
| 78 | III: Fortificacao | M 68386 | S 47540 | E 43630 | I 7724 | 2141 | 1317 | Sem marco novo | Influencia 2141 (+8) | aldeias 9 | tropas 1317 | sem upgrade estrutural | sem confronto |
| 79 | III: Fortificacao | M 70055 | S 48692 | E 44701 | I 7908 | 2149 | 1332 | Sem marco novo | Influencia 2149 (+8) | aldeias 9 | tropas 1332 | sem upgrade estrutural | sem confronto |
| 80 | III: Fortificacao | M 71724 | S 49843 | E 45772 | I 8092 | 2155 | 1347 | Sem marco novo | Influencia 2155 (+6) | aldeias 9 | tropas 1347 | sem upgrade estrutural | sem confronto |
| 81 | III: Fortificacao | M 73393 | S 50993 | E 46843 | I 8276 | 2163 | 1362 | Sem marco novo | Influencia 2163 (+8) | aldeias 9 | tropas 1362 | sem upgrade estrutural | sem confronto |
| 82 | III: Fortificacao | M 75062 | S 52144 | E 47914 | I 8460 | 2171 | 1376 | Sem marco novo | Influencia 2171 (+8) | aldeias 9 | tropas 1376 | sem upgrade estrutural | sem confronto |
| 83 | III: Fortificacao | M 76731 | S 53293 | E 48985 | I 8644 | 2177 | 1391 | Sem marco novo | Influencia 2177 (+6) | aldeias 9 | tropas 1391 | sem upgrade estrutural | sem confronto |
| 84 | III: Fortificacao | M 78720 | S 54721 | E 50236 | I 8928 | 2215 | 1406 | Concluiu Quest 3/3 | Influencia 2215 (+38) | aldeias 9 | tropas 1406 | sem upgrade estrutural | sem confronto |
| 85 | III: Fortificacao | M 80389 | S 55869 | E 51307 | I 9112 | 2222 | 1420 | Sem marco novo | Influencia 2222 (+7) | aldeias 9 | tropas 1420 | sem upgrade estrutural | sem confronto |
| 86 | III: Fortificacao | M 82244 | S 57153 | E 52500 | I 9316 | 2328 | 1435 | Sem marco novo | Influencia 2328 (+106) | aldeias 10 | tropas 1435 | sem upgrade estrutural | sem confronto |
| 87 | III: Fortificacao | M 84099 | S 58436 | E 53693 | I 9520 | 2331 | 1450 | Sem marco novo | Influencia 2331 (+3) | aldeias 10 | tropas 1450 | sem upgrade estrutural | sem confronto |
| 88 | III: Fortificacao | M 85954 | S 59718 | E 54886 | I 9724 | 2333 | 1465 | Sem marco novo | Influencia 2333 (+2) | aldeias 10 | tropas 1465 | sem upgrade estrutural | sem confronto |
| 89 | III: Fortificacao | M 87809 | S 61001 | E 56079 | I 9928 | 2336 | 1479 | Sem marco novo | Influencia 2336 (+3) | aldeias 10 | tropas 1479 | sem upgrade estrutural | sem confronto |
| 90 | III: Fortificacao | M 89664 | S 62282 | E 57272 | I 10132 | 2339 | 1494 | [MARCO] Gate do Portal + Chegou ao D90 com 10 aldeias + Agrupamento liberado na Capital | Influencia 2339 (+3) | aldeias 10 | tropas 1494 | sem upgrade estrutural | sem confronto |
| 91 | IV: Exodo | M 91528 | S 63578 | E 58472 | I 10336 | 2402 | 1460 | [MARCO] Inicio do Exodus + Ativou Domo da Tribo | Influencia 2402 (+63) | aldeias 10 | tropas 1460 | sem upgrade estrutural | sem confronto |
| 92 | IV: Exodo | M 93392 | S 64876 | E 59672 | I 10540 | 2407 | 1425 | Sem marco novo | Influencia 2407 (+5) | aldeias 10 | tropas 1425 | sem upgrade estrutural | sem confronto |
| 93 | IV: Exodo | M 95256 | S 66176 | E 60872 | I 10744 | 2411 | 1391 | Sem marco novo | Influencia 2411 (+4) | aldeias 10 | tropas 1391 | sem upgrade estrutural | sem confronto |
| 94 | IV: Exodo | M 97120 | S 67478 | E 62072 | I 10948 | 2414 | 1356 | Sem marco novo | Influencia 2414 (+3) | aldeias 10 | tropas 1356 | sem upgrade estrutural | sem confronto |
| 95 | IV: Exodo | M 98984 | S 68781 | E 63272 | I 11152 | 2419 | 1322 | Sem marco novo | Influencia 2419 (+5) | aldeias 10 | tropas 1322 | sem upgrade estrutural | sem confronto |
| 96 | IV: Exodo | M 100848 | S 70086 | E 64472 | I 11356 | 2423 | 1287 | Ergueu/garantiu Maravilha 4 | Influencia 2423 (+4) | aldeias 10 | tropas 1287 | sem upgrade estrutural | sem confronto |
| 97 | IV: Exodo | M 102712 | S 71393 | E 65672 | I 11560 | 2426 | 1253 | Sem marco novo | Influencia 2426 (+3) | aldeias 10 | tropas 1253 | sem upgrade estrutural | sem confronto |
| 98 | IV: Exodo | M 104576 | S 72701 | E 66872 | I 11764 | 2431 | 1218 | Sem marco novo | Influencia 2431 (+5) | aldeias 10 | tropas 1218 | sem upgrade estrutural | sem confronto |
| 99 | IV: Exodo | M 106440 | S 74011 | E 68072 | I 11968 | 2435 | 1184 | Sem marco novo | Influencia 2435 (+4) | aldeias 10 | tropas 1184 | sem upgrade estrutural | sem confronto |
| 100 | IV: Exodo | M 108304 | S 75323 | E 69272 | I 12172 | 2438 | 1149 | Sem marco novo | Influencia 2438 (+3) | aldeias 10 | tropas 1149 | sem upgrade estrutural | sem confronto |
| 101 | IV: Exodo | M 110168 | S 76637 | E 70472 | I 12376 | 2443 | 1115 | Sem marco novo | Influencia 2443 (+5) | aldeias 10 | tropas 1115 | sem upgrade estrutural | sem confronto |
| 102 | IV: Exodo | M 112032 | S 77952 | E 71672 | I 12580 | 2447 | 1080 | Sem marco novo | Influencia 2447 (+4) | aldeias 10 | tropas 1080 | sem upgrade estrutural | sem confronto |
| 103 | IV: Exodo | M 113896 | S 79269 | E 72872 | I 12784 | 2450 | 1046 | Sem marco novo | Influencia 2450 (+3) | aldeias 10 | tropas 1046 | sem upgrade estrutural | sem confronto |
| 104 | IV: Exodo | M 115760 | S 80588 | E 74072 | I 12988 | 2455 | 1011 | Sem marco novo | Influencia 2455 (+5) | aldeias 10 | tropas 1011 | sem upgrade estrutural | sem confronto |
| 105 | IV: Exodo | M 117624 | S 81908 | E 75272 | I 13192 | 2459 | 977 | Sem marco novo | Influencia 2459 (+4) | aldeias 10 | tropas 977 | sem upgrade estrutural | sem confronto |
| 106 | IV: Exodo | M 119488 | S 83230 | E 76472 | I 13396 | 2462 | 942 | Ergueu/garantiu Maravilha 5 | Influencia 2462 (+3) | aldeias 10 | tropas 942 | sem upgrade estrutural | sem confronto |
| 107 | IV: Exodo | M 121352 | S 84554 | E 77672 | I 13600 | 2467 | 908 | Sem marco novo | Influencia 2467 (+5) | aldeias 10 | tropas 908 | sem upgrade estrutural | sem confronto |
| 108 | IV: Exodo | M 123216 | S 85880 | E 78872 | I 13804 | 2470 | 873 | Sem marco novo | Influencia 2470 (+3) | aldeias 10 | tropas 873 | sem upgrade estrutural | sem confronto |
| 109 | IV: Exodo | M 125080 | S 87207 | E 80072 | I 14008 | 2474 | 839 | Sem marco novo | Influencia 2474 (+4) | aldeias 10 | tropas 839 | sem upgrade estrutural | sem confronto |
| 110 | IV: Exodo | M 126944 | S 88536 | E 81272 | I 14212 | 2479 | 804 | Horda contida sem perda de aldeia | Influencia 2479 (+5) | aldeias 10 | tropas 804 | sem upgrade estrutural | 1 confronto(s) |
| 111 | IV: Exodo | M 128808 | S 89867 | E 82472 | I 14416 | 2480 | 770 | Sem marco novo | Influencia 2480 (+1) | aldeias 10 | tropas 770 | sem upgrade estrutural | sem confronto |
| 112 | IV: Exodo | M 130672 | S 91199 | E 83672 | I 14620 | 2481 | 735 | Sem marco novo | Influencia 2481 (+1) | aldeias 10 | tropas 735 | sem upgrade estrutural | sem confronto |
| 113 | IV: Exodo | M 132536 | S 92533 | E 84872 | I 14824 | 2483 | 701 | Sem marco novo | Influencia 2483 (+2) | aldeias 10 | tropas 701 | sem upgrade estrutural | sem confronto |
| 114 | IV: Exodo | M 134400 | S 93869 | E 86072 | I 15028 | 2484 | 666 | [MARCO] Marcha iniciada + Iniciou marcha ao Portal | Influencia 2484 (+1) | aldeias 10 | tropas 666 | sem upgrade estrutural | sem confronto |
| 115 | IV: Exodo | M 136264 | S 95207 | E 87272 | I 15232 | 2485 | 632 | Sem marco novo | Influencia 2485 (+1) | aldeias 10 | tropas 632 | sem upgrade estrutural | sem confronto |
| 116 | IV: Exodo | M 138128 | S 96546 | E 88472 | I 15436 | 2487 | 597 | Sem marco novo | Influencia 2487 (+2) | aldeias 10 | tropas 597 | sem upgrade estrutural | sem confronto |
| 117 | IV: Exodo | M 139992 | S 97887 | E 89672 | I 15640 | 2488 | 563 | [MARCO] Entrada no Portal + Entrou no Portal | Influencia 2488 (+1) | aldeias 10 | tropas 563 | sem upgrade estrutural | sem confronto |
| 118 | IV: Exodo | M 141856 | S 99230 | E 90872 | I 15844 | 2489 | 528 | Sem marco novo | Influencia 2489 (+1) | aldeias 10 | tropas 528 | sem upgrade estrutural | sem confronto |
| 119 | IV: Exodo | M 143720 | S 100574 | E 92072 | I 16048 | 2491 | 494 | Sem marco novo | Influencia 2491 (+2) | aldeias 10 | tropas 494 | sem upgrade estrutural | sem confronto |
| 120 | IV: Exodo | M 145584 | S 101920 | E 93272 | I 16252 | 2492 | 459 | Sem marco novo | Influencia 2492 (+1) | aldeias 10 | tropas 459 | sem upgrade estrutural | sem confronto |

### Checkpoints jogaveis do jogador em foco

| Dia | Economia | Expansao | Militar | Influencia | Risco final | Colapsos |
| ---: | --- | --- | --- | --- | --- | --- |
| 10 | estavel | ideal | estavel | abaixo da curva esperada | alto | - |
| 20 | estavel | agressiva | estavel | abaixo da curva esperada | alto | - |
| 30 | estavel | agressiva | estavel | abaixo da curva esperada | alto | - |
| 60 | estavel | agressiva | estavel | acima da curva esperada | baixo | - |
| 90 | estavel | agressiva | estavel | dentro da curva esperada | baixo | - |
| 120 | estavel | ideal | critico | dentro da curva esperada | alto | tropas gastas em confronto |

## Marcos por run

### metropole-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2500 de influencia.
- 2a aldeia: D12 | 1a aldeia 100/100: D39 | Marcha: D114 | ETA 82.39h

- Dias criticos:
- D12: 2a aldeia fundada
- D39: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D114: Marcha iniciada
- D117: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 130 | 1 | 316 | M 1062 | S 1354 | E 960 | I 120 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 384 | 3 | 463 | M 5439 | S 4311 | E 3612 | I 689 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 652 | 4 | 611 | M 11687 | S 8557 | E 7520 | I 1383 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1701 | 7 | 1052 | M 42069 | S 29416 | E 26777 | I 4817 | economia estavel | expansao agressiva | militar estavel | influencia acima da curva esperada | risco baixo | - |
| 90 | 2339 | 10 | 1494 | M 89664 | S 62282 | E 57272 | I 10132 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2492 | 10 | 459 | M 145584 | S 101920 | E 93272 | I 16252 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### metropole-lazy

- Representante: H01
- Resultado: Falhou porque foi eliminado por PvP antes da janela final.
- 2a aldeia: D14 | 1a aldeia 100/100: D43 | Marcha: Dnull | ETA 0h

- Dias criticos:
- D14: 2a aldeia fundada
- D43: 1a aldeia 100/100
- D91: Inicio do Exodus
- D120: Falha por eliminacao PvP | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 111 | 1 | 369 | M 1050 | S 1310 | E 949 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 247 | 2 | 541 | M 4109 | S 3246 | E 2781 | I 444 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 394 | 3 | 712 | M 8911 | S 6306 | E 5737 | I 817 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 824 | 4 | 1228 | M 28597 | S 18973 | E 18067 | I 2749 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1285 | 6 | 1743 | M 57911 | S 38000 | E 36681 | I 5829 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 860 | 2 | 895 | M 79910 | S 52191 | E 50560 | I 8112 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### posto-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2400 de influencia.
- 2a aldeia: D14 | 1a aldeia 100/100: D46 | Marcha: D115 | ETA 72h

- Dias criticos:
- D14: 2a aldeia fundada
- D46: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D115: Marcha iniciada
- D118: Entrada no Portal
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 116 | 1 | 300 | M 1048 | S 1019 | E 1234 | I 126 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 356 | 3 | 465 | M 4631 | S 3400 | E 3457 | I 625 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 514 | 4 | 629 | M 10435 | S 7331 | E 7217 | I 1295 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1700 | 7 | 1122 | M 39909 | S 27578 | E 26613 | I 4725 | economia estavel | expansao agressiva | militar estavel | influencia acima da curva esperada | risco baixo | - |
| 90 | 2337 | 10 | 1615 | M 86787 | S 59962 | E 57793 | I 10129 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2391 | 9 | 869 | M 139377 | S 96972 | E 92908 | I 16084 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto |

### posto-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D19 | 1a aldeia 100/100: D46 | Marcha: D113 | ETA 109.69h

- Dias criticos:
- D19: 2a aldeia fundada
- D46: 1a aldeia 100/100
- D91: Inicio do Exodus
- D113: Marcha iniciada
- D118: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 93 | 1 | 359 | M 1043 | S 979 | E 1225 | I 120 | economia estavel | expansao lenta | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 241 | 2 | 540 | M 3330 | S 2354 | E 2565 | I 458 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 380 | 3 | 721 | M 7344 | S 4843 | E 5107 | I 758 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 743 | 4 | 1265 | M 26390 | S 17143 | E 17482 | I 2813 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1243 | 6 | 1808 | M 54848 | S 35596 | E 36232 | I 5864 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 819 | 2 | 1029 | M 76627 | S 49588 | E 50506 | I 8173 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### bastiao-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2500 de influencia.
- 2a aldeia: D9 | 1a aldeia 100/100: D44 | Marcha: D115 | ETA 51.63h

- Dias criticos:
- D9: 2a aldeia fundada
- D44: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D115: Marcha iniciada
- D117: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 167 | 2 | 317 | M 1397 | S 1788 | E 1446 | I 166 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 352 | 3 | 476 | M 6210 | S 5048 | E 4443 | I 802 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 508 | 4 | 634 | M 12180 | S 8995 | E 8239 | I 1356 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1627 | 6 | 1109 | M 40173 | S 27993 | E 26308 | I 4637 | economia estavel | expansao agressiva | militar estavel | influencia acima da curva esperada | risco baixo | - |
| 90 | 2239 | 9 | 1584 | M 82586 | S 56877 | E 53996 | I 9541 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2492 | 10 | 799 | M 134608 | S 93249 | E 88168 | I 15441 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### bastiao-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D13 | 1a aldeia 100/100: D52 | Marcha: D112 | ETA 156.16h

- Dias criticos:
- D13: 2a aldeia fundada
- D52: 1a aldeia 100/100
- D91: Inicio do Exodus
- D112: Marcha iniciada
- D119: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 75 | 1 | 258 | M 1045 | S 1569 | E 1220 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 164 | 2 | 387 | M 4242 | S 3689 | E 3188 | I 464 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 273 | 3 | 515 | M 9260 | S 7078 | E 6366 | I 1006 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 693 | 4 | 902 | M 28861 | S 20186 | E 18925 | I 3126 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1143 | 6 | 1288 | M 57563 | S 39379 | E 37534 | I 6207 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 821 | 3 | 708 | M 82133 | S 55899 | E 53419 | I 8827 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### celeiro-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2500 de influencia.
- 2a aldeia: D14 | 1a aldeia 100/100: D47 | Marcha: D116 | ETA 48h

- Dias criticos:
- D14: 2a aldeia fundada
- D47: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D116: Marcha iniciada
- D118: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 110 | 1 | 350 | M 1044 | S 1397 | E 1509 | I 126 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 344 | 3 | 530 | M 4444 | S 3600 | E 3646 | I 597 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 424 | 3 | 711 | M 9763 | S 7047 | E 7146 | I 1067 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1605 | 6 | 1251 | M 37043 | S 25464 | E 25441 | I 4236 | economia estavel | expansao agressiva | militar estavel | influencia acima da curva esperada | risco baixo | - |
| 90 | 2200 | 9 | 1792 | M 79737 | S 54453 | E 54381 | I 9121 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2494 | 10 | 646 | M 132601 | S 91657 | E 90433 | I 15037 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### celeiro-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D15 | 1a aldeia 100/100: D42 | Marcha: D112 | ETA 122.05h

- Dias criticos:
- D15: 2a aldeia fundada
- D42: 1a aldeia 100/100
- D91: Inicio do Exodus
- D112: Marcha iniciada
- D117: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 94 | 1 | 335 | M 1056 | S 1427 | E 1527 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 212 | 2 | 482 | M 3926 | S 3267 | E 3349 | I 418 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 351 | 3 | 630 | M 8526 | S 6237 | E 6357 | I 762 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 725 | 4 | 1071 | M 28034 | S 19134 | E 19363 | I 2795 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1146 | 6 | 1513 | M 57149 | S 38477 | E 38996 | I 5816 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 882 | 1 | 1173 | M 76559 | S 50808 | E 51950 | I 7811 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

