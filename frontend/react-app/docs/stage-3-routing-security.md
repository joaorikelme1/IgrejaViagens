# Etapa 3: fronteira de navegação e segurança

## Proteções implementadas no cliente

- Rotas administrativas só são renderizadas quando a sessão temporária informa
  o papel `admin`.
- Rotas do viajante só são renderizadas quando a sessão temporária informa o
  papel `traveler`.
- Ausência de sessão redireciona para `/`.
- Acesso a uma área de outro papel redireciona para a página inicial do papel
  da sessão.
- A sidebar exibe somente os itens permitidos para o papel atual.

## Limite de segurança

Essas verificações são exclusivamente visuais e de navegação. O estado em
`sessionStorage` pode ser alterado no navegador e, portanto, não comprova
identidade nem autorização.

Até a modernização integrada de backend e segurança prevista nas Etapas 9 e 10:

- nenhuma decisão de segurança deve depender do papel guardado no cliente;
- os endpoints atuais continuam sem autorização real;
- a aplicação React não deve ser considerada pronta para publicação em ambiente
  exposto;
- a proteção efetiva deverá ser aplicada no Spring Boot, validando identidade e
  papel em todas as operações protegidas.

## Contexto de viagem

Somente o identificador da viagem ativa é persistido na chave
`igreja-viagens:active-trip-id`. Objetos de viagem, listas de viajantes, CPF e
outros dados do contrato de viagens não são persistidos por esse contexto.

O filtro temporário de viagens do viajante interpreta `travelersJson` retornado
por `GET /trips`. Esse contrato é legado e deverá ser substituído por um
contrato tipado do backend durante a modernização da API.
