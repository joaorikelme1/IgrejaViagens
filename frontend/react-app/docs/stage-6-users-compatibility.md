# Etapa 6 — usuários, associações e compatibilidade

## Operações granulares

- `POST /users` cria o cadastro global.
- `PUT /users/{cpf}` edita um cadastro existente e preserva os campos devolvidos
  pelo servidor que não pertencem ao formulário.
- `DELETE /users/{cpf}` é usado somente ao final da exclusão global.

O backend atual devolve `password` em `GET /users` e nas respostas de escrita.
O adaptador converte cada resposta para uma lista explícita de campos seguros,
descartando a senha antes que o dado chegue ao estado React. No `PUT`, uma
leitura transitória dentro da função de API é usada porque o endpoint substitui
a entidade inteira e zeraria campos omitidos. Essa resposta bruta não é
armazenada, exibida ou registrada em log.

Novos usuários ainda precisam receber a credencial inicial exigida pelo login
legado. Ela existe somente no corpo construído pela função de API; não há campo
de senha no formulário, estado, UI ou storage. Esse contrato deve ser removido
na modernização de autenticação das Etapas 9/10.

## Operações bulk de compatibilidade

O backend não possui endpoints granulares para alterar `travelersJson` nem para
remover todas as relações de uma pessoa. Por isso, a camada
`travelerCompatibilityApi.ts` concentra temporariamente:

| Operação | Escritas bulk necessárias |
| --- | --- |
| Adicionar à viagem | `/trips/bulk` e, se necessário, `/payments/bulk` |
| Remover da viagem | `/trips/bulk`, `/payments/bulk`, `/seats/bulk`, `/rooms/bulk` |
| Excluir globalmente | os quatro bulk anteriores, depois `DELETE /users/{cpf}` |

As coleções são lidas e os objetos desconhecidos são preservados por cópia. Na
remoção de quarto, o quarto continua existindo e somente o CPF é retirado de
`occupants`.

Essas operações não são transacionais. Uma falha intermediária pode deixar uma
associação parcialmente atualizada; a interface mostra o erro e nunca anuncia
sucesso nessa situação, mas a correção definitiva exige comandos atômicos no
backend nas Etapas 9/10.

## Regras preservadas e limites

- A entrada na viagem cria, quando ausente, pagamento inicial de uma parcela,
  vencimento no dia 10, nenhuma parcela paga e nenhum comprovante.
- `maxPeople` é validado antes das escritas de associação e também bloqueia as
  ações na página.
- Remover da viagem mantém o cadastro global. Excluir globalmente exige outra
  confirmação e limpa todas as associações conhecidas.
- `spouseName` é tratado como texto informativo. Não há alegação de vínculo real
  entre usuários porque esse relacionamento não existe no modelo atual.
- Comprovantes são convertidos apenas em metadados seguros; o conteúdo base64
  eventualmente presente no contrato não entra no estado da página.

## Segurança pendente

A proteção por papel e CPF continua visual. Os endpoints aceitam chamadas sem
autenticação e retornam coleções completas, inclusive credenciais no caso de
`GET /users`. A aplicação React reduz exposição acidental na UI, mas não é uma
fronteira de autorização. Nenhuma dessas APIs deve ser publicada como segura
antes das Etapas 9/10.
