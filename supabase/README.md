# Supabase — Igreja Viagens

Execute `supabase db push` em um projeto novo e vazio. Em **Auth > Providers > Email**, desative a confirmação de e-mail: o sistema usa um e-mail interno derivado do CPF, nunca exibido na interface.

Defina os secrets da Edge Function: `BOOTSTRAP_ADMIN_SECRET`. O runtime já fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; nunca copie essas chaves para o frontend, Vercel ou repositório. Em **Auth > Providers > Email**, mantenha a confirmação de e-mail desativada, pois o login usa uma identidade interna associada ao CPF.

Faça deploy com `supabase functions deploy provision-user`. A função não exige JWT no gateway exclusivamente para permitir o bootstrap; ela própria recusa qualquer chamada sem administrador autenticado ou sem o segredo de bootstrap quando ainda não há perfis. Os buckets privados, limites MIME, RLS, RPCs e tabelas são criados pela migration.
