# 🏦 BankBot

Discord economy bot com leveling, loja diária, missões, câmbio entre moedas e planos baseados em bancos internacionais.

## Planos

| Plano     | Label  | Multiplier | Moeda do Servidor | XP Customizável | Boost Bônus |
|-----------|--------|------------|-------------------|-----------------|-------------|
| HSBC      | Free   | 1x         | ❌                | ❌              | ❌          |
| Barclays  | Basic  | 1.5x       | ✅                | ❌              | Até 1.5x    |
| Deutsche  | Pro    | 2x         | ✅                | ✅              | Até 2x      |
| UBS       | Elite  | 3x         | ✅                | ✅              | Até 3x      |

## Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar ambiente
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Banco de dados
```bash
npm run db:generate
npm run db:migrate
```

### 4. Rodar
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build && npm start
```

## Estrutura

```
src/
├── bot/          # Client, handlers, status
├── commands/     # Slash commands por categoria
├── events/       # Eventos do Discord
├── modules/      # Lógica de negócio
├── db/           # Schema, client, Redis
├── jobs/         # Cron jobs
├── i18n/         # Traduções PT/EN
├── shared/       # Tipos, constantes, embed, planos
└── data/         # JSONs de missões e anúncios
```

## Comandos

### Economy
- `/daily` — Recompensa diária
- `/balance` — Saldo e XP
- `/shop view` — Ver loja diária
- `/shop buy <id>` — Comprar item
- `/exchange` — Taxa de câmbio entre moedas

### Leveling
- `/rank` — Ranking de XP

### Usuário
- `/privacy` — Política de privacidade
- `/language` — Mudar idioma (PT/EN)
- `/userinfo` — Info do usuário
- `/delete-data` — Deletar dados

### Servidor
- `/serverinfo` — Info do servidor
- `/currency-create` — Criar moeda (Barclays+)
- `/currency-edit emoji` — Criar emoji da moeda
- `/currency-edit inflation` — Ajustar inflação manualmente
- `/xp-config` — Configurar algoritmo de XP (Deutsche+)
- `/boost-config` — Configurar bônus de boost

### Admin (Team/Dono do Bot)
- `/set-premium` — Definir plano de usuário
- `/news-add` — Enviar novidade para servidores
- `/season-set` — Ativar temporada de missões
- `/rotate-shop` — Forçar rotação da loja
- `/ads-reload` — Recarregar ads.json

### Utilitário
- `/ping` — Latência WS, API e DB

## Inflação

A inflação é calculada **automaticamente** pelo bot a cada 24h com base no total de moedas em circulação:

- Supply baixo (<1.000) → deflação leve
- Supply médio → taxa base (~2%)
- Supply alto (>1.000.000) → até 20% de inflação

O dono do servidor pode sobrescrever manualmente com `/currency-edit inflation <rate>` e voltar ao automático com rate `-1`.

## Missões

Adicione missões em `src/data/missions.json` sem reiniciar o bot. O bot lê o arquivo dinamicamente a cada acesso.

Missões sazonais ficam em `src/data/missions.seasonal.json` e são ativadas com `/season-set`.

## Ads

Edite `src/data/ads.json` e recarregue com `/ads-reload` sem reiniciar o bot.

O campo `options` aceita qualquer JSON válido do `MessageCreateOptions` do discord.js.

## Docker (recomendado para produção)

```yaml
# docker-compose.yml
version: "3.9"
services:
  bot:
    build: .
    env_file: .env
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: bankbot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}

volumes:
  pgdata:
```
