# Realtime Testing: 120 Dias em 1 Dia

## Objetivo
Executar uma temporada de 120 dias em 24h reais para validar balanceamento, economia e eventos.

## Configuracao
- Variavel de ambiente: `KINGSWORLD_RUNTIME_GAME_DAY_MS`
- Formula: `24h / 120 = 12 minutos por dia de jogo`
- Valor recomendado para o teste: `720000` (12 * 60 * 1000)

## Exemplo
```env
KINGSWORLD_RUNTIME_GAME_DAY_MS=720000
```

## Como funciona no runtime
- O mundo usa `runtime_anchor_day` + tempo decorrido desde `runtime_anchor_started_at`.
- O passo de dias usa `KINGSWORLD_RUNTIME_GAME_DAY_MS` em vez de 24h fixas.
- Com `720000`, a cada 12 minutos reais avanca 1 dia de jogo.

## Operacao sugerida
1. Criar um mundo de teste com `runtime_started=true` e `runtime_real_time_enabled=true`.
2. Definir `runtime_anchor_day=0` e `runtime_anchor_started_at=now()`.
3. Rodar observacao por 24h com checkpoints (D10, D30, D60, D90, D120).
4. Registrar metrics de economia, combate e quedas de sesi.

## Proximos passos tecnicos
1. Mover essa escala para coluna por mundo (ex.: `runtime_game_day_ms`) para operar mundos com ritmos diferentes.
2. Adicionar job de reconciliacao idempotente para eventos com hora exata.
3. Criar painel admin para pausar/retomar e ajustar escala sem deploy.
