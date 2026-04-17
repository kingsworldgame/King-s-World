# KingsWorld: Análise de Progressão e Lógica de Rede (Soberano 2.1)

## 1. O Mapa de Progressão Eficiente
Para maximizar o retorno sobre investimento (ROI), o caminho ótimo não é linear. O sistema de **Níveis de Ruptura (Breakthroughs)** dita o ritmo:

### Estratégia "Vanguarda" (Foco em Exército)
1.  **Rush Minas/Farms Nv 3**: Garante o primeiro spike de produção para sustentar o treino inicial.
2.  **Arsenal/Barracks Nv 3**: Libera slots de treino e bônus de qualidade.
3.  **Expansão**: Fundar a 2ª aldeia antes do Dia 15 é crítico para dobrar a base de produção.

### Estratégia "Metrópole" (Foco em Evolução)
1.  **Rush Palace/Senate Nv 3**: Maximiza o ganho de Influência passiva e o teto de recursos.
2.  **Mines Nv 7**: Onde ocorre a "Maturidade Industrial". O salto de produção permite sustentar múltiplos upgrades simultâneos.
3.  **Maravilhas**: Construir a primeira Maravilha logo após o Nv 100 da primeira vila para consolidar o score de Sovereignty.

---

## 2. Lógica de "Vasculhar" (Scouring/Exploration)
O motor já possui a lógica de **Sorties de Exploração**:
-   **Mecânica**: Depende da `Agressividade` do perfil e da Branch `Tactical`.
-   **Impacto**: Gera um `RaidLootScore` que é convertido em bônus de recursos e `ExplorationBonus` (que reduz o tempo de upgrade e aumenta o benefício de prédios).
-   **Bots**: Na simulação V2, os 42 bots executam essas sorties diariamente com base em seus perfis (Posto Avançado vasculha mais que Cidade-Estado).

---

## 3. Comportamento Ambiental (Bots & Mundo)
O motor de simulação (`simulate-season-v2.mjs`) trata bots e humanos sob a mesma "física" de jogo:
-   **Decisão de Expansão**: Bots decidem expandir baseando-se no `expansionBias`.
-   **Ações de Mapa**: Bots realizam marchas, ataques à Horda e defesa de fronteira.
-   **Equilíbrio**: Se muitos players (bots ou humanos) estiverem estagnados, o motor aplica um `branchBuff` automático para garantir que o Portal seja alcançado por uma massa crítica de sobreviventes (alvo ~15 por seed).

---

## 4. Auditoria de Balanço (Correção Nv 10)
Reduzimos o multiplicador de Nv 10 de **4.0x** para **2.6x**. 
-   **Antes**: Nv 10 era ~50% superior ao Nv 9.
-   **Depois**: Nv 10 é ~20% superior ao Nv 9. 
Isso mantém o senso de conquista sem quebrar a economia do late-game.
