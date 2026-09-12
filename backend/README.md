# Igreja Viagens

Aplicacao Spring Boot com PostgreSQL.

## Executar com Docker

Crie o arquivo de configuracao local antes da primeira execucao:

```bash
cp .env.example .env
```

Troque obrigatoriamente `DB_PASSWORD` e `ADMIN_PASSWORD` no `.env`. A senha do
administrador nao possui valor padrao no codigo e e usada apenas quando o CPF
configurado ainda nao existe no banco.

Suba a aplicacao e o banco de dados:

```bash
docker compose up --build
```

O frontend React ficara disponivel em <http://localhost> e encaminhara as APIs
para o backend na mesma origem. A API tambem fica exposta em
<http://localhost:8080> para diagnostico local. Os dados do PostgreSQL sao
mantidos no volume Docker `postgres_data`, inclusive quando os containers sao
parados ou recriados.

Para parar os containers:

```bash
docker compose down
```

Para apagar tambem os dados persistidos do banco:

```bash
docker compose down -v
```

As portas e credenciais podem ser alteradas em um arquivo `.env`:

```dotenv
APP_PORT=8080
FRONTEND_PORT=80
DB_PORT=5432
DB_NAME=igreja_viagens
DB_USERNAME=igreja
DB_PASSWORD=uma-senha-forte
BOOTSTRAP_ADMIN_ENABLED=true
ADMIN_CPF=10127544135
ADMIN_NAME=Administrador
ADMIN_PASSWORD=outra-senha-forte
```

## Seguranca e contratos

A API usa sessao HTTP, troca o ID da sessao no login e aplica autorizacao por
papel e por propriedade do recurso. Respostas de usuario nunca incluem a senha.
Operacoes de escrita exigem token CSRF; o React obtem esse token em
`GET /auth/csrf` e envia o cabecalho informado pela propria API.

As operacoes de inclusao/remocao de viajante e as exclusoes globais de usuario e
viagem sao transacionais. O backend limpa pagamentos, assentos, quartos e demais
recursos dependentes sem depender de varias escritas do navegador.

Pagamentos, quartos e assentos possuem contratos granulares de atualizacao. O
banco aplica unicidade por pagamento/viajante/viagem e por posicao de assento,
evitando sobrescritas globais e reservas duplicadas. O Flyway executa as
migracoes versionadas antes de o Hibernate validar o schema.

Os vinculos familiares usam CPF (`spouseCpf` e `childCpfs`) sem remover os
campos legados de nomes. O vinculo de conjuges e bidirecional e nomes antigos
so sao reconciliados quando identificam um unico cadastro. As distribuicoes
automaticas usam `PUT /rooms/trip/{tripId}/bulk` e
`PUT /seats/trip/{tripId}/bulk`, ambos administrativos e transacionais por
viagem; dados de outras viagens nao sao substituidos.

Em producao HTTPS, configure `SESSION_COOKIE_SECURE=true` e restrinja
`CORS_ALLOWED_ORIGINS` a origem exata do frontend. O arquivo `.env` esta ignorado
pelo Git; somente `.env.example` deve ser versionado.

Quando frontend e backend estiverem em sites diferentes, como Vercel e Render,
configure tambem `SESSION_COOKIE_SAME_SITE=none`. O cookie continuara protegido
por HTTPS, mas podera acompanhar as requisicoes autenticadas feitas pelo React.

O primeiro deploy pode usar um banco vazio. Em um banco criado por uma versao
anterior, a migracao faz baseline e preserva as tabelas existentes; caso existam
pagamentos ou assentos duplicados, ela interrompe a inicializacao para que os
dados sejam corrigidos sem descarte automatico.

## Validacao

```bash
./gradlew clean test
```

Se o projeto estiver dentro de uma pasta sincronizada e o OneDrive bloquear o
diretorio `build`, use um caminho local nao sincronizado:

```bash
./gradlew -PigrejaBuildDir=C:/temp/igreja-build clean test
```

## Deploy no Render

O `render.yaml` da raiz configura o backend como um Web Service Docker e usa
`GET /health` para verificar a saude da aplicacao. Antes do primeiro deploy:

1. Crie um PostgreSQL no Render, na mesma regiao do backend.
2. No Blueprint/Web Service, preencha as variaveis marcadas como secretas.
3. Use os dados da conexao interna do PostgreSQL. `DB_URL` precisa estar no
   formato JDBC, por exemplo `jdbc:postgresql://host-interno/banco`.
4. Em `CORS_ALLOWED_ORIGINS`, informe a URL exata do frontend na Vercel, sem
   barra final, por exemplo `https://igreja-viagens.vercel.app`.

Variaveis esperadas no Render:

```dotenv
DB_URL=jdbc:postgresql://host-interno/nome-do-banco
DB_USERNAME=usuario-do-render
DB_PASSWORD=senha-do-render
CORS_ALLOWED_ORIGINS=https://seu-projeto.vercel.app
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=none
BOOTSTRAP_ADMIN_ENABLED=true
ADMIN_CPF=seu-cpf-com-11-digitos
ADMIN_NAME=Administrador
ADMIN_PASSWORD=uma-senha-inicial-forte
```

Depois que o administrador inicial existir, `BOOTSTRAP_ADMIN_ENABLED` pode ser
alterado para `false`. Nunca coloque as credenciais reais no repositorio.
