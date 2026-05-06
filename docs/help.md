# Ajuda

Esse arquivo demonstra os comandos e suas respectivas categorias.

> [!IMPORTANT]
> English version: [translations/en-US/help.md](/docs/translations/en-US/help.md)

> [!NOTE]
> `<>` - obrigatório;
> `[]` - opcional;
> `{}` - apenas obrigatório caso outro argumento seja opcional;
> `>` - sub-comando;

---

#### Economia

- `/currency-info [coin]` — exibe informações detalhadas sobre uma moeda e seu gráfico de inflação
  - `coin` - (texto) - nome da moeda do servidor a consultar. Se omitido, exibe informações da moeda **Global**
  - O embed inclui: nome, símbolo, servidor de origem, data de criação, taxa de inflação atual, variação percentual, supply total e câmbio em relação à BankCoin
  - exemplos:
    1. Ver a moeda Global: `/currency-info`
    2. Ver uma moeda de servidor: `/currency-info MoedaLegal`

---

- `/daily` — coleta sua recompensa diária em BankCoins
  - A recompensa varia entre **600** e **2100 BankCoins** dependendo da sua atividade no dia (mensagens enviadas)
  - Usuários com planos pagos recebem um multiplicador sobre o bônus de atividade
  - Só pode ser resgatado uma vez por dia; o contador reinicia à meia-noite
  - Após resgatar, exibe sua posição no ranking global

---

- `/exchange [coin1] [coin2]` — mostra a taxa de câmbio entre duas moedas
  - Pelo menos um dos argumentos deve ser fornecido
  - `coin1` - (texto) - nome da moeda de origem. Se omitido, usa a moeda **Global** como origem
  - `coin2` - (texto) - nome da moeda de destino. Se omitido, usa a moeda **Global** como destino
  - A taxa é calculada automaticamente com base nos parâmetros econômicos de cada servidor
  - exemplos:
    1. Comparar uma moeda de servidor com a BankCoin global: `/exchange MoedaLegal`
    2. Comparar duas moedas de servidores diferentes: `/exchange MoedaLegal_1 MoedaLegal_2`

---

- `/leaderboard >(global|local) {type} [page]` — exibe o ranking de moedas do servidor ou global
  - `>global` — ranking global de **BankCoins** entre todos os usuários do bot
    - `page` - (número) - página inicial do ranking (padrão: 1)
  - `>local` — ranking de moedas dentro do servidor atual
    - `type` - (obrigatório) - tipo de moeda a rankear:
      - `Server Coin` — exibe o ranking da moeda local do servidor
      - `Global Coin (BankCoin)` — exibe o ranking de BankCoins dos membros do servidor
    - `page` - (número) - página inicial do ranking (padrão: 1)
  - O ranking é paginado (10 por página) com botões de navegação
  - exemplos:
    1. Ranking global: `/leaderboard global`
    2. Ranking local de BankCoins: `/leaderboard local Global Coin`
    3. Ranking local da moeda do servidor: `/leaderboard local Server Coin`
    4. Abrir em uma página específica: `/leaderboard global 3`

---

- `/shop >(view|buy) {item_id}` — veja ou compre itens da loja diária
  - `>view` — exibe os itens disponíveis hoje, com nome, descrição, raridade e preço em BankCoins
  - `>buy <item_id>` — compra um item pelo seu ID
    - `item_id` - (número, obrigatório) - ID do item a comprar, visível no `/shop view`
  - A loja é rotativa e os itens mudam diariamente
  - exemplos:
    1. Ver os itens disponíveis: `/shop view`
    2. Comprar um item: `/shop buy 42`

---

#### Servidor

- `/serverinfo` — exibe informações gerais do servidor atual
  - Mostra: ID, dono, plano ativo (baseado no plano do dono), nível de boost, número de membros, moeda do servidor, taxa de inflação e câmbio com a BankCoin global

---

- `/settings >(xp-notification|boost-config|currency-create|currency-edit|mission-notification-channel) {args}` — configura o servidor
  - Requer a permissão **Gerenciar Servidor**

  - `>xp-notification [channel] [message]` — configura o sistema de notificação de level up
    - `channel` - (canal de texto) - canal onde as notificações serão enviadas. Omitir mantém o atual
    - `message` - (texto) - mensagem enviada ao subir de nível. Omitir mantém a atual
    - Placeholders disponíveis na mensagem:
      - `{user.mention}` ou `{user}` — menciona o usuário
      - `{user.id}` — ID do usuário
      - `{guild.name}` — nome do servidor
      - `{level.current}` — nível atual
      - `{level.next}` — próximo nível
      - `{level.current.xp}` — XP necessário para o nível atual
      - `{level.next.xp}` — XP necessário para o próximo nível
      - `{xp.total}` ou `{xp.current}` — total de XP acumulado
    - exemplos:
      1. Configurar canal e mensagem: `/settings xp-notification #geral Parabéns {user}, você chegou ao nível {level.current}!`
      2. Trocar só o canal: `/settings xp-notification #outro-canal`
      3. Trocar só a mensagem: `/settings xp-notification message:Uau, {user} subiu de nível!`

  - `>boost-config <enabled> [max_bonus]` — configura o bônus de XP para boosters do servidor
    - `enabled` - (sim/não, obrigatório) - ativa ou desativa o bônus para quem faz boost
    - `max_bonus` - (número) - multiplicador máximo a ser aplicado. Se omitido, usa o máximo permitido pelo plano do servidor
    - O bônus também leva em conta o nível de boost do servidor automaticamente
    - Requer plano pago para uso

  - `>currency-create <name> <symbol> <image_url>` — cria a moeda personalizada do servidor
    - `name` - (texto, obrigatório) - nome da moeda (ex: `Dólar`)
    - `symbol` - (texto, obrigatório) - símbolo da moeda (ex: `$`, `R$`, `€`)
    - `image_url` - (texto, obrigatório) - URL da imagem da moeda. Um emoji será criado no servidor com esse ícone; caso não haja espaço disponível para emojis, o comando funcionará normalmente sem ele
    - Requer plano **Barclays ou superior**
    - exemplos:
      1. `/settings currency-create Dólar $ https://exemplo.com/icone.png`

  - `>currency-edit [emoji]` — edita a moeda existente do servidor
    - `emoji` - (texto) - tenta recriar o emoji da moeda no servidor
    - Requer plano **Barclays ou superior**

  - `>mission-notification-channel [channel]` — define o canal de notificações de missões
    - `channel` - (canal de texto) - canal onde as notificações de missão serão enviadas. Se omitido, remove a configuração atual

---

- `/xp-config <base> <exponent> <multiplier>` — configura o algoritmo de XP do servidor
  - Requer a permissão **Gerenciar Servidor** e plano **Deutsche ou superior**
  - `base` - (número, obrigatório) - XP base por nível (padrão recomendado: `100`)
  - `exponent` - (número, obrigatório) - expoente da curva de progressão (padrão recomendado: `1.5`)
  - `multiplier` - (número, obrigatório) - multiplicador geral de XP (padrão recomendado: `1`)
  - Antes de confirmar, exibe um gráfico de projeção e uma simulação dos primeiros 10 níveis para revisão
  - exemplos:
    1. Curva suave: `/xp-config 100 1.5 1`
    2. Curva mais agressiva: `/xp-config 150 2 1`

---

#### Missões

- `/missions >(view|claim) {id}` — visualize e gerencie suas missões diárias
  - `>view` — exibe suas missões atribuídas para o dia atual, com progresso em barra, recompensas e status
    - A quantidade de missões visíveis depende do seu plano. É possível desbloquear slots extras comprando pacotes com a moeda do servidor
    - Missões concluídas exibem um botão de resgate diretamente na mensagem
  - `>claim <id>` — resgata a recompensa de uma missão concluída
    - `id` - (número, obrigatório) - ID da missão, visível no `/missions view`
    - Recompensas possíveis: XP, moeda do servidor e/ou badges
  - As missões renovam à meia-noite
  - exemplos:
    1. Ver missões: `/missions view`
    2. Resgatar missão: `/missions claim 7`

---

- `/missions-rank [page]` — exibe o ranking de missões completadas no dia atual
  - Mostra quantas missões cada membro completou e resgatou hoje, além da streak de dias consecutivos
  - `page` - (número) - página inicial do ranking (padrão: 1)
  - O ranking é paginado com botões de navegação
  - exemplos:
    1. Ver o ranking: `/missions-rank`
    2. Abrir em uma página específica: `/missions-rank 2`

---

- `/xp-rank [page]` — exibe o ranking de XP do servidor
  - Mostra os membros ordenados por XP acumulado no servidor, com barra de progresso e nível atual
  - `page` - (número) - página inicial do ranking (padrão: 1)
  - O ranking é paginado com botões de navegação
  - exemplos:
    1. Ver o ranking: `/xp-rank`
    2. Abrir em uma página específica: `/xp-rank 3`

---

#### Usuário

- `/profile [user]` — exibe o card de perfil de um usuário
  - `user` - (usuário Discord) - usuário a consultar. Se omitido, exibe o seu próprio perfil
  - O card inclui: avatar, username, nível, XP, moedas, plano e itens equipados
  - O resultado é cacheado por 5 minutos para otimizar performance
  - exemplos:
    1. Ver seu próprio perfil: `/profile`
    2. Ver o perfil de outro usuário: `/profile @alguém`

---

- `/profile-edit <item> [argument]` — personaliza seu perfil
  - `item` - (escolha, obrigatório) - o que deseja editar:
    - `Bio` — altera sua bio (máximo de 32 caracteres). `argument` deve ser o texto da bio
    - `Wallpaper` — define o wallpaper ativo. `argument` deve ser o ID do item de wallpaper
    - `Color` — define a cor do perfil. `argument` deve ser o ID do item de cor
    - `Background` — define o background do card. `argument` deve ser o ID do item de background
    - `Title` — define seu título. `argument` deve ser o ID do item de título
    - `Badge` — equipa ou remove uma badge. `argument` deve ser o ID do badge (máximo de 3 badges equipadas simultaneamente)
  - `argument` - (texto) - o valor a aplicar, varia conforme o `item` escolhido (veja acima)
  - Itens de wallpaper, cor, background, título e badge precisam estar no seu inventário
  - O cache do card de perfil é invalidado automaticamente após edições
  - exemplos:
    1. Mudar a bio: `/profile-edit Bio Desenvolvedor de bots`
    2. Equipar uma badge: `/profile-edit Badge 15`
    3. Mudar o background: `/profile-edit Background 8`

---

- `/userinfo [user]` — exibe informações detalhadas sobre um usuário
  - `user` - (usuário Discord) - usuário a consultar. Se omitido, exibe suas próprias informações
  - Mostra: ID, plano, data de criação da conta Discord, data de cadastro no bot, XP, nível, BankCoins e posição no ranking global
  - Inclui um menu interativo para consultar o saldo de moedas de cada servidor do qual o usuário faz parte
  - exemplos:
    1. Ver suas informações: `/userinfo`
    2. Ver informações de outro usuário: `/userinfo @alguém`

---

- `/inventory [filter]` — exibe os itens que você possui
  - `filter` - (escolha) - filtra os itens por tipo:
    - `🎖️ Badges` — exibe apenas badges
    - `🖼️ Wallpapers` — exibe apenas wallpapers/backgrounds
    - `🎨 Cores` — exibe apenas cores de perfil
    - `🔲 Frames` — exibe apenas frames
    - `📦 Todos` — exibe todos os itens (padrão)
  - Para cada item é exibido: ID, nome, raridade, status de equipamento e origem (compra ou missão)
  - exemplos:
    1. Ver tudo: `/inventory`
    2. Ver apenas badges: `/inventory 🎖️ Badges`

---

- `/language <lang>` — define o idioma do bot para você
  - `lang` - (escolha, obrigatório):
    - `🇧🇷 Português` — idioma oficial do bot
    - `🇺🇸 English` — inglês (pode conter erros de tradução)
  - A configuração é individual e não afeta outros usuários

---

- `/delete-data` — exclui permanentemente todos os seus dados do bot
  - Remove: perfil, inventário, missões, histórico de XP, assinatura e dados de todos os servidores
  - Uma confirmação por botão é exibida antes da exclusão
  - **Essa ação é irreversível**

---

- `/privacy` — exibe a política de privacidade do BankBot
  - Apresenta os termos com opções para aceitar ou recusar via botões

---

#### Utilitários

- `/ping` — exibe a latência atual do bot
  - Mostra três métricas:
    - **WebSocket** — latência da conexão com o gateway do Discord
    - **API** — tempo de resposta da API do Discord
    - **Banco de dados** — tempo de resposta do banco de dados interno

---

- `/botinfo` — exibe informações gerais sobre o bot
  - Mostra: número de servidores, número de usuários registrados, tempo online (uptime), planos disponíveis e os 3 comandos mais usados

---

- `/metrics` — exibe métricas de sistema e estatísticas de uso de comandos
  - Mostra: uso de CPU, uso de memória RAM, uptime, heap do Node.js, número de núcleos e versão do Node.js
  - Exibe um gráfico dos **10 comandos mais usados** ou **10 menos usados**, alternável por botões
