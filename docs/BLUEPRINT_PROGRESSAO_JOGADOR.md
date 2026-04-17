# KingsWorld - Blueprint de Progressao do Jogador

Base:
- [analise_progressao.md](/C:/Users/Afonso/Desktop/PROJECTS%20NOTES/KingsWorld/analise_progressao.md)
- [season_v2_paired8_journeys.md](/C:/Users/Afonso/Desktop/PROJECTS%20NOTES/KingsWorld/simulations/output/season_v2_paired8_journeys.md)
- [season_v2_120d_report.md](/C:/Users/Afonso/Desktop/PROJECTS%20NOTES/KingsWorld/simulations/output/season_v2_120d_report.md)

Observacao importante:
- O simulador atual nao grava "cada clique" literal.
- O que segue abaixo e um **blueprint reconstruido**, usando marcos reais das seeds: dia da 2a aldeia, dia da 1a aldeia 100/100, herois contratados, quests, maravilhas, tropas, perdas e ETA.
- Para virar log exato de seed, o proximo passo tecnico e adicionar `actionTimeline[]` no simulador.

## Leitura rapida do `analise_progressao.md`

O arquivo novo reforca 4 pontos que batem com o estado atual do simulador:
- Rush inicial de recursos ate Nv 3 ainda e o melhor acelerador universal.
- Metropole rende mais quando sobe Palacio/Senado cedo e converte isso em vila 100 e Maravilha.
- Posto Avancado ganha valor quando transforma exploracao e pressao militar em expansao mais agressiva.
- O mundo ja se comporta com bots/humanos sob a mesma fisica e usa ajustes de branch para evitar estagnacao total.

## Blueprint universal de uma run forte

### Janela 1: Dia 1-5
- Subir `Minas` e `Fazendas` ate Nv 3.
- Subir o eixo que define a build:
  - `Palacio` + `Senado` se o foco for Metropole.
  - `Quartel` + `Arsenal` se o foco for Posto Avancado.
  - `Muralha` + `Habitacoes` se o foco for Bastiao.
  - `Fazendas` + `Habitacoes` + malha interna se o foco for Celeiro.
- Fazer buscas/coletas logo cedo. No modelo atual isso entra via `explorationSorties`, `raidLootScore` e `explorationBonus`.

### Janela 2: Dia 6-15
- Fechar os upgrades de abertura sem desperdiçar recurso em 10 predios ao mesmo tempo.
- Formar o primeiro bloco de exercito na Capital.
- Contratar o primeiro heroi util para a build.
- Conquistar ou fundar a 2a aldeia perto do Dia 15.

### Janela 3: Dia 16-45
- Parar de espalhar nivel e escolher uma vila para virar a primeira `100/100`.
- Fazer Quest 1.
- Contratar o 2o e 3o heroi.
- Abrir a economia ou a pressao militar conforme o spawn e a branch.

### Janela 4: Dia 46-90
- Subir o numero de aldeias para 7-10.
- Garantir que o pilar militar, quests e conselho nao fiquem para tras.
- Se tiver `Engenheiro`, converter vila 100 em Maravilha.
- Se o spawn for longe, `Navegador` deixa de ser opcional.

### Janela 5: Dia 91-120
- Agrupar na Capital.
- Marchar so quando a conta de Influencia continuar acima de 1500 mesmo com perdas.
- Quem chega melhor nao e o que construiu mais cedo; e quem segurou predios + conselho + quests + ETA sem colapsar.

## Rota vencedora por arquétipo

## 1. Metropole forte

Seed de referencia:
- `metropole-perfect`
- 2a aldeia: D11
- 1a aldeia 100: D39
- D90: 2200
- D120: 2500
- Herois: 5/5
- Quests: 3/3
- Maravilhas: 4/5

Passo a passo reconstruido:
1. D1-D5: `Minas 3`, `Fazendas 3`, `Palacio 3`, `Senado 3`.
2. D6-D11: segurar recurso para a 2a aldeia, sem gastar demais em tropa cedo.
3. D12-D25: expandir para 3-4 aldeias, contratar `Engenheiro`, fazer Quest 1.
4. D26-D39: empurrar uma aldeia para `100/100`, abrir `Erudito` e `Intendente`.
5. D40-D60: transformar a aldeia maxada em base de Maravilha, continuar economia urbana.
6. D61-D90: contratar `Marechal` e `Navegador`, fechar Quest 2 e 3, levar o império a 10 aldeias.
7. D91-D120: reagrupar, marchar tarde e entrar com score cheio.

O que realmente importa:
- O ponto de virada aqui e a primeira aldeia 100 antes de D40-D45.
- Se `Engenheiro` nao entra, a build perde muito teto porque as Maravilhas atrasam.
- Se a branch sai de `urban`, a run costuma continuar viva, mas perde consistencia.

Rota que trava:
- `metropole-faulty`
- 2a aldeia D14, 1a 100 D54, 2 herois, 1 quest, 0 maravilhas.

Erro dominante:
- Cresceu, mas nao converteu crescimento em pilares de score.
- Ficou com predio razoavel e quase nenhum conselho/conquista.
- Resultado: D90 1172, barrado por Influencia.

## 2. Posto Avancado forte

Seed de referencia:
- `posto-perfect`
- 2a aldeia: D14
- 1a aldeia 100: D38
- D90: 2100
- D120: 2500
- Herois: 5/5
- Quests: 3/3
- Maravilhas: 4/5

Passo a passo reconstruido:
1. D1-D5: `Minas 3`, `Fazendas 3`, `Quartel 3`, `Arsenal 3`.
2. D6-D14: formar exercito inicial na Capital, fazer buscas/coletas e pressao de mapa.
3. D15-D25: garantir Quest 1, contratar `Marechal`, manter o militar subindo sem afundar a economia.
4. D26-D38: levar uma aldeia a `100/100`, contratar `Engenheiro`, abrir Maravilha 1.
5. D39-D60: aumentar aldeias via ocupacao agressiva e manter `Tatica` como branch principal.
6. D61-D90: contratar `Navegador` e `Intendente`, fechar o topo militar e quests.
7. D91-D120: agrupar, marchar e entrar com score alto e militar dominante.

O que realmente importa:
- Essa build vive de transformar combate em progresso, nao so em baixas.
- Se a pressao militar nao vira aldeia, quest ou score militar, a run seca.
- `Marechal` cedo e `Engenheiro` na transicao para vila 100 fazem diferenca real.

Rota que trava:
- `posto-faulty`
- 2a aldeia D19, 1a 100 D55, 2 herois, 1 quest, 0 maravilhas.

Erro dominante:
- Branch errada (`defensive`) para uma capital agressiva.
- Expandiu tarde e ficou sem conversao de forca em score.
- Resultado: muita presenca militar, pouca Influencia util.

## 3. Bastiao forte

Seed de referencia:
- `bastiao-perfect`
- 2a aldeia: D16
- 1a aldeia 100: D46
- D90: 1909
- D120: 2500
- Herois: 5/5
- Quests: 3/3
- Maravilhas: 5/5

Passo a passo reconstruido:
1. D1-D5: `Minas 3`, `Fazendas 3`, `Habitacoes 3`, `Muralha 3`.
2. D6-D16: estabilizar recurso e defesa antes de correr demais na expansao.
3. D17-D30: abrir 3-4 aldeias sem deixar muralha e base militar zeradas.
4. D31-D46: fazer a primeira aldeia `100/100`.
5. D47-D70: contratar `Engenheiro`, converter o core em cadeia de Maravilhas.
6. D71-D90: pegar `Navegador` mesmo sendo Bastiao, porque o problema final nao e sobreviver; e chegar.
7. D91-D120: agrupar tarde, sair com ETA dentro da janela viavel e segurar aldeias intactas.

O que realmente importa:
- Bastiao bom nao e bunker passivo.
- Ele vence quando troca parte da gordura defensiva por `Flow`/logistica na hora certa.
- O segredo da seed perfeita foi: defender bem no mid game, mas nao morrer abraçado na muralha.

Rota que trava:
- `bastiao-faulty`
- 2a aldeia D19, 1a 100 D65, 1 heroi, 0 quest, 0 maravilha, ETA 203h.

Erro dominante:
- Ficou forte demais em sobreviver e fraco demais em executar.
- Sem `Navegador`, sem score de conquista, sem janela real de marcha.
- Resultado: segurou aldeias por um tempo, mas morreu fora do portal.

## 4. Celeiro forte

Seed de referencia:
- `celeiro-perfect`
- 2a aldeia: D9
- 1a aldeia 100: D37
- D90: 1789
- D120: 2500
- Herois: 5/5
- Quests: 3/3
- Maravilhas: 5/5

Passo a passo reconstruido:
1. D1-D4: `Fazendas 3`, `Habitacoes 3`, `Minas 3`.
2. D5-D9: usar o folego logistico para acelerar a 2a aldeia antes dos outros.
3. D10-D22: contratar `Intendente`, ligar fluxo interno e alimentar a Capital com doacoes.
4. D23-D37: fechar a primeira aldeia `100/100`.
5. D38-D60: contratar `Engenheiro` e `Erudito`, abrir Maravilhas e empilhar quest.
6. D61-D90: contratar `Navegador`, usar branch `flow` para garantir ETA.
7. D91-D120: sair com timing bom; se sair tarde, a build cai de excelente para inviavel.

O que realmente importa:
- Celeiro e a build mais sensivel a execucao.
- Quando acerta `Intendente + Flow + Navegador`, ela vira candidata real a 2500.
- Quando erra a ordem, continua parecendo rica, mas nao fecha portal.

Rota que trava:
- `celeiro-faulty`
- 2a aldeia D17, 1a 100 D47, 1 heroi, 0 quest, 1 maravilha, ETA 165h.

Erro dominante:
- A build tinha economia, mas nao fechou o pacote logistico.
- Sem `Navegador` e sem conselho completo, o excedente de recurso nao vira score final.

## Checklist de ação por fase

## Early game bom
- Rush recurso ate Nv 3.
- Escolher 2 predios de identidade da build e nao upar tudo junto.
- Formar o primeiro pacote de tropas na Capital.
- Fazer buscas/coletas cedo.
- 2a aldeia entre D9 e D16 se a run estiver forte; acima disso ja virou alerta.

## Mid game bom
- Primeira Quest ate D20-D30.
- 1o heroi util ate D20-D30.
- Primeira aldeia 100 entre D37 e D46 nas runs excelentes; ate D45 continua aceitavel.
- Entre D45 e D60, decidir se o foco vai ser Maravilha, militar, ou abrir aldeias 5-7.

## Late game bom
- D90 precisa estar perto de 1800+ nas runs de topo.
- `Navegador` deixa de ser opcional quando o spawn e longe.
- `Engenheiro` e quase obrigatorio para teto alto.
- `Intendente` aumenta muito a consistencia das builds economicas.

## Sinais de run ruim
- 2a aldeia depois de D18.
- 1a aldeia 100 depois de D50-D55.
- D90 abaixo de 1200.
- 0-1 quest ate D90.
- 0 maravilhas em build que precisava de teto.
- ETA final acima de 90h sem margem clara de score.

## O que falta para virar "passo a passo real por seed"

Hoje o simulador guarda marcos, nao a ordem literal de cada acao. Para sair de "blueprint reconstruido" para "diario exato de seed", falta adicionar no `simulate-season-v2.mjs`:
- `actionTimeline[]` por player
- `day`
- `actionType` (`upgrade`, `recruit`, `hero_hire`, `quest`, `expand`, `wonder`, `march`, `scout`)
- `target` (`mines`, `palace`, `2nd_village`, `engineer`, etc.)
- `reason` (`rush_economia`, `segurar_horda`, `fechar_eta`, `buscar_1500`, etc.)

Quando isso entrar, o relatorio pode sair assim:
- D2: Minas -> Nv 2
- D3: Fazendas -> Nv 2
- D5: Quartel -> Nv 3
- D9: Recrutou 1200 Milicia
- D12: Contratou Engenheiro
- D14: Conquistou 2a aldeia

Esse e o proximo nivel certo para o simulador.
