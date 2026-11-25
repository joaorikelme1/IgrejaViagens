# Igreja Viagens

Sistema de gestão de viagens para igrejas, com áreas separadas para administradores e viajantes. A aplicação gerencia viagens, usuários, famílias, parcelamentos, comprovantes privados, ônibus, assentos, hotéis, quartos e um assistente administrativo com confirmação humana.

## Arquitetura atual

- `frontend/`: aplicação principal React 19 + TypeScript + Vite, publicada separadamente na Vercel.
- `supabase/`: PostgreSQL, Auth, Row Level Security (RLS), Storage privado, RPCs transacionais, Edge Functions e testes pgTAP.
- `frontend-demo/`: demonstração independente que usa somente dados locais do navegador e nunca acessa o Supabase de produção.
- `backend/`: implementação Spring Boot anterior. Nenhum frontend atual importa ou chama suas APIs; ela é mantida apenas como referência de migração e não deve ser publicada junto da arquitetura Supabase.

O navegador usa apenas a URL e a chave pública do Supabase. Operações privilegiadas são protegidas por RLS, RPCs com validação de papel ou Edge Functions. `service_role`, segredo de bootstrap e chave Groq nunca pertencem ao bundle do frontend.

## Funcionalidades

- autenticação por CPF e senha, com validação dos dígitos do CPF;
- primeiro acesso obrigatório com troca de senha no servidor;
- papéis `admin` e `traveler`, rotas protegidas e políticas RLS;
- cadastro global, vínculos familiares e associação a viagens;
- planos de pagamento, comprovantes privados, revisão atômica e auditoria financeira;
- ônibus de um ou dois pisos, assentos únicos e distribuição familiar;
- hotéis, quartos, capacidade e distribuição familiar;
- assistente Groq limitado a interpretação estruturada, com cálculos determinísticos e confirmação antes de escritas;
- versão demonstrativa local e isolada.

## Requisitos

- Node.js 22 e npm;
- Docker Desktop (para o Supabase local);
- Supabase CLI, executável via `npx supabase`;
- Java 17 apenas para validar o back-end legado.

## Instalação local

```bash
npx supabase start
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Use na `.env.local` os valores públicos exibidos por `supabase start`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=chave_publica_local
```

Nunca use `SUPABASE_SERVICE_ROLE_KEY`, `BOOTSTRAP_ADMIN_SECRET` ou `GROQ_API_KEY` em variáveis `VITE_*`.

## Supabase e Edge Functions

Crie um projeto vazio, vincule a CLI e aplique as migrations somente depois de revisar o diff:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Defina secrets longos e exclusivos no Supabase:

```bash
npx supabase secrets set BOOTSTRAP_ADMIN_SECRET=valor-seguro
npx supabase secrets set GROQ_API_KEY=valor-seguro
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-20b
```

`GROQ_MODEL` é opcional. Publique as funções:

```bash
npx supabase functions deploy provision-user
npx supabase functions deploy complete-first-access
npx supabase functions deploy assistant-chat
```

A Groq recebe somente o texto do comando e a contagem do contexto anterior. Registros pessoais e financeiros permanecem no Supabase; filtros e valores são calculados por código. O assistente possui limite de requisições e não executa alterações sem confirmação do administrador.

## Publicação na Vercel

Configure `frontend` como Root Directory, `npm run build` como Build Command e `dist` como Output Directory. Cadastre apenas:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=chave_anonima_ou_publicavel
```

Não publique migrations, Edge Functions ou alterações de retenção automaticamente a partir de previews. Faça backup, teste localmente e aplique o banco em uma janela controlada.

## Demonstração

A demonstração está em `frontend-demo/`. Credenciais e instruções constam em [`frontend-demo/README.md`](frontend-demo/README.md). Ela não possui dependências do Supabase e persiste alterações apenas no navegador.

Nenhuma URL pública da demonstração está registrada no repositório. Para publicar, use `frontend-demo` como projeto Vercel separado e não configure variáveis de produção.

## Testes e validação

Aplicação principal e demonstração:

```bash
cd frontend # ou frontend-demo
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Banco local isolado:

```bash
npx supabase start
npx supabase db lint
npx supabase test db
```

Legado Java:

```bash
cd backend
./gradlew test
```

O workflow em `.github/workflows/ci.yml` executa essas validações em pull requests.

## Retenção e limitações conhecidas

- A migration existente remove viagens e comprovantes após três meses da partida. Essa política não foi alterada. Ela implica perda irreversível de histórico financeiro e deve ser substituída, mediante autorização, por arquivamento com prazo fiscal/organizacional definido.
- O modelo financeiro registra parcelas confirmadas, não datas individuais de vencimento. Portanto, não é possível classificar atraso real sem definir uma regra de calendário e migrar o schema.
- A recuperação de acesso usa redefinição administrativa para uma senha temporária; e-mail automático não é aplicável porque o login por CPF utiliza endereços técnicos internos.
- O back-end Java aceita hashes legados e até senhas antigas em texto puro para compatibilidade. Como não integra a aplicação atual, deve permanecer desativado e ser arquivado após aprovação, não publicado.
- O primeiro deploy da migration de hardening interrompe se já houver CPF inválido. Corrija os registros conscientemente; a migration não os altera automaticamente.

Consulte [`supabase/README.md`](supabase/README.md) para detalhes operacionais do banco e das funções.
