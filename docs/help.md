# Ajuda

Esse arquivo demonstra os comandos e suas respectivas categorias

> [!IMPORTANT]
> A versão em inglês existe, clique [aqui](/translations/en-US/help.md)

> [!NOTE]
> `<>` - obrigatório
> `[]` - opcional
> `{}` - apenas obrigatório caso outro argumento seja opcional
>  `>` - sub-comando

#### Economia

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

#### Servidor

- `/serverinfo` - mostra as informações do servidor
- `/settings >(xp-notification|boost-config|currency-edit|currency-create) {args}` - configura o servidor
    - `>xp-notification {channel} {message}` - configura o sistema de notificação de level up
       - `channel` - (canal) - canal a qual a notificação será enviada
       - `message` - (texto) - mensagem que deve ser enviada ao avisar. Os seguintes placeholders existem:
           - `{user.mention / user}` - menciona o usuário
           - `{user.id}` - id do usuário
           - `{guild.name}` - nome do servidor
           - `{level.next}` -> próximo nível
           - `{level.current}` -> nível atual
           - `{level.current.xp}` -> xp do nível atual
           - `{level.next.xp}` -> xp to próximo nivel
           - `{xp.total / xp.current}` -> total de xp
       - exemplos:
            1. Para configurar a mensagem que você quer e o canal que gostaria de enviar: `/settings xp-notification #canal Parabéns por subir de nível, {user}!`
            2. Também há a possibilidade de trocar APENAS o canal ou a mensagem
   - `>boost-config <ativar?> [max_bonus]` - configura o bônus caso haja boost (ele também se baseia no nível do boost do servidor)
       - `ativar?` - (sim|não) - decide se vai ativar ou não
       - `max_bonux` - (número) - qual o bônus máximo que vai ser aplicado (caso nulo, será o máximo que o plano permite)
   - `>currency-create <nome> <símbolo> [imagem_url]` - cria a moeda do servidor
       - `nome` - (texto) - nome da moeda
       - `símbolo` - (texto) - o símbolo (por exemplo: $, $$, R$, €)
       - `imagem_url` - (texto) - é o ícone da moeda. Será criado um emoji no servidor com esse ícone, caso não tenha espaço, o comando funcionará normalmente. Caso esse argumento seja nulo, será usado o ícone do servidor
