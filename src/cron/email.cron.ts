import cron from "node-cron";
import { procesarRecordatorios } from "../services/scheduleemail.service";

export function startReminderCron() {
  cron.schedule("* * * * *", async () => {
    console.log("Ejecutando tarea de recordatorios de email...");
    await procesarRecordatorios();
  });
}
