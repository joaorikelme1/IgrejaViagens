# Igreja Viagens — Frontend

React 19, TypeScript e Vite com Supabase Auth, Postgres, Storage e Edge Functions. A interface continua usando CPF e senha: internamente, o CPF é normalizado e associado a um e-mail técnico que nunca é apresentado ao usuário.

## Configuração

Copie `.env.example` para `.env.local` e informe:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica
```

Não use `service_role`, segredos de bootstrap ou credenciais administrativas no frontend.

## Comandos

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Na Vercel, use este diretório como Root Directory, `npm run build` como Build Command e `dist` como Output Directory. Cadastre as duas variáveis acima em Production e Preview. O `vercel.json` mantém o fallback das rotas SPA.
