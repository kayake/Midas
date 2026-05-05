// src/jobs/cleanExpiredSubscriptions.ts
import cron from "node-cron";
import { cleanExpired } from "../modules/subscription/subscription.service";

cron.schedule("30 0 * * *", () => {
  void cleanExpired();
});
