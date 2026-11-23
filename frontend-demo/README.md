# Igreja Viagens — demonstração

Versão independente, apenas de frontend, preparada para a apresentação. Ela
preserva as telas e os fluxos do sistema, sem API, Supabase ou banco de dados.
Os dados de demonstração ficam no `localStorage` de cada navegador: assim, os
testes de uma pessoa não alteram a apresentação de outra.

## Acesso inicial

- Administradora: CPF `529.982.247-25` · senha `demo12345`
- Viajante: CPF `111.444.777-35` · senha `demo12345`

Já há uma viagem para Petrópolis, participantes, pagamentos, hotel, quartos e
assentos preenchidos. Alterações feitas durante a demonstração permanecem
somente naquele navegador. Para voltar aos dados iniciais, limpe os dados do
site no navegador.

## Executar e publicar

```bash
npm ci
npm run build
npm run preview
```

Para o deploy separado na Vercel, use **`frontend-demo`** como *Root Directory*,
`npm run build` como comando de build e `dist` como diretório de saída. Não há
variáveis de ambiente para cadastrar.
