import { escapeHtml, renderBaseEmailLayout } from './base.template';

export function renderMeetingInviteEmail(params: {
  recipientName: string;
  meetingTitle: string;
  organName?: string;
  dateStr: string;
  modality: string;
  locationOrUrl?: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Convocatoria a Sesión: ${params.meetingTitle}`;
  const contentHtml = `
    <p>Ha sido formalmente convocado(a) a participar en la siguiente sesión institucional:</p>
    <div style="background-color: #f1f5f9; border-left: 4px solid #d97706; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Sesión:</strong> ${escapeHtml(params.meetingTitle)}</p>
      ${params.organName ? `<p style="margin: 0 0 8px 0;"><strong>Órgano Colegiado:</strong> ${escapeHtml(params.organName)}</p>` : ''}
      <p style="margin: 0 0 8px 0;"><strong>Fecha y Hora:</strong> ${escapeHtml(params.dateStr)}</p>
      <p style="margin: 0 0 8px 0;"><strong>Modalidad:</strong> ${escapeHtml(params.modality)}</p>
      ${params.locationOrUrl ? `<p style="margin: 0;"><strong>Lugar / Enlace:</strong> ${escapeHtml(params.locationOrUrl)}</p>` : ''}
    </div>
    <p>Consulte el orden del día y confirme su asistencia a través de la plataforma.</p>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Convocatoria a Sesión Institucional',
    recipientName: params.recipientName,
    badgeText: 'Reunión',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Consultar Orden del Día y Confirmar Asistencia',
  });

  return { html, text, subject };
}

export function renderMeetingUpdateEmail(params: {
  recipientName: string;
  meetingTitle: string;
  changeDetails: string;
  newDateStr?: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Modificación de Sesión: ${params.meetingTitle}`;
  const contentHtml = `
    <p>Le informamos que se han actualizado los datos o la programación de la siguiente sesión:</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Sesión:</strong> ${escapeHtml(params.meetingTitle)}</p>
      ${params.newDateStr ? `<p style="margin: 0 0 8px 0;"><strong>Nueva Fecha y Hora:</strong> ${escapeHtml(params.newDateStr)}</p>` : ''}
      <p style="margin: 0;"><strong>Detalles del Cambio:</strong> ${escapeHtml(params.changeDetails)}</p>
    </div>
    <p>Por favor verifique la nueva programación en la plataforma.</p>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Actualización de Sesión Colegiada',
    recipientName: params.recipientName,
    badgeText: 'Aviso',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Ver Sesión Actualizada',
  });

  return { html, text, subject };
}

export function renderMeetingCancelEmail(params: {
  recipientName: string;
  meetingTitle: string;
  reason: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Cancelación de Sesión: ${params.meetingTitle}`;
  const contentHtml = `
    <p>Le comunicamos que la siguiente sesión colegiada ha sido <strong style="color: #dc2626;">CANCELADA</strong>:</p>
    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Sesión:</strong> ${escapeHtml(params.meetingTitle)}</p>
      <p style="margin: 0;"><strong>Motivo:</strong> ${escapeHtml(params.reason)}</p>
    </div>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Aviso de Cancelación de Sesión',
    recipientName: params.recipientName,
    badgeText: 'Cancelada',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Consultar Calendario Institucional',
  });

  return { html, text, subject };
}

export function renderAgreementNewEmail(params: {
  recipientName: string;
  agreementTitle: string;
  role: 'RESPONSABLE' | 'COLABORADOR';
  deadlineStr?: string;
  priority: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Nuevo Acuerdo Asignado: ${params.agreementTitle}`;
  const contentHtml = `
    <p>Se le ha asignado una responsabilidad institucional en el marco del siguiente acuerdo colegiado:</p>
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acuerdo:</strong> ${escapeHtml(params.agreementTitle)}</p>
      <p style="margin: 0 0 8px 0;"><strong>Rol Asignado:</strong> <span style="font-weight: 700; color: #166534;">${escapeHtml(params.role)}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>Prioridad:</strong> ${escapeHtml(params.priority)}</p>
      ${params.deadlineStr ? `<p style="margin: 0;"><strong>Fecha Límite:</strong> ${escapeHtml(params.deadlineStr)}</p>` : ''}
    </div>
    <p>Ingrese al módulo de acuerdos para registrar avances e hitos de cumplimiento.</p>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Asignación de Acuerdo Institucional',
    recipientName: params.recipientName,
    badgeText: 'Acuerdo',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Gestionar Acuerdo y Reportar Avances',
  });

  return { html, text, subject };
}

export function renderAgreementUpdateEmail(params: {
  recipientName: string;
  agreementTitle: string;
  changeSummary: string;
  status: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Actualización de Acuerdo: ${params.agreementTitle}`;
  const contentHtml = `
    <p>Se ha registrado una actualización en el acuerdo del cual forma parte:</p>
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acuerdo:</strong> ${escapeHtml(params.agreementTitle)}</p>
      <p style="margin: 0 0 8px 0;"><strong>Estado Actual:</strong> <span style="font-weight: 600;">${escapeHtml(params.status)}</span></p>
      <p style="margin: 0;"><strong>Resumen:</strong> ${escapeHtml(params.changeSummary)}</p>
    </div>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Seguimiento de Acuerdo Institucional',
    recipientName: params.recipientName,
    badgeText: 'Seguimiento',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Ver Detalle del Acuerdo',
  });

  return { html, text, subject };
}

export function renderMinutesPublishedEmail(params: {
  recipientName: string;
  meetingTitle: string;
  sessionDateStr: string;
  actionUrl: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] Acta Oficial Publicada: ${params.meetingTitle}`;
  const contentHtml = `
    <p>Ha sido aprobada y publicada formalmente el acta de la sesión correspondiente:</p>
    <div style="background-color: #faf5ff; border-left: 4px solid #9333ea; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Sesión:</strong> ${escapeHtml(params.meetingTitle)}</p>
      <p style="margin: 0;"><strong>Fecha de Sesión:</strong> ${escapeHtml(params.sessionDateStr)}</p>
    </div>
    <p>El documento oficial firmado se encuentra resguardado en la plataforma institucional para su consulta.</p>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: 'Publicación de Acta Institucional',
    recipientName: params.recipientName,
    badgeText: 'Acta Oficial',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Consultar Acta Oficial en Plataforma',
  });

  return { html, text, subject };
}

export function renderGeneralNotificationEmail(params: {
  recipientName: string;
  title: string;
  message: string;
  actionUrl?: string;
}): { html: string; text: string; subject: string } {
  const subject = `[MexAgenda] ${params.title}`;
  const contentHtml = `
    <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 14px 18px; border-radius: 4px; margin: 16px 0;">
      <p style="margin: 0; line-height: 1.6;">${escapeHtml(params.message)}</p>
    </div>
  `;

  const { html, text } = renderBaseEmailLayout({
    title: params.title,
    recipientName: params.recipientName,
    badgeText: 'Institucional',
    contentHtml,
    actionUrl: params.actionUrl,
    actionText: 'Acceder a MexAgenda',
  });

  return { html, text, subject };
}

