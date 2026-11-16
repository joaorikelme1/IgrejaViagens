# Igreja Viagens

Aplicação React/Vite hospedada na Vercel e integrada diretamente ao Supabase. Não há URL de API, Render, cookie de sessão do Spring ou chave administrativa no bundle.

## Desenvolvimento

1. Para desenvolvimento local, execute `npx supabase start`, copie `frontend/.env.example` para `frontend/.env.local` e use a URL/chave exibidas pela CLI.
2. Valide antes de publicar com `npx supabase db lint`, `npx supabase test db` e, em `frontend/`, `npm run typecheck && npm run lint && npm run build`.
3. Para o ambiente hospedado, crie um projeto Supabase vazio, autentique a CLI e vincule a pasta: `npx supabase login` e `npx supabase link --project-ref SEU_PROJECT_REF`.
4. Defina `BOOTSTRAP_ADMIN_SECRET` nos secrets do projeto e só então publique a infraestrutura com `npx supabase db push` e `npx supabase functions deploy provision-user`.
5. Informe a URL e a chave anônima/publicável hospedadas em `frontend/.env.local` e execute `npm install` e `npm run dev` em `frontend/`.

Confira [supabase/README.md](supabase/README.md) para o bootstrap seguro do primeiro administrador e os secrets obrigatórios. Na Vercel, use `frontend` como Root Directory e cadastre somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
