# Prompt Supremo - Seeds de Impacto Total (KingsWorld)

Contexto:
Voce e o Arquiteto de Simulacao do KingsWorld. O jogo tem 120 dias, mapa hex raio 40, cap 50 players e pool de Influencia (0-2500).
A simulacao precisa medir impacto real das escolhas, sem numeros fantasiosos e sem travar datas fixas.

Objetivo:
Gerar um pacote de seeds que prove causalidade de gameplay: buildings, herois, pesquisas, tropas, capital inicial, posicao de spawn e logistica devem alterar score final e chance de chegada ao Portal.

## Regras duras
1. Influencia maxima por player: 2500 (nunca ultrapassar).
2. Corte do Portal: 1500 (sobrevive se chegar ao 0,0 com >=1500).
3. Edificios: 10 por aldeia, nivel maximo 10 cada.
4. Cada aldeia no 100/100 vale 100 de Influencia para o pilar de predios.
5. Maximo de 10 aldeias por player.
6. Tropa nasce e fica centralizada na Capital (pool unico).
7. Defesa de aldeia: modo "chamar todas" para reforco.
8. Marcha para tile amigavel (apoio/doacao): usar velocidade interna x5 sobre malha conectada.
9. Doacao e apoio sao unidirecionais (sem troca bilateral).
10. Simulacao deve aceitar erro humano real: ordem ruim de build/pesquisa pode atrasar marcos ou inviabilizar portal.

## Modelo de score (fonte unica)
- Predios: 1000
- Poder Militar: 500
- Quests de Era: 300
- Conselho (5 especialistas): 250
- Maravilhas (5 slots): 250
- Domo de Tribo: 200

## Especialistas (herois)
- Engenheiro: aceleracao de obra e prerequisito de Maravilha.
- Marechal: qualidade militar e upkeep.
- Navegador: ETA de marcha ao centro.
- Intendente: throughput de doacao e apoio interno.
- Erudito: pesquisa nas branches.

## Branches de pesquisa
- Urbana (economia/custo)
- Tatica (ataque/elite)
- Defensiva (muralha/horda)
- Fluxo (estrada/marcha/carga)

## Setup de execucao
1. Rodar 100 seeds totais:
- 25 Metropole
- 25 Posto Avancado
- 25 Bastiao
- 25 Celeiro
2. Em cada perfil:
- 5 seeds de "execucao perfeita"
- 10 seeds de "execucao boa"
- 10 seeds de "execucao com erros"
3. Spawn distribuido por distancia ao centro (perto, medio, longe) e por distrito.
4. Adicionar variancia controlada em eventos NPC (horda, guardioes, oportunidades de saque).

## Logs obrigatorios por seed
- Dia da 2a aldeia.
- Dia da 1a aldeia 100/100.
- Evolucao de Influencia nos dias 15, 30, 60, 90, 120.
- Aldeias ativas vs perdidas.
- Tropas vivas vs mortas (PvE horda / PvP).
- Heroi contratado por janela (early/mid/late) e impacto estimado.
- Branch principal escolhida e branch secundaria.
- ETA previsto e ETA real da marcha final ao centro.
- Resultado: barrado (<1500), chegou e morreu na trilha, sobreviveu no portal, top score.

## Auditoria de impacto (obrigatoria)
Calcular, com base nas 100 seeds:
1. Importancia relativa (%) das 10 variaveis abaixo no outcome final:
- Arquétipo de Capital
- Arquitetura de Construcao
- Timing de Expansao
- Desafio de Ocupacao
- Guarnicao de Oficiais
- Eficacia Militar
- Soberania de Tribo
- Gestao de Quests
- Exodo Final
- Resiliencia de Horda
2. Detectar:
- Variaveis mortas (impacto ~0)
- Variaveis opressivas (uma unica variavel decide tudo)
- Build trap (custos altos com retorno baixo)

## Criterios de equilibrio esperados
- Aproximadamente 15/50 chegam ao Portal por mundo simulado (30% de sobrevivencia final).
- As 4 builds precisam ter winrate proxima (evitar build dominante).
- Nao usar datas fixas; marcos devem variar por qualidade de decisao.
- ETA final sem Navegador/Fluxo deve punir; com ambos deve ficar viavel (faixa alvo 48h-72h na janela final).

## Saida exigida
1. `simulations/output/season_v3_seed_matrix.csv`
- uma linha por seed com todas as metricas.
2. `simulations/output/season_v3_impact_report.md`
- resumo executivo
- tabela de impacto percentual das 10 variaveis
- gargalos atuais
- 5 recomendacoes de buff/nerf (com racional matematico)
3. `simulations/output/season_v3_build_balance.md`
- comparativo dos 4 perfis
- onde cada perfil ganha/perde no ciclo de 120 dias
- risco de exploit por fase

## Regra anti-alucinacao
- Se qualquer Influencia > 2500 aparecer, a execucao e invalida.
- Se os dados nao sustentarem uma afirmacao, marcar como "inconclusivo".
- Nao inventar numero: toda conclusao deve citar metrica observada.

Entregue os 3 arquivos e um bloco final com "Mudancas sugeridas no GameBalance.ts" em formato de checklist.
