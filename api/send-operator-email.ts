import type { VercelRequest, VercelResponse } from '@vercel/node';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, password, loginUrl, restaurantName } = req.body ?? {};

    if (!email || !password || !loginUrl) {
      return res.status(400).json({ error: 'Campos obrigatórios: email, password, loginUrl' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@zapmenu.com.br';
    const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'ZapMenu';

    if (!BREVO_API_KEY) {
      return res.status(500).json({
        error: 'Variável BREVO_API_KEY não configurada no Vercel. Crie uma conta gratuita em brevo.com e adicione a chave.',
      });
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:520px;width:100%;">
        <tr>
          <td style="background:#10b981;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;">ZapMenu</p>
            ${restaurantName ? `<p style="margin:6px 0 0;color:#d1fae5;font-size:14px;">${restaurantName}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;">Ola, ${name ?? 'Operador'}!</p>
            <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">Seu acesso ao sistema foi criado. Use as credenciais abaixo para entrar.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">E-mail</span><br>
                      <span style="font-size:15px;font-weight:600;color:#1e293b;">${email}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Senha</span><br>
                      <span style="font-size:22px;font-weight:700;color:#10b981;font-family:monospace;letter-spacing:4px;">${password}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Link de acesso</span><br>
                      <a href="${loginUrl}" style="font-size:14px;color:#3b82f6;text-decoration:none;">${loginUrl}</a>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${loginUrl}" style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">Acessar o sistema</a>
              </td></tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">Recomendamos alterar sua senha apos o primeiro acesso.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#cbd5e1;">ZapMenu - Sistema de gestao para restaurantes</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM },
        to: [{ email, name: name ?? email }],
        subject: `Seu acesso ao ZapMenu${restaurantName ? ` - ${restaurantName}` : ''}`,
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.json().catch(() => ({ message: brevoRes.statusText }));
      const msg = errBody?.message ?? errBody?.code ?? JSON.stringify(errBody);
      return res.status(500).json({ error: `Brevo: ${msg}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
