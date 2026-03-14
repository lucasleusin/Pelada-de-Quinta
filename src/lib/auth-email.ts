const DEFAULT_APP_BASE_URL = "https://pelada.losportsconsulting.com";

function getAppBaseUrl() {
  return process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || DEFAULT_APP_BASE_URL;
}

function buildAppUrl(path: string) {
  return new URL(path, getAppBaseUrl()).toString();
}

type AuthEmailInput = {
  to: string;
  subject: string;
  headline: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
};

function buildHtml(input: AuthEmailInput) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #15371f;">
      <h2 style="color: #0e6b3d;">${input.headline}</h2>
      <p style="line-height: 1.6;">${input.body}</p>
      <p style="margin: 28px 0;">
        <a href="${input.actionUrl}" style="display: inline-block; background: #0e6b3d; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-weight: 600;">
          ${input.actionLabel}
        </a>
      </p>
      <p style="font-size: 12px; color: #466354; line-height: 1.5;">Se o botao nao abrir, copie este link no navegador:<br />${input.actionUrl}</p>
    </div>
  `;
}

async function sendViaResend(input: AuthEmailInput) {
  const apiKey = process.env.AUTH_RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("Envio de email nao configurado. Defina AUTH_RESEND_API_KEY e AUTH_EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: buildHtml(input),
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "Falha ao enviar email transacional.");
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const actionUrl = buildAppUrl(`/verificar-email?token=${encodeURIComponent(token)}`);

  await sendViaResend({
    to: email,
    subject: "Confirme seu email na Pelada da Quinta",
    headline: "Confirme seu cadastro",
    body: "Clique no botao abaixo para confirmar seu email e seguir para aprovacao do cadastro.",
    actionLabel: "Confirmar email",
    actionUrl,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const actionUrl = buildAppUrl(`/redefinir-senha?token=${encodeURIComponent(token)}`);

  await sendViaResend({
    to: email,
    subject: "Redefina sua senha da Pelada da Quinta",
    headline: "Redefinicao de senha",
    body: "Recebemos um pedido para redefinir sua senha. Se foi voce, continue pelo botao abaixo.",
    actionLabel: "Redefinir senha",
    actionUrl,
  });
}
