# Design — Cidades abandonadas que evoluem (King's World #3 v2)

Data: 2026-06-05. Aprovado pelo dono. Spec fora do git (preferência do dono).

## Intenção
Substituir o "spawn fixo de 6 + NPC abocanha rápido" por um ecossistema de
cidades neutras que **persistem e evoluem devagar**, criando decisão de timing:
tomar cedo (barata/pequena) ou esperar crescer (valiosa/cara). Fundar uma cidade
nova continua sendo a alternativa barata-mas-vazia.

## Decisões (confirmadas com o dono)
- **NPC compete DEVAGAR** (não corrida): a maioria persiste e evolui; de vez em
  quando um NPC abocanha uma → urgência sem tirar a escolha do jogador.
- **~25 abandonadas por mundo**, espalhadas.
- **Todas começam minúsculas (~tamanho 3)** e crescem até um TETO por classe.

## Mecânica
### 1. Spawn (~25/mundo, idempotente: completa até 25)
Distribuição por classe (define teto de evolução + multiplicador de defesa):
| city_class      | qtd ~ | teto tamanho | papel        |
|-----------------|-------|--------------|--------------|
| neutral         | 15    | 8            | aldeola      |
| posto_avancado  | 7     | 18           | vila média   |
| bastiao         | 3     | 40           | fortaleza    |

Cada uma nasce com ~3 de infra (3 estruturas em slot_a=1). Cidades já existentes
não são resetadas (mix natural de "ruínas antigas" maiores).

### 2. Evolução lenta — `kw_abandoned_tick(world)`
- Cron próprio `kw-abandoned-grow` a cada 3 min (NÃO mexe no kw_world_tick, que
  não temos em arquivo de forma segura — isolar evita risco).
- Por cidade: chance ~15%/tick de ganhar +1 nível (incrementa o primeiro slot
  livre da estrutura menos desenvolvida), até o teto da classe.
- Velocidade resultante: ~+1 nível/20min. Pequena (teto 8) cheia em ~1.7h;
  fortaleza (teto 40) em ~12h. "Devagarinho".
- Probabilístico + limitado por teto -> re-rodar o cron não explode (sem anchor).

### 3. NPC compete devagar — `kw_npc_decide_attacks`
- Chance de expansão (mirar abandonada) cai de 60% -> **10%**. Resto igual
  (mira o mais fraco entre jogadores; humano=raide; NPC=conquista; abandonada=ocupa).

### 4. Conquistar vs Fundar (princípio de balanço)
- Conquistar abandonada: custo = exército (perdas no combate + sobreviventes ≥
  tamanho p/ ocupar). Maior = mais caro, mas vem com infra pronta. (já implementado)
- Fundar normal: começa do 0, custa MENOS tropa, mas vazia e demora pra render.
- Alvo: `custo_conquistar(tamanho) ≈ custo_fundar + tempo_construir_até_tamanho`.
- NOTA: o custo-de-fundar-em-tropa é lever de cliente/economia (hoje fundar custa
  materiais, não tropa). Fora do escopo deste SQL; afinar depois com simulação.

## Escopo deste entregável (SQL, testável no DB)
1, 2, 3. O item 4 é desenho/cliente, deploy-gated, fica documentado p/ depois.

## Verificação
- abandonadas total ~25; tamanhos pequenos no começo, subindo com o tempo.
- `kw-abandoned-grow` ativo, sem falha.
- ordens mirando abandonada existem mas raras (NPC devagar); claimed sobe devagar.
