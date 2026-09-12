# Igreja Viagens — React

Interface oficial do Igreja Viagens, desenvolvida com React, TypeScript e Vite.
O frontend legado foi removido após a conclusão da migração.

## Escopo atual

As Etapas 1 a 8 estão implementadas. Além do login, a aplicação possui React
Router, layout compartilhado, sidebar responsiva, topbar, rotas protegidas por
sessão/papel, seleção e gestão de viagens, dashboards, Configurações, Viajantes,
Cadastro Global, Pagamentos, Hotel e Transporte. Os endpoints consumidos são:

- `POST /auth/login`
- `GET /auth/csrf` (token exigido automaticamente nas escritas)
- `PUT /users/{cpf}` (somente para concluir o primeiro acesso)
- `GET /trips`
- `GET /users`, `GET /payments` e `GET /seats` (Dashboard Admin)
- `GET /payments`, `GET /seats` e `GET /rooms` (Dashboard Viajante)
- `POST /users`, `PUT /users/{cpf}` e `DELETE /users/{cpf}` (Cadastro Global)
- `PUT /trips/{id}/travelers/{cpf}`, `POST /trips/{id}/travelers` e
  `DELETE /trips/{id}/travelers/{cpf}` (associacoes transacionais)
- `GET /users`, `GET /payments`, `GET /seats` e `GET /rooms` (Viajantes)
- `GET /payments` e `GET /users` (Pagamentos)
- `GET /rooms`, `GET /seats` e `GET /users` (Hotel e Transporte)
- `POST /trips` e `PUT /trips/{id}` (viagens, hotéis e ônibus)
- `PUT /payments/{id}` (plano financeiro e comprovantes)
- `PUT /rooms/{id}` e `DELETE /rooms/{id}` (quartos e ocupações)
- `PUT /seats/{id}` e `DELETE /seats/{id}` (atribuição e liberação de assentos)

A proteção de rotas no React melhora a experiência, enquanto o backend aplica
as regras efetivas de papel e propriedade de cada recurso. A evolução está
documentada em [`docs/stage-3-routing-security.md`](docs/stage-3-routing-security.md)
e o histórico das APIs bulk em
[`docs/stage-4-backend-pending.md`](docs/stage-4-backend-pending.md). Os limites
dos contratos e o tratamento defensivo do Dashboard Viajante estão em
[`docs/stage-5-traveler-data-integrity.md`](docs/stage-5-traveler-data-integrity.md).
As operações de usuários e os bulk temporários da Etapa 6 estão descritos em
[`docs/stage-6-users-compatibility.md`](docs/stage-6-users-compatibility.md).
Os cálculos e limites dos pagamentos estão em
[`docs/stage-7-payments-compatibility.md`](docs/stage-7-payments-compatibility.md).
Os contratos duplicados de hotel/transporte e seus riscos estão em
[`docs/stage-8-operations-compatibility.md`](docs/stage-8-operations-compatibility.md).

## Ecossistema familiar

No cadastro, o administrador pode vincular conjuge e filhos a usuarios
existentes por CPF. Hotel e Transporte oferecem distribuicao automatica que
preserva escolhas manuais e prioriza familiares no mesmo quarto ou proximos no
mesmo piso do onibus. A gravacao usa `PUT /rooms/trip/{tripId}/bulk` e
`PUT /seats/trip/{tripId}/bulk`, de forma atomica e limitada a viagem ativa.

## Rotas

| Rota | Papel | Estado |
| --- | --- | --- |
| `/` | Público | Login migrado |
| `/admin` | Admin | Dashboard migrado |
| `/admin/viajantes` | Admin | Viajantes da viagem migrados |
| `/admin/pagamentos` | Admin | Gestão financeira migrada |
| `/admin/transporte` | Admin | Ônibus e assentos migrados |
| `/admin/hotel` | Admin | Hotéis e quartos migrados |
| `/admin/cadastros` | Admin | Cadastro Global migrado |
| `/admin/configuracoes` | Admin | Configurações da viagem migradas |
| `/viajante` | Viajante | Dashboard e passagem digital migrados |
| `/viajante/pagamento` | Viajante | Parcelamento e comprovantes migrados |
| `*` | Público | Página 404 |

## Requisitos

- Node.js 20.19 ou superior
- npm 11 ou superior

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run lint
```

Copie `.env.example` para `.env.local` somente se precisar alterar o endereço
do backend. Durante o desenvolvimento, o Vite encaminha os caminhos atuais da
API para `http://localhost:8080`. Ao cadastrar um usuário, o administrador define
uma senha inicial de pelo menos oito caracteres; não existe senha padrão no
bundle React.

## Docker e deploy

O `Dockerfile` gera os arquivos estáticos e os serve com Nginx. A configuração
incluída mantém as rotas do React funcionando ao recarregar a página e encaminha
as APIs para o serviço `app:8080`, deixando sessão e CSRF na mesma origem.

Para subir React, Spring e PostgreSQL juntos, execute no diretório
`backend`:

```bash
docker compose --env-file .env up --build
```

## Deploy na Vercel com backend no Render

Configure o projeto da Vercel com `frontend` como **Root Directory**. O preset
de framework deve ser Vite, o comando de build `npm run build` e o diretório de
saída `dist`. Cadastre a seguinte variável nos ambientes de Production e, se
necessário, Preview:

```dotenv
VITE_API_BASE_URL=https://seu-backend.onrender.com
```

Não use barra no final da URL. O arquivo `vercel.json` mantém as rotas do React
funcionando quando uma página como `/admin/pagamentos` é aberta ou recarregada
diretamente. No Render, `CORS_ALLOWED_ORIGINS` deve conter a URL exata gerada
pela Vercel, e os cookies devem usar `SESSION_COOKIE_SECURE=true` e
`SESSION_COOKIE_SAME_SITE=none`.
