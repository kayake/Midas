# Ajuda

Esse arquivo demonstra os comandos e suas respectivas categorias

> [!IMPORTANT]
> A versão em inglês existe, clique [aqui](/translations/en-US/help.md)

> [!NOTE]
> `<>` - obrigatório
> `[]` - opcional
> `{}` - apenas obrigatório caso outro argumento seja opcional
>  `>` - sub-comando

#### Economy

- `/currency-info <coin>` -> mostra as informações da moeda escolhida
   - `coin` - (texto) - nome da moeda do servidor
   - exemplos:
       1. `/currency-info servidor_legal` - verifica as informações

- `/daily` -> coleta sua recompensa diária (atualizada a cada meia noite e baseado no XP ganho no dia)

- `/exchange {coin1} [coin2]` -> mostra a taxa de câmbio entre duas moedas
     - `coin1` - (texto) - nome da primeira moeda
     - `coin2` - (texto) - nome da segunda moeda
     - exemplos:
         1. Compare uma moeda à moeda principal: `/exchange servidor_legal`
         2. Comparação entre moedas: `/exchange servidor_legal_1 servidor_legal_2`

- `/leaderboard >(local|global) {coin_type}` - mostra o placar da quantidade de moedas local ou global
     - `>local` - mostra o rank de moeda local
         - `type` - (escolha) - é o tipo de moeda `Server Coin` ou `Global Coin`
     - `>global` - mostra o rank de moeda global
     -  exemplos:
          1. Mostra o rank global: `/leaderboard global`
          2. Mostra o rank local de moeda global: `/leaderboard local Global Coin`
          3. Mostra o rank local de moeda local: `/leaderboard local Server Coin`

- `shop >(view|buy) {id}` - compre ou veja os itens da loja
     - `>view` - mostra os itens da loja
     - `>buy` - compra o tem da loja
       - `id` - (número) - id do item
     - exemplos
          1. Veja os itens da loja: `/shop view`
          2. Compre um item da loja: `/shop 123`
