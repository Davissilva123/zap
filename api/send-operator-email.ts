import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, password, loginUrl, restaurantName } = req.body ?? {};

  if (!email || !password || !loginUrl) {
    return res.status(400).json({ error: 'Campos obrigatórios: email, password, loginUrl' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY não configurada nas variáveis de ambiente do Vercel' });
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:520px;width:100%;">

        <tr>
          <td style="background:#10b981;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;">⚡ ZapMenu</p>
            ${restaurantName ? `<p style="margin:6px 0 0;color:#d1fae5;font-size:14px;">${restaurantName}</p>` : ''}
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Olá, ${name ?? 'Operador'}! 👋</p>
            <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
              Seu acesso ao sistema foi criado. Use as credenciais abaixo para entrar.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Usuário (e-mail)</span><br>
                      <span style="font-size:15px;font-weight:600;color:#1e293b;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Senha</span><br>
                      <span style="font-size:20px;font-weight:700;color:#10b981;font-family:monospace;letter-spacing:3px;">${password}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Link de acesso</span><br>
                      <a href="${loginUrl}" style="font-size:14px;color:#3b82f6;text-decoration:none;">${loginUrl}</a>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${loginUrl}" style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">
                    Acessar o sistema →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">
              Recomendamos alterar sua senha após o primeiro acesso.<br>
              Se não reconhece este e-mail, ignore esta mensagem.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#cbd5e1;">ZapMenu — Sistema de gestão para restaurantes</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const EMAIL_FROM = process.env.EMAIL_FROM ?? 'ZapMenu <onboarding@resend.dev>';

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: `Seu acesso ao ZapMenu${restaurantName ? ` — ${restaurantName}` : ''}`,
      html,
    }),
  });

  const result = await resendRes.json();

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!resendRes.ok) {
    const msg = result?.message ?? result?.name ?? JSON.stringify(result);
    return res.status(500).json({ error: msg });
  }

  return res.status(200).json({ ok: true });
}
