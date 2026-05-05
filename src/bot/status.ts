import { ActivityType, type Client } from "discord.js";

const STATUS_LIST = [
  { type: ActivityType.Watching,  name: "sua carteira encolher 📉" },
  { type: ActivityType.Playing,   name: "com a inflação 💸" },
  { type: ActivityType.Listening, name: "/daily • colete sua recompensa" },
  { type: ActivityType.Watching,  name: "o câmbio subir 📈" },
  { type: ActivityType.Playing,   name: "BankBot • UBS Elite" },
  { type: ActivityType.Competing, name: "quem chega ao level 100 primeiro" },
  { type: ActivityType.Watching,  name: "os planos HSBC → UBS 🏦" },
  { type: ActivityType.Playing,   name: "no mercado de câmbio 💱" }
];

export function startStatusRotation(client: Client): void {
  let i = 0;

  const set = (): void => {
    const s = STATUS_LIST[i % STATUS_LIST.length];
    if (s !== undefined) {
      client.user?.setActivity(s.name, { type: s.type });
    }
    i++;
  };

  set();
  setInterval(set, 30_000);
}
