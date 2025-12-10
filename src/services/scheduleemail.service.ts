import Seguimiento from "../models/Cseguimiento";
import User from "../models/User";
import { sendReminderEmail } from "./emails.service";

export async function procesarRecordatorios() {
  const ahora = new Date();

  const pendientes = await Seguimiento.find({
    enviado: false,
    f_recordatorio: { $lte: ahora },
  }).lean();

  for (const seg of pendientes) {
    const user = await User.findById(seg.id_user).select("email").lean();
    if (!user?.email) continue;

    const ok = await sendReminderEmail(
      user.email,
      "Recordatorio de Cotización",
      `
        <h2>Recordatorio</h2>
        <p>${seg.descripcion ?? "Tienes un recordatorio pendiente."}</p>
        <p><strong>ID Cotización:</strong> ${seg.id_cotizacion}</p>
      `
    );

    if (ok) {
      await Seguimiento.updateOne(
        { _id: seg._id },
        { $set: { enviado: true } }
      );
    }
  }
}
