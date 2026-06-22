# Blueprint 10 Gates — Lançamento (Template Multi-App)

> Template único pra **todos os apps** (King's World, GOL/Glyph, e os demais).
> Cada app copia este arquivo, preenche o cabeçalho e marca os gates.
> Ordem pensada pra **só tocar no Play Console no final** (Gate 10). A única coisa
> que precisa adiantar é subir o AAB no Closed testing (Gate 10) pra ligar o
> relógio dos 20 testers / 14 dias — fora isso, tudo é preparado antes.
>
> Billing detalhado: ver `docs/PAYWALL_PLAYBOOK_V2.md`.

---

## 0. Variáveis do app (preencher antes de tudo)

```
APP_NOME              =
PACKAGE_NAME          =            # com.empresa.app — único nas lojas
SUPABASE_PROJECT_REF  =
SUPABASE_URL          =            # https://<REF>.supabase.co
VERCEL_URL            =            # domínio público do frontend
LOGIN_COM_GOOGLE?     = sim / não  # decide se precisa de OAuth client
PRODUTOS:
  - productId =            | basePlanId =          | tipo = subscription / consumable / entitlement
  - productId =            | basePlanId =          | tipo =
SITE_MAE_URL          =            # onde ficam privacidade/termos/exclusão
```

### Legenda de status
`[ ]` pendente · `[~]` em andamento · `[x]` feito · `[N/A]` não se aplica

### 🔁 Compartilhado vs Por-App
- **1×/compartilhado** (serve todos os apps): Service Account do Google Cloud + JSON, conta de desenvolvedor Play, merchant profile, e (opcional) o site-mãe de políticas.
- **Por app**: tudo o resto (Play Console app, produtos, secrets Supabase, deploy da função, SQL, keystore, OAuth de login).

---

## Gate 1 — Ideia & Escopo Travado
- [ ] Manifesto / "superpoder" do app escrito
- [ ] Fluxo lógico de telas e decisões desenhado
- [ ] Stack confirmada (Next.js/Vite + Supabase + Vercel + Capacitor)
- [ ] **Variáveis da seção 0 preenchidas** (package, IDs de produto, tipo de monetização)
- [ ] **GATE:** escopo travado sem furos, IDs de produto decididos antes de codar

## Gate 2 — Infraestrutura
- [ ] Repo + 1º commit + **git ligado ao GitHub** (conferir `git remote -v`)
- [ ] Design system / Tailwind configurado
- [ ] Supabase ativo: tabelas base, RLS, Auth
- [ ] Deploy Vercel respondendo numa URL
- [ ] **GATE:** ambiente local + nuvem em harmonia, repo realmente sincronizando

## Gate 3 — Design
- [ ] Paleta + tipografia no código
- [ ] Componentes base (cards, botões, glass, modais)
- [ ] Navegação/menus padronizados
- [ ] **GATE:** estética de produto premium consolidada

## Gate 4 — Fluxo
- [ ] Roteamento completo entre telas principais
- [ ] Onboarding + telas core navegáveis
- [ ] **GATE:** caminho do usuário mapeado e percorrível

## Gate 5 — Engine & Regras
- [ ] Tipos TS estruturados, sem erros (`tsc --noEmit` limpo)
- [ ] Regras core / algoritmos implementados
- [ ] Smoke tests / simulações rodando e validando limites
- [ ] **GATE:** cérebro do app estável e à prova de falha lógica

## Gate 6 — Persistência
- [ ] Estado global integrado
- [ ] Persistência local + hydration (não reseta no F5)
- [ ] **GATE:** memória local indestrutível

## Gate 7 — Conexão
- [ ] Login real funcionando
- [ ] Sync estado local ↔ Supabase
- [ ] RLS protegendo cada tabela (usuário só lê/escreve o que é dele)
- [ ] Backup/perfil multi-dispositivo validado por teste humano
- [ ] **GATE:** app conectado, seguro, pronto pra usuários na nuvem

## Gate 8 — Refino & Billing (código)
**Billing — fluxo:** paywall nativo → Edge Function Supabase → Google Play API → RPC → libera benefício. (Detalhe: `PAYWALL_PLAYBOOK_V2.md`.)
- [ ] Sistema global de toasts / feedback de erro+sucesso em todas as pontas
- [ ] Performance (Lighthouse 90+ no web)
- [ ] Build Capacitor gerado e aberto em **dispositivo físico**
- [ ] `premium-config` (ou catálogo) como **fonte única** dos IDs (bate com seção 0)
- [ ] Paywall chama **compra nativa** (não libera benefício no client)
- [ ] Edge Function `verify-google-play-purchase` escrita (valida na Google API v3)
- [ ] RPC idempotente (lock + `revoke` do client) escrita
- [ ] SQL das tabelas/entitlements escrito
- [ ] **Zero** billing morto e **zero** secret de billing na Vercel
- [ ] **GATE:** produto de prateleira, billing 100% pronto em código

---
### 🚧 A PARTIR DAQUI É LANÇAMENTO — Play Console fica pro Gate 10 ↓
---

## Gate 9 — Conformidade & Nuvem (pré-loja, SEM Play Console)
Tudo que dá pra preparar **antes** de tocar no Play Console.

**Site-mãe / Conformidade legal:**
- [ ] Política de Privacidade publicada (URL pública) — *obrigatória no Play*
- [ ] Termos de Uso publicados
- [ ] Página/fluxo de **Exclusão de conta** (URL) — *exigência Google*

**Google Cloud (🔁 1× pra todos os apps):**
- [ ] Projeto Cloud criado
- [ ] **Google Play Android Developer API** habilitada
- [ ] **Service Account** criada + **chave JSON** gerada (tratar como senha)
- [ ] *(se LOGIN_COM_GOOGLE)* **OAuth Client** criado + redirect `https://<REF>.supabase.co/auth/v1/callback`

**Supabase (por app):**
- [ ] SQL rodado (tabelas + RPC) no SQL Editor
- [ ] Edge Function deployada (`supabase functions deploy ...`)
- [ ] Secret `GOOGLE_PLAY_PACKAGE_NAME` setado
- [ ] Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` setado (**a MESMA JSON em todos os apps**)
- [ ] `ALLOWED_ORIGINS` da função com o `VERCEL_URL` certo
- [ ] *(se LOGIN_COM_GOOGLE)* Provider Google habilitado no Supabase Auth

**Build / Assinatura:**
- [ ] **Keystore / Play App Signing** gerada e **guardada com segurança** (é pra sempre)
- [ ] AAB de release assinada gerada

**Assets de loja prontos (offline):**
- [ ] Ícone, feature graphic, screenshots, descrição curta/longa

- [ ] **GATE:** tudo pronto e validado em homologação; só falta a vitrine da loja

## Gate 10 — Play Console & Produto Vivo (por último)
**Conta & vínculo (🔁 1× pra todos):**
- [ ] Conta de desenvolvedor Play ativa ($25)
- [ ] **Payments / Merchant profile** (dados fiscais + banco) — *sem isso não recebe*
- [ ] **API access** → **vincular a Service Account** (View financial data + Manage orders & subscriptions)

**App (por app):**
- [ ] Criar app (nome + `PACKAGE_NAME`)
- [ ] Store listing (assets do Gate 9) + Privacy Policy URL
- [ ] **Data Safety** form + **Content rating** + Target audience + Ads declaration
- [ ] Criar **produtos/assinaturas** com os IDs **exatos** da seção 0 (+ base plan)
- [ ] Subir AAB em **Internal testing** → depois **Closed testing**
- [ ] **License testers** adicionados

**Validação real (smoke ponta-a-ponta):**
- [ ] Comprar como license tester → benefício liberado
- [ ] Conferir no banco (`user_entitlements` / wallet) — linha correta, idempotência ok
- [ ] Reabrir app → estado persiste · **Restaurar** funciona sem cobrar de novo

**Trava de produção & vida:**
- [ ] ⏳ **20 testers por 14 dias** no Closed testing (contas dev pessoais pós-2023)
- [ ] Promover pra **Produção**
- [ ] ASO (keywords + screenshots profissionais)
- [ ] Monitoramento de métricas + início de tráfego
- [ ] **GATE:** receita ativa, escala ligada, produto vivo

---

## Mapa de dependências (resumo)
```
Gates 1–7  : construir o produto
Gate 8     : billing PRONTO em código
Gate 9     : políticas + Google Cloud (SA) + Supabase secrets/func/SQL + keystore   (sem Play Console)
Gate 10    : Play Console (app, produtos, testing, 20/14d) + smoke real + produção
```
**Único item de Play Console que não dá pra deixar pro fim:** subir o AAB no Closed testing,
porque o relógio dos 14 dias só começa depois disso. Todo o resto da loja vem por último.

## Histórico
| Versão | Data | Mudança |
|--------|------|---------|
| v2-lançamento | 2026-05-30 | Reescrita dos gates 8–10 com billing, Google Cloud, conformidade e Play Console por último; virou template multi-app |
| v1 | — | `MATURITY_BLUEPRINT.md` original (foco em construir o produto) |
