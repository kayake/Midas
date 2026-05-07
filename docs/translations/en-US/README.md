<div align="center">

<!-- Banner -->
<img src="/assets/banner.jpg" alt="Midas Banner" width="100%" />

# 🏦 Midas

Advanced Discord economy and progression bot focused on scalability, automation, dynamic economies, and server customization.

[![TypeScript](https://img.shields.io/badge/TypeScript-ES2023-3178C6?style=for-the-badge&logo=typescript&logoColor=white)]()
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)]()
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)]()
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/CwHXp7VYnc)

</div>

---

# 📖 Documentation

> [!IMPORTANT]
> READ BEFORE USE

## 🇺🇸 English (Translated Version)

- [Help](./help.md)
- [Terms of Service](./ToS.md)
- [Privacy Policy](./Privacy-Policy.md)
- [Read Me](./README.md)

> [!IMPORTANT]
> The Portuguese version prevails in the event of conflicts between translations.

---

# ✨ Features

- 📈 Advanced leveling and progression system
- 💰 Dynamic multi-currency economy
- 🏦 Per-server customizable currencies
- 📊 Automatic inflation system
- 🎯 Missions and seasonal objectives
- 🛒 Rotating daily shop
- 🎨 Profile customization system
- 🌍 Multi-language support

---

# 🏗️ Architecture

```txt
src/
├── bot/              # Client, handlers and runtime
├── commands/         # Slash commands organized by category
├── events/           # Discord events
├── modules/          # Business logic
├── db/               # Schema, client and Redis
├── jobs/             # Automation and cron jobs
├── i18n/             # Translation system
├── shared/           # Types, constants and utilities
├── data/             # Dynamic JSON-driven content
└── security/         # Security and auditing systems
```
---

# 🚀 Installation

## 1. Install dependencies

```
npm install
```

---

## 2. Configure environment variables

```
cp .env.example .env
```

Configure your credentials inside ".env".

---

## 3. Generate and migrate database

```
npm run db:generate
npm run db:migrate
```

---

## 4. 🐳 Docker Compose (Recommended for Production)

```yaml
services:
  postgres:
    image: postgres:16
    container_name: postgres
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT}:6379"
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]

volumes:
  postgres_data:
```

---

## 5. Start application

### 5.1 Development

```
npm run dev
```

### 5.2 Production

```
npx tsx src/index.ts
```

---

# Systems

## 🏦 Economy System

Midas includes a dynamic economy system featuring:

- Global and per-server currencies
- Inflation tracking
- Exchange rates
- Automatic balancing
- Currency customization
- Premium multipliers

> [!TIP]
> Inflation is automatically calculated based on total supply and server activity.»

---

## 🎯 Missions System

Missions are fully dynamic and loaded without requiring application restarts.

Supported types:

- Daily missions
- Seasonal missions
- Progression objectives
- Economy-related activities

---

# 🔒 Security

Midas was designed with a security-oriented architecture.

Includes:

- Operational logs
- Command auditing

> [!NOTE]
> Official support channels and security policies are documented in the Terms of Service and Privacy Policy.»

---

# 📄 License

Distributed under the MIT license.
See [LICENSE](/LICENSE) for more information. 

---

<div align="center">Built with scalability, security and modularity in mind.

</div>
