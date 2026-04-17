# KingsWorld - Relatorio de Grip por Modo de Evolucao

Gerado em: 2026-03-08 16:39:17

## 1) Metodologia
- Base matematica: custo/tempo de upgrade do `GameBalance` (com growth, early acceleration, level pressure e multiplicador de Maravilha).
- Escopo: custo total para levar cada predio do nivel 1 ao 10.
- Grip (%) do modo: media da variacao absoluta de carga de recursos + tempo total vs modo Balanceado.

## 2) Grip Global por Modo (vs Balanceado)
| Modo | Delta Carga de Recursos | Delta Tempo | Grip (%) | Leitura |
|---|---:|---:|---:|---|
| Metropole | -0.6% | -1.4% | 1% | Acelera economia e pesquisa, encarece militar no inicio. |
| Posto Avancado | -0.6% | -2.1% | 1.3% | Forte em militar/ocupacao, economia menos eficiente. |
| Bastiao | +2.5% | -0.6% | 1.6% | Prioriza muralha e seguranca, ataque fica mais lento. |
| Celeiro de Fluxo | -1.4% | -2.9% | 2.2% | Logistica e suprimentos com foco na marcha final. |

## 3) Impacto por Predio (Delta de Carga vs Balanceado)
| Predio | Categoria | Metropole | Posto Avancado | Bastiao | Celeiro de Fluxo |
|---|---|---:|---:|---:|---:|
| Palacio | governance | -6,0% | 0,0% | -5,0% | 0,0% |
| Senado | governance | -6,0% | 0,0% | -5,0% | 0,0% |
| Minas | economy | -12,0% | +14,0% | -3,0% | -10,0% |
| Fazendas | economy | -12,0% | +14,0% | -3,0% | -10,0% |
| Habitacoes | economy | -12,0% | +14,0% | -3,0% | -10,0% |
| C. Pesquisa | research | -10,0% | +8,0% | 0,0% | -4,0% |
| Quartel | military | +12,0% | -14,0% | +12,0% | +8,0% |
| Arsenal | military | +12,0% | -14,0% | +12,0% | +8,0% |
| Muralha | defense | +8,0% | -8,0% | -16,0% | 0,0% |
| Maravilha | legacy | 0,0% | 0,0% | +6,0% | 0,0% |
| M. Viaria | logistics | 0,0% | -5,0% | 0,0% | -20,0% |

## 4) Leitura de Build (o que muda na pratica)
- `Metropole`: melhor abertura para Minas/Fazendas/Pesquisa; pior janela para Quartel/Arsenal no early.
- `Posto Avancado`: acelera militar e ocupacao; se atrasar economia, trava no mid game.
- `Bastiao`: melhor em Muralha/governanca defensiva; agressao pura fica mais cara.
- `Celeiro de Fluxo`: forte em Malha + economia de marcha; excelente para ETA do endgame.

## 5) Prova de Grip (resumo tecnico)
- O modo nao e cosmetico: altera custo/tempo real de upgrade por categoria de predio.
- A mesma ordem de build muda de resultado conforme o modo (efeito direto no pacing do jogador).
- O maior efeito observado ficou concentrado em categorias especializadas (militar, defesa, logistica), preservando diversidade de caminhos para 1500+.
