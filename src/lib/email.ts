import { Resend } from "resend";
import { getServerEnv, publicEvent } from "./env";

let cached: Resend | null = null;
function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(getServerEnv().RESEND_API_KEY);
  return cached;
}

type SendCreditArgs = {
  to: string;
  name?: string | null;
  creditUrl: string;
};

export async function sendCreditEmail({ to, name, creditUrl }: SendCreditArgs) {
  const env = getServerEnv();
  const subject = `Your Cursor Credits for ${publicEvent.name}`;
  const greetingName = name?.trim() ? name.trim().split(" ")[0] : "there";

  const html = renderHtml({ greetingName, creditUrl });
  const text = renderText({ greetingName, creditUrl });

  const { data, error } = await getResend().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
    text,
    replyTo: env.RESEND_REPLY_TO || undefined,
    headers: {
      "X-Entity-Ref-ID": `chyd-${Date.now()}`,
    },
  });

  if (error) throw new Error(`Resend error: ${error.message ?? "unknown"}`);
  return data?.id ?? null;
}

function renderText({ greetingName, creditUrl }: { greetingName: string; creditUrl: string }) {
  return [
    `Hi ${greetingName},`,
    "",
    `Thanks for attending ${publicEvent.name}.`,
    "",
    "Your unique Cursor credits link:",
    creditUrl,
    "",
    "Important:",
    "• Please redeem while logged into the correct Cursor account.",
    "• Credits work only for individual accounts, not Team plans.",
    "",
    `Presented by ${publicEvent.organizer}`,
    `Host: ${publicEvent.host}`,
  ].join("\n");
}

function renderHtml({ greetingName, creditUrl }: { greetingName: string; creditUrl: string }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Your Cursor Credits</title>
  </head>
  <body style="margin:0;padding:0;background:#05060a;color:#f4f5f7;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05060a;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
            style="max-width:560px;width:100%;background:#0b0d14;border:1px solid #1e2230;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;text-align:center;">
                <div style="display:inline-block;width:44px;height:44px;border-radius:12px;
                  background:linear-gradient(135deg,#7c5cff,#ff5277 60%,#f5b042);"></div>
                <h1 style="font-size:22px;line-height:1.3;margin:18px 0 4px 0;color:#f4f5f7;">
                  Your Cursor credits are ready
                </h1>
                <p style="margin:0;color:#9aa3b2;font-size:14px;">
                  ${escapeHtml(publicEvent.name)} · ${escapeHtml(publicEvent.date)}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 32px 8px 32px;color:#f4f5f7;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px 0;">Hi ${escapeHtml(greetingName)},</p>
                <p style="margin:0 0 16px 0;">
                  Thanks for attending <strong>${escapeHtml(publicEvent.name)}</strong>.
                  Tap the button below to claim your Cursor credits.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 32px 24px 32px;">
                <a href="${escapeAttr(creditUrl)}"
                  style="display:inline-block;background:#f4f5f7;color:#05060a;
                  text-decoration:none;font-weight:600;font-size:15px;
                  padding:14px 22px;border-radius:10px;">
                  Claim my Cursor credits
                </a>
                <div style="margin-top:14px;font-size:12px;color:#5e6675;word-break:break-all;">
                  Or paste this link: <span style="color:#9aa3b2;">${escapeHtml(creditUrl)}</span>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 24px 32px;">
                <div style="border-top:1px solid #1e2230;padding-top:18px;color:#9aa3b2;font-size:13px;line-height:1.6;">
                  <strong style="color:#f4f5f7;">Important</strong><br/>
                  • Redeem while logged into the correct Cursor account.<br/>
                  • Credits work for <em>individual</em> accounts, not Team plans.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 32px 28px 32px;border-top:1px solid #1e2230;text-align:center;color:#5e6675;font-size:12px;">
                Presented by <strong style="color:#9aa3b2;">${escapeHtml(publicEvent.organizer)}</strong><br/>
                Hosted by ${escapeHtml(publicEvent.host)}
              </td>
            </tr>
          </table>
          <div style="color:#5e6675;font-size:11px;margin-top:14px;">
            You received this because you registered for ${escapeHtml(publicEvent.name)} on Luma.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}
