import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  primaryKey,
  real,
  jsonb
} from "drizzle-orm/pg-core";

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:              text("id").primaryKey(),
  language:        text("language").default("pt").notNull(),
  privacyAccepted: boolean("privacy_accepted").default(false).notNull(),
  privacyAt:       timestamp("privacy_at"),
  centralCoins:    real("central_coins").default(0).notNull(),
  createdAt:       timestamp("created_at").defaultNow(),
  bio:            text("bio"),
  title:          text("title"),
  // IDs de itens do inventário equipados no perfil
  backgroundId:   integer("background_id"),   // type = "background"
  profileColorId: integer("profile_color_id"), // type = "color" (pode ser gradiente)
  frameId:        integer("frame_id"),          // type = "frame"
});

// ─── GUILDS ───────────────────────────────────────────────────────────────────
export const guilds = pgTable("guilds", {
  id:                text("id").primaryKey(),
  ownerId:           text("owner_id").notNull(),
  language:          text("language").default("pt").notNull(),
  logChannelId:      text("log_channel_id"),
  newsOptIn:         boolean("news_opt_in").default(false).notNull(),
  xpNotificationChannelId: text("xp_notification_channel_id"),
  xpNotificationMessage: text("xp_notification_message").default("Parabéns {user}! Você subiu para o nível {level.next}."),
  missionCompletedChannelId: text("mission_completed_channel_id"),
  xpAlgorithm:       jsonb("xp_algorithm")
                       .default({ base: 100, exponent: 1.5, multiplier: 1 })
                       .notNull(),
  boostBonusEnabled: boolean("boost_bonus_enabled").default(false).notNull(),
  boostBonusMax:     real("boost_bonus_max").default(1).notNull(),
  createdAt:         timestamp("created_at").defaultNow()
});

// ─── GUILD MEMBERS ────────────────────────────────────────────────────────────
export const guildMembers = pgTable("guild_members", {
  userId:       text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  guildId:      text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  xp:           integer("xp").default(0).notNull(),
  level:        integer("level").default(1).notNull(),
  serverCoins:  real("server_coins").default(0).notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.guildId] })
}));

// ─── LEVEL REWARDS ────────────────────────────────────────────────────────────
export const levelRewards = pgTable("level_rewards", {
  id:      serial("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id, { onDelete: "cascade" }),
  level:   integer("level").notNull(),
  roleId:  text("role_id").notNull()
});

// ─── SERVER CURRENCIES ────────────────────────────────────────────────────────
export const serverCurrencies = pgTable("server_currencies", {
  guildId:           text("guild_id").primaryKey().references(() => guilds.id, { onDelete: "cascade" }),
  name:              text("name").notNull(),
  symbol:            text("symbol").notNull(),
  imageUrl:          text("image_url").notNull(),
  emojiId:           text("emoji_id"),
  emojiCreated:      boolean("emoji_created").default(false).notNull(),
  // Taxa automática calculada pelo bot (sempre atualizada)
  inflationRate:     real("inflation_rate").default(0).notNull(),
  // Override manual — quando setado, vira a taxa efetiva. null = usa automático
  inflationOverride: real("inflation_override"),
  totalSupply:       real("total_supply").default(0).notNull(),
  lastInflationAt:   timestamp("last_inflation_at"),
  createdAt:         timestamp("created_at").defaultNow()
});

// ─── INFLATION LOG ────────────────────────────────────────────────────────────
// guildId é nullable: null ou "central" = moeda central do bot
// Sem FK para guilds — permite logar inflação da moeda central sem seed fictício
export const inflationLog = pgTable("inflation_log", {
  id:         serial("id").primaryKey(),
  // null = moeda central do bot; valor = guild com moeda própria
  guildId:    text("guild_id"),
  rateBefore: real("rate_before").notNull(),
  rateAfter:  real("rate_after").notNull(),
  supply:     real("supply").notNull(),
  reason:     text("reason").notNull(), // "auto" | "manual"
  changedBy:  text("changed_by"),       // null = bot automático
  createdAt:  timestamp("created_at").defaultNow()
});

// ─── EXCHANGE RATES ───────────────────────────────────────────────────────────
export const exchangeRates = pgTable("exchange_rates", {
  id:          serial("id").primaryKey(),
  fromGuildId: text("from_guild_id"), // null = moeda central
  toGuildId:   text("to_guild_id"),   // null = moeda central
  rate:        real("rate").notNull(),
  recordedAt:  timestamp("recorded_at").defaultNow()
});

// ─── SHOP ITEMS ───────────────────────────────────────────────────────────────
export const shopItems = pgTable("shop_items", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  imageUrl:    text("image_url").notNull(),
  // "badge"      → badge equipável no perfil
  // "background" → wallpaper do perfil (imageUrl = URL da imagem)
  // "color"      → cor/gradiente do layout (colorValue = CSS color ou linear-gradient)
  // "frame"      → frame ao redor do avatar
  // "role"       → cargo do Discord
  type:        text("type").notNull(),
  price:       real("price").notNull(),
  rarity:      text("rarity").notNull(),  // "common" | "rare" | "epic" | "legendary"
  buyable:     boolean("buyable").default(true).notNull(),
  rotative:    boolean("rotative").default(true).notNull(),
  // Usado apenas por type = "color"
  // Ex: "#ff6b6b" ou "linear-gradient(135deg, #667eea, #764ba2)"
  colorValue:  text("color_value"),
  createdAt:   timestamp("created_at").defaultNow()
});

// ─── DAILY SHOP ───────────────────────────────────────────────────────────────
export const dailyShop = pgTable("daily_shop", {
  id:        serial("id").primaryKey(),
  itemId:    integer("item_id").notNull().references(() => shopItems.id),
  expiresAt: timestamp("expires_at").notNull()
});

// ─── INVENTORIES ──────────────────────────────────────────────────────────────
export const inventories = pgTable("inventories", {
  userId:   text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId:   integer("item_id").notNull().references(() => shopItems.id),
  source:   text("source").notNull().default("shop"), // "shop" | "mission"
  boughtAt: timestamp("bought_at").defaultNow()
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.itemId] })
}));

// ─── EQUIPPED BADGES ──────────────────────────────────────────────────────────
export const equippedBadges = pgTable("equipped_badges", {
  userId:     text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shopItemId: integer("shop_item_id").notNull().references(() => shopItems.id),
  slot:       integer("slot").notNull() // 0, 1, 2
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.slot] })
}));

// ─── XP LOG ───────────────────────────────────────────────────────────────────
export const xpLog = pgTable("xp_log", {
  id:        serial("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  guildId:   text("guild_id").notNull(),
  source:    text("source").notNull(), // "message" | "voice" | "mission" | "daily"
  amount:    integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// ─── USER MISSIONS ────────────────────────────────────────────────────────────
export const userMissions = pgTable("user_missions", {
  userId:     text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  guildId:    text("guild_id").notNull(),
  missionId:  integer("mission_id").notNull(), // ID do JSON, sem FK
  progress:   integer("progress").default(0).notNull(),
  completed:  boolean("completed").default(false).notNull(),
  claimedAt:  timestamp("claimed_at"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  seasonal:   boolean("seasonal").default(false).notNull()
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.guildId, t.missionId, t.assignedAt] })
}));

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id:         serial("id").primaryKey(),
  userId:     text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan:       text("plan").notNull(), // "hsbc" | "barclays" | "deutsche" | "ubs"
  multiplier: real("multiplier").default(1).notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdBy:  text("created_by").notNull()
});

export const subscriptionLog = pgTable("subscription_log", {
  id:         serial("id").primaryKey(),
  userId:     text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan:       text("plan").notNull(),
  multiplier: real("multiplier").notNull(),
  createdAt:  timestamp("created_at").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdBy:  text("created_by").notNull(),
  revokedAt:  timestamp("revoked_at"),
  revokedBy:  text("revoked_by")
});

// ─── COMMAND LOG ──────────────────────────────────────────────────────────────
export const commandLog = pgTable("command_log", {
  id:        serial("id").primaryKey(),
  userId:    text("user_id").notNull(),
  guildId:   text("guild_id"),
  command:   text("command").notNull(),
  args:      jsonb("args"),
  response:  text("response"),
  success:   boolean("success").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// ─── COMMAND METRICS ──────────────────────────────────────────────────────────
export const commandMetrics = pgTable("command_metrics", {
  command:  text("command").primaryKey(),
  useCount: integer("use_count").default(0).notNull(),
  lastUsed: timestamp("last_used")
});

// ─── NEWS ─────────────────────────────────────────────────────────────────────
export const news = pgTable("news", {
  id:        serial("id").primaryKey(),
  options:   jsonb("options").notNull(), // MessageCreateOptions do discord.js
  sentAt:    timestamp("sent_at"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// ─── ACTIVE SEASON ────────────────────────────────────────────────────────────
export const activeSeason = pgTable("active_season", {
  id:          serial("id").primaryKey(),
  season:      text("season").notNull(), // "halloween" | "christmas" | "carnival" | "easter" | "summer"
  activatedBy: text("activated_by").notNull(),
  activatedAt: timestamp("activated_at").defaultNow(),
  expiresAt:   timestamp("expires_at").notNull()
});