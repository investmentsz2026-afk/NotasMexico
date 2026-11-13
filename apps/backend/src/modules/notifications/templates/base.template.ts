export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface BaseEmailParams {
  title: string;
  recipientName?: string;
  badgeText?: string;
  contentHtml: string;
  actionUrl?: string;
  actionText?: string;
}

export function renderBaseEmailLayout(params: BaseEmailParams): { html: string; text: string } {
  const safeTitle = escapeHtml(params.title);
  const safeRecipient = params.recipientName ? escapeHtml(params.recipientName) : 'Usuario Institucional';
  const safeBadge = params.badgeText ? escapeHtml(params.badgeText) : 'MexAgenda';
  const actionButton = params.actionUrl
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${escapeHtml(params.actionUrl)}"
           style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600; border-radius: 6px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
          ${escapeHtml(params.actionText || 'Ver en Plataforma Institucional')}
        </a>
      </div>
    `
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
          <!-- Cabecera Institucional -->
          <tr>
            <td style="background-color: #1e293b; padding: 24px 30px; border-bottom: 3px solid #d97706;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #f8fafc; letter-spacing: -0.5px;">
                      MEX<span style="color: #f59e0b;">AGENDA</span>
                    </span>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Sistema Privado de Gestión Institucional
                    </div>
                  </td>
                  <td align="right">
                    <span style="background-color: #334155; color: #f1f5f9; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
                      ${safeBadge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo del Mensaje -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0;">
                Estimado(a) <strong>${safeRecipient}</strong>,
              </p>
              <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.4;">
                ${safeTitle}
              </h2>
              
              <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${params.contentHtml}
              </div>

              ${actionButton}

              <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0 0; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Por motivos de seguridad, los documentos oficiales y acuerdos protegidos solo son accesibles autenticándose formalmente en la plataforma.
              </p>
            </td>
          </tr>

          <!-- Pie Institucional y Confidencialidad -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">
                AVISO DE CONFIDENCIALIDAD INSTITUCIONAL
              </p>
              <p style="margin: 0 0 8px 0;">
                Este correo electrónico y sus vínculos están dirigidos exclusivamente al destinatario oficial de la cuenta. Contiene información institucional de carácter reservado o confidencial. Si ha recibido este mensaje por error, notifique de inmediato al administrador y elimínelo sin reproducirlo ni divulgarlo.
              </p>
              <p style="margin: 0; color: #94a3b8; text-align: center;">
                MexAgenda © 2026 — Plataforma Institucional Segura
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Versión en texto plano para clientes de correo sin renderizador HTML
  const text = `
MEXAGENDA — Sistema Privado de Gestión Institucional
[${safeBadge}]

Estimado(a) ${params.recipientName || 'Usuario Institucional'},

${params.title}

${params.contentHtml.replace(/<[^>]*>/g, '')}

${params.actionUrl ? `Acceso a la plataforma: ${params.actionUrl}` : ''}

--------------------------------------------------------------------------------
AVISO DE CONFIDENCIALIDAD: Este correo contiene información institucional reservada.
MexAgenda © 2026
`;

  return { html, text };
}

