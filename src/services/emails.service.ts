import { transporter } from "../config/email";
import env from "../config/env";

export async function sendReminderEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"${env.smtpFromName}" <${env.smtpUser}>`,
      to,
      subject,
      html,
    });

    console.log("[Email] Enviado:", info.messageId);
    return true;
  } catch (error) {
    console.error("[Email] Error:", error);
    return false;
  }
}
