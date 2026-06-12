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
    const { email, redirectTo } = req.body ?? {};

    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@zapmenu.com.br';
    const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME ?? 'ZapMenu';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados.' });
    }
    if (!BREVO_API_KEY) {
      return res.status(500).json({ error: 'BREVO_API_KEY não configurada.' });
    }

    // Generate recovery link via Supabase admin API
    const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        type: 'recovery',
        email: email.trim().toLowerCase(),
        options: {
          redirect_to: redirectTo ?? `${process.env.SITE_URL ?? 'https://zap-sigma.vercel.app'}/reset-password`,
        },
      }),
    });

    if (!genRes.ok) {
      const genErr = await genRes.json().catch(() => ({}));
      const msg = genErr?.msg ?? genErr?.message ?? genErr?.error_description ?? JSON.stringify(genErr);
      // If user not found, return success anyway (don't leak user existence)
      if (genRes.status === 422 || genRes.status === 404) {
        return res.status(200).json({ ok: true });
      }
      return res.status(500).json({ error: `Supabase: ${msg}` });
    }

    const genData = await genRes.json();
    const actionLink: string = genData.action_link ?? genData.properties?.action_link;

    if (!actionLink) {
      return res.status(500).json({ error: 'Não foi possível gerar o link de recuperação.' });
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
            <p style="margin:6px 0 0;color:#d1fae5;font-size:14px;">Recuperacao de senha</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">Redefinir sua senha</p>
            <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
              Recebemos uma solicitacao de recuperacao de senha para a conta associada a <strong>${email}</strong>.<br><br>
              Clique no botao abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${actionLink}" style="display:inline-block;background:#10b981;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;">
                  Redefinir senha
                </a>
              </td></tr>
            </table>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Ou copie o link abaixo:</p>
              <p style="margin:0;font-size:12px;color:#64748b;word-break:break-all;">${actionLink}</p>
            </div>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;text-align:center;">
              Se voce nao solicitou a recuperacao, ignore este e-mail — sua senha nao sera alterada.
            </p>
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
        to: [{ email: email.trim().toLowerCase() }],
        subject: 'Redefinir senha — ZapMenu',
        htmlContent: html,
      }),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.json().catch(() => ({ message: brevoRes.statusText }));
      const msg = errBody?.message ?? JSON.stringify(errBody);
      return res.status(500).json({ error: `Brevo: ${msg}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
}
