# Help

This file lists all commands and their respective categories.

> [!NOTE]
> `<>` - required;
> `[]` - optional;
> `{}` - required only when another argument is optional;
> `>` - sub-command;

---

#### Economy

- `/currency-info [coin]` — shows detailed information about a currency and its inflation chart
  - `coin` - (text) - name of the server currency to look up. If omitted, displays info about the **global coin**
  - The embed includes: name, symbol, origin server, creation date, current inflation rate, percentage variation, total supply and exchange rate against BankCoin
  - examples:
    1. View the global coin: `/currency-info`
    2. View a server currency: `/currency-info CoolCoin`

---

- `/daily` — claim your daily Global coin reward
  - The reward ranges from **600** to **2100 BankCoins** based on your activity during the day (messages sent)
  - Users on paid plans receive a multiplier applied on top of the activity bonus
  - Can only be claimed once per day; the counter resets at midnight
  - After claiming, your current position on the global ranking is displayed
  
---

- `/exchange [coin1] [coin2]` — shows the exchange rate between two currencies
  - At least one argument must be provided
  - `coin1` - (text) - name of the source currency. If omitted, uses the **global coin** as source
  - `coin2` - (text) - name of the target currency. If omitted, uses the **global coin** as target
  - The rate is calculated automatically based on each server's economic parameters
  - examples:
    1. Compare a server currency to the global BankCoin: `/exchange CoolCoin`
    2. Compare two server currencies: `/exchange CoolCoin_1 CoolCoin_2`

---

- `/leaderboard >(global|local) {type} [page]` — displays the coin ranking, server-wide or global
  - `>global` — global **BankCoin** ranking across all bot users
    - `page` - (number) - starting page of the ranking (default: 1)
  - `>local` — coin ranking within the current server
    - `type` - (required) - which coin to rank by:
      - `Server Coin` — ranks members by their local server coin balance
      - `Global Coin (BankCoin)` — ranks server members by their BankCoin balance
    - `page` - (number) - starting page of the ranking (default: 1)
  - The ranking is paginated (10 per page) with navigation buttons
  - examples:
    1. Global ranking: `/leaderboard global`
    2. Local ranking by BankCoin: `/leaderboard local Global Coin`
    3. Local ranking by server coin: `/leaderboard local Server Coin`
    4. Open at a specific page: `/leaderboard global 3`

---

- `/shop >(view|buy) {item_id}` — browse or purchase items from the daily shop
  - `>view` — shows today's available items with name, description, rarity and price in BankCoins
  - `>buy <item_id>` — purchases an item by its ID
    - `item_id` - (number, required) - ID of the item to buy, visible in `/shop view`
  - The shop rotates daily and items change every day
  - examples:
    1. Browse available items: `/shop view`
    2. Buy an item: `/shop buy 42`

---

#### Server

- `/serverinfo` — displays general information about the current server
  - Shows: ID, owner, active plan (based on the owner's plan), boost level, member count, server currency, inflation rate and exchange rate with the global BankCoin

---

- `/settings >(xp-notification|boost-config|currency-create|currency-edit|mission-notification-channel) {args}` — configures the server
  - Requires the **Manage Server** permission

  - `>xp-notification [channel] [message]` — configures the level-up notification system
    - `channel` - (text channel) - channel where notifications will be sent. Omitting keeps the current one
    - `message` - (text) - message sent when a user levels up. Omitting keeps the current one
    - Available placeholders for the message:
      - `{user.mention}` or `{user}` — mentions the user
      - `{user.id}` — the user's ID
      - `{guild.name}` — server name
      - `{level.current}` — current level
      - `{level.next}` — next level
      - `{level.current.xp}` — XP required for the current level
      - `{level.next.xp}` — XP required for the next level
      - `{xp.total}` or `{xp.current}` — total accumulated XP
    - examples:
      1. Set both channel and message: `/settings xp-notification #general Congrats {user}, you reached level {level.current}!`
      2. Change only the channel: `/settings xp-notification #another-channel`
      3. Change only the message: `/settings xp-notification message:Wow, {user} leveled up!`

  - `>boost-config <enabled> [max_bonus]` — configures the XP bonus for server boosters
    - `enabled` - (true/false, required) - enables or disables the booster bonus
    - `max_bonus` - (number) - maximum multiplier to apply. If omitted, uses the maximum allowed by the server's plan
    - The bonus also accounts for the server's boost tier automatically
    - Requires a paid plan

  - `>currency-create <name> <symbol> <image_url>` — creates the server's custom currency
    - `name` - (text, required) - currency name (e.g. `Dollar`)
    - `symbol` - (text, required) - currency symbol (e.g. `$`, `R$`, `€`)
    - `image_url` - (text, required) - URL of the currency image. An emoji will be created in the server using this icon; if no emoji slots are available, the command will still work without it
    - Requires **Barclays plan or higher**
    - examples:
      1. `/settings currency-create Dollar $ https://example.com/icon.png`

  - `>currency-edit [emoji]` — edits the server's existing currency
    - `emoji` - (text) - attempts to recreate the currency emoji in the server
    - Requires **Barclays plan or higher**

  - `>mission-notification-channel [channel]` — sets the mission notification channel
    - `channel` - (text channel) - channel where mission notifications will be sent. If omitted, removes the current configuration

---

- `/xp-config <base> <exponent> <multiplier>` — configures the XP algorithm for the server
  - Requires the **Manage Server** permission and **Deutsche plan or higher**
  - `base` - (number, required) - base XP per level (recommended default: `100`)
  - `exponent` - (number, required) - exponent of the progression curve (recommended default: `1.5`)
  - `multiplier` - (number, required) - global XP multiplier (recommended default: `1`)
  - Before confirming, displays a projection graph and a simulation of the first 10 levels for review
  - examples:
    1. Smooth curve: `/xp-config 100 1.5 1`
    2. Steeper curve: `/xp-config 150 2 1`

---

#### Missions

- `/missions >(view|claim) {id}` — view and manage your daily missions
  - `>view` — shows your missions assigned for today, with progress bar, rewards and status
    - The number of visible missions depends on your plan. Extra slots can be unlocked by purchasing packs with the server currency
    - Completed missions show a claim button directly in the message
  - `>claim <id>` — claims the reward for a completed mission
    - `id` - (number, required) - mission ID, visible in `/missions view`
    - Possible rewards: XP, server currency and/or badges
  - Missions reset at midnight
  - examples:
    1. View missions: `/missions view`
    2. Claim a mission reward: `/missions claim 7`

---

- `/missions-rank [page]` — displays the mission completion ranking for today
  - Shows how many missions each member has completed and claimed today, along with their consecutive-day streak
  - `page` - (number) - starting page of the ranking (default: 1)
  - The ranking is paginated with navigation buttons
  - examples:
    1. View the ranking: `/missions-rank`
    2. Open at a specific page: `/missions-rank 2`

---

- `/xp-rank [page]` — displays the server XP ranking
  - Lists members ordered by accumulated XP in the server, with progress bar and current level
  - `page` - (number) - starting page of the ranking (default: 1)
  - The ranking is paginated with navigation buttons
  - examples:
    1. View the ranking: `/xp-rank`
    2. Open at a specific page: `/xp-rank 3`

---

#### User

- `/profile [user]` — displays a user's profile card
  - `user` - (Discord user) - user to look up. If omitted, shows your own profile
  - The card includes: avatar, username, level, XP, coins, plan and equipped items
  - The result is cached for 5 minutes to improve performance
  - examples:
    1. View your own profile: `/profile`
    2. View another user's profile: `/profile @someone`

---

- `/profile-edit <item> [argument]` — customize your profile
  - `item` - (choice, required) - what you want to edit:
    - `Bio` — updates your bio (32 characters max). `argument` must be the bio text
    - `Wallpaper` — sets the active wallpaper. `argument` must be the wallpaper item ID
    - `Color` — sets the profile color. `argument` must be the color item ID
    - `Background` — sets the card background. `argument` must be the background item ID
    - `Title` — sets your title. `argument` must be the title item ID
    - `Badge` — equips or removes a badge. `argument` must be the badge item ID (maximum of 3 badges equipped at once)
  - `argument` - (text) - the value to apply, varies depending on the chosen `item` (see above)
  - Wallpaper, color, background, title and badge items must be in your inventory
  - The profile card cache is automatically invalidated after edits
  - examples:
    1. Change bio: `/profile-edit Bio Bot developer`
    2. Equip a badge: `/profile-edit Badge 15`
    3. Change background: `/profile-edit Background 8`

---

- `/userinfo [user]` — displays detailed information about a user
  - `user` - (Discord user) - user to look up. If omitted, shows your own information
  - Shows: ID, plan, Discord account creation date, bot registration date, XP, level, BankCoins and global ranking position
  - Includes an interactive dropdown to check the coin balance for each server the user is a member of
  - examples:
    1. View your own info: `/userinfo`
    2. View another user's info: `/userinfo @someone`

---

- `/inventory [filter]` — displays the items you own
  - `filter` - (choice) - filters items by type:
    - `🎖️ Badges` — shows only badges
    - `🖼️ Wallpapers` — shows only wallpapers/backgrounds
    - `🎨 Colors` — shows only profile colors
    - `🔲 Frames` — shows only frames
    - `📦 All` — shows all items (default)
  - For each item: ID, name, rarity, equipped status and source (purchased or mission reward) are shown
  - examples:
    1. View everything: `/inventory`
    2. View only badges: `/inventory 🎖️ Badges`

---

- `/language <lang>` — sets the bot language for you
  - `lang` - (choice, required):
    - `🇧🇷 Português` — official bot language
    - `🇺🇸 English` — English (may contain translation errors)
  - This setting is per-user and does not affect others

---

- `/delete-data` — permanently deletes all your data from the bot
  - Removes: profile, inventory, missions, XP history, subscription and data from all servers
  - A button confirmation is shown before deletion
  - **This action is irreversible**

---

- `/privacy` — displays BankBot's privacy policy
  - Shows the terms with options to accept or decline via buttons

---

#### Utilities

- `/ping` — displays the bot's current latency
  - Shows three metrics:
    - **WebSocket** — latency of the connection to Discord's gateway
    - **API** — Discord API response time
    - **Database** — internal database response time

---

- `/botinfo` — displays general information about the bot
  - Shows: server count, registered user count, uptime, available plans and the top 3 most used commands

---

- `/metrics` — displays system metrics and command usage statistics
  - Shows: CPU usage, RAM usage, uptime, Node.js heap, number of CPU cores and Node.js version
  - Displays a chart of the **top 10 most used** or **10 least used** commands, toggled via buttons
