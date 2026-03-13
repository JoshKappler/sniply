import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@sniply.app";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your Sniply password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <h2 style="margin-top: 0; font-size: 22px;">Reset your password</h2>
        <p style="color: #555;">We received a request to reset the password for your Sniply account.</p>
        <a href="${resetLink}"
           style="display: inline-block; margin: 24px 0; padding: 14px 28px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 13px;">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.</p>
        <p style="color: #ccc; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">Sniply, Inc.</p>
      </div>
    `,
  });
}
