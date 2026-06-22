# Blueprint 10 Gates — Lançamento — **KingsWorld**

> Status preenchido em 2026-05-30.
> Gates 1–7 marcados conforme a maturidade já estabelecida do app (Nível 8).
> Gates 8–10 refletem o que foi **verificado no código**. Itens de estado externo
> (Supabase dashboard, Google Cloud, Play Console) estão marcados `[~]` com
> "confirmar" — não dá pra checar daqui.
>
> Billing detalhado: ver `docs/PAYWALL_PLAYBOOK_V2.md`.

---

## 0. Variáveis do app

```
APP_NOME              = KingsWorld
PACKAGE_NAME          = com.kingsworld.app
SUPABASE_PROJECT_REF  = wdmrdovkkrgzalnpqdxe
SUPABASE_URL          = https://wdmrdovkkrgzalnpqdxe.supabase.co
VERCEL_URL            = https://king-s-world-indol.vercel.app   (⚠️ função ainda lista kingsworld.vercel.app — ajustar)
LOGIN_COM_GOOGLE?     = sim   (signInWithOAuth + signInWithPassword)
PRODUTOS:
  - productId = premium_monthly | basePlanId = monthly | tipo = subscription
SITE_MAE_URL          = https://arabeco.github.io  (GitHub Pages)
  Privacidade        = https://arabeco.github.io/privacidade-kingsworld.html
  Termos             = https://arabeco.github.io/termos-kingsworld.html
  Exclusão de conta  = https://arabeco.github.io/kingsworld/exclusao.html
```

### Legenda de status
`[ ]` pendente · `[~]` em andamento / confirmar · `[x]` feito · `[N/A]` não se aplica

### 🔁 Compartilhado vs Por-App
- **1×/compartilhado**: Service Account do Google Cloud + JSON, conta de desenvolvedor Play, merchant profile, site-mãe de políticas.
- **Por app**: Play Console app, produtos, secrets Supabase, deploy da função, SQL, keystore, OAuth de login.

---

## Gate 1 — Ideia & Escopo Travado
- [x] Manifesto / "superpoder" do app escrito
- [x] Fluxo lógico de telas e decisões desenhado
- [x] Stack confirmada (Next.js + Supabase + Vercel + Capacitor)
- [x] **Variáveis da seção 0 preenchidas**
- [x] **GATE:** escopo travado, IDs de produto decididos

## Gate 2 — Infraestrutura
- [x] Repo + git ligado ao GitHub (`arabeco/King-s-World`)
- [x] Design system / Tailwind configurado
- [x] Supabase ativo: tabelas, RLS, Auth ("King's World Game10")
- [x] Deploy Vercel respondendo (projeto `king-s-world` no GitHub do arabeco; 3 env vars Supabase setadas — URL + publishable + secret — e redeploy ok)
- [x] **GATE:** ambiente local + nuvem em harmonia, repo sincronizando

## Gate 3 — Design
- [x] Paleta + tipografia no código
- [x] Componentes base (cards, botões, glass, modais)
- [x] Navegação/menus padronizados (BottomNavigation, world-shell)
- [x] **GATE:** estética de produto premium consolidada

## Gate 4 — Fluxo
- [x] Roteamento completo entre telas (lobby, world, base, empire, intel…)
- [x] Onboarding + telas core navegáveis
- [x] **GATE:** caminho do usuário mapeado e percorrível

## Gate 5 — Engine & Regras
- [x] Tipos TS estruturados — `tsc --noEmit` **limpo** (verificado)
- [x] Regras core / algoritmos (combat, empire, kingdom-survival, sandbox…)
- [x] Smoke tests / simulações rodando (smoke-level5/6/7/8, season, super-sim 120d)
- [x] **GATE:** cérebro estável e à prova de falha lógica

## Gate 6 — Persistência
- [x] Estado global integrado
- [x] Persistência + hydration (imperial-state / world-runtime)
- [x] **GATE:** memória local indestrutível

## Gate 7 — Conexão
- [x] Login real funcionando (Google OAuth + e-mail/senha)
- [x] Sync estado local ↔ Supabase
- [x] RLS protegendo tabelas — `users`/`user_entitlements` com policy own-row + **TODAS as 27 tabelas do jogo com RLS on** (anon bloqueada; servidor usa `sb_secret_` que fura RLS) — `23_SQL_FECHAR_RLS_TABELAS.sql`. Views `v_*` com `security_invoker`.
- [x] Backup/perfil multi-dispositivo
- [x] **GATE:** app conectado, seguro, pronto pra usuários

## Gate 8 — Refino & Billing (código)
- [x] Sistema global de toasts (`components/ui-toast-host.tsx`)
- [ ] Performance Lighthouse 90+ — **não verificado**
- [ ] Build Capacitor aberto em **dispositivo físico** — pendente
- [x] `lib/premium-config.ts` como **fonte única** dos IDs (bate com seção 0)
- [x] Paywall chama **compra nativa** (`@capgo/native-purchases`, não libera no client)
- [x] Edge Function `verify-google-play-purchase` escrita (Google API v3 subscriptionsv2)
- [x] RPC `grant_kw_entitlement` idempotente (lock + `revoke` do client)
- [x] SQL `user_entitlements` + RPC escritos (arquivos 11 e 22)
- [x] **Zero** billing morto e **zero** secret de billing na Vercel
- [~] **GATE:** billing 100% em código ✅ — falta Lighthouse + teste em device

---
### 🚧 A PARTIR DAQUI É LANÇAMENTO — Play Console fica pro Gate 10 ↓
---

## Gate 9 — Conformidade & Nuvem (pré-loja, SEM Play Console)

**Site-mãe / Conformidade legal:** (GitHub Pages + links no app via `lib/legal-config.ts`)
- [x] Política de Privacidade publicada — `arabeco.github.io/privacidade-kingsworld.html`
- [x] Termos de Uso publicados — `arabeco.github.io/termos-kingsworld.html`
- [x] Exclusão de conta — página `arabeco.github.io/kingsworld/exclusao.html` + backend `/api/me/delete-request` + link no rodapé do **login**

**Google Cloud (🔁 1× pra todos — REUSANDO a SA do Glyph `glyph-489315`):**
- [x] Projeto Cloud — reusa `glyph-489315`
- [x] Google Play Android Developer API — já habilitada nesse projeto
- [x] Service Account + JSON — `glyph-play-billing@glyph-489315` (mesma pra todos os apps)
- [x] OAuth Client (login Google) criado — client id `433623991566-...`
- [~] **Callback no OAuth client** → Google Cloud → Credentials → (Web client) → Authorized redirect URIs → `https://wdmrdovkkrgzalnpqdxe.supabase.co/auth/v1/callback` — *confirmar que está lá*

**Supabase (por app):**
- [x] SQL rodado (tabelas + RPC) no SQL Editor — **confirmado**
- [x] Edge Function deployada (deployment #4) — **confirmado no dashboard**
- [x] Secret `GOOGLE_PLAY_PACKAGE_NAME` — **setado** (30/05)
- [x] Secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — **setado** (JSON da glyph, 30/05)
- [x] `ALLOWED_ORIGINS` — ajustado p/ `king-s-world.vercel.app` + `king-s-world-three.vercel.app` e **redeployado**
- [x] Provider Google habilitado no Supabase Auth — **confirmado** (toggle ON + client id + secret + callback)

**Build / Assinatura:**
- [x] Keystore gerada (`android/upload-keystore.jks`, alias `kingsworld`) — senha guardada fora do repo (gerenciador) — gitignored ✅ — **FAZER BACKUP**
- [x] AAB de release assinada gerada (`app/build/outputs/bundle/release/app-release.aab`, 5.5MB)
  - Rebuild futuro: `JAVA_HOME=<jbr> ./gradlew bundleRelease` (lembrar de subir `versionCode` a cada upload)

**Assets de loja (offline):**
- [ ] Ícone, feature graphic, screenshots, descrição

- [ ] **GATE:** tudo pronto em homologação; só falta a vitrine

## Gate 10 — Play Console & Produto Vivo (por último)
**Conta & vínculo (🔁 1× pra todos):**
- [x] Conta de desenvolvedor Play ativa (4 apps)
- [~] Payments / Merchant profile (fiscal + banco) — *confirmar*
- [x] API access → **SA da glyph vinculada com os 4 apps** — confirmado

**App:**
- [x] Criar app (nome + `com.kingsworld.app`)
- [ ] Store listing + Privacy Policy URL
- [ ] Data Safety + Content rating + Target audience + Ads
- [~] **Criar assinatura `premium_monthly` + base plan `monthly` + PREÇO** — EM ANDAMENTO (é o próximo passo)
- [ ] Subir AAB em Internal → Closed testing
- [ ] License testers adicionados

**Validação real (smoke ponta-a-ponta):**
- [ ] Comprar como license tester → premium liberado
- [ ] Conferir `user_entitlements` (linha `active`, idempotência)
- [ ] Reabrir app persiste · Restaurar funciona sem cobrar de novo

**Trava de produção & vida:**
- [ ] ⏳ 20 testers por 14 dias no Closed testing
- [ ] Promover pra Produção
- [ ] ASO (keywords + screenshots)
- [ ] Métricas + tráfego
- [ ] **GATE:** receita ativa, produto vivo

---

## Onde o KingsWorld está agora (atualizado 30/05)
```
Gates 1–7  : ✅ feitos (Nível 8)
Gate 8     : ✅ billing pronto em código — falta Lighthouse + teste em device físico
Gate 9     : 🟢 QUASE LÁ — Supabase (SQL/função/2 secrets/provider Google) ✅,
             Google Cloud reusando glyph ✅. FALTA: site de políticas, keystore, assets,
             ajustar ALLOWED_ORIGINS, confirmar callback no OAuth client do Cloud
Gate 10    : 🟡 iniciado — conta + 4 apps + SA vinculada ✅. FALTA: produtos (preço),
             store listing, data safety, AAB, testing
```

## Pendências imediatas (ordem sugerida)
1. **Play Console:** criar assinatura `premium_monthly` + base plan `monthly` + preço.
2. Confirmar callback `.../auth/v1/callback` nos Authorized redirect URIs do OAuth client (Google Cloud).
3. Ajustar `ALLOWED_ORIGINS` da função pro domínio real (`king-s-world-indol.vercel.app`).
4. Site-mãe: Privacidade + Termos + página pública de Exclusão de conta.
5. Keystore (Play App Signing) + AAB de release.
6. Assets de loja (ícone, feature graphic, screenshots) + store listing + Data Safety.
7. Subir AAB → Closed testing → 20 testers / 14 dias.
