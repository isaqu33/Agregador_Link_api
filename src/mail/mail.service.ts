import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Sends mail through SMTP (SMTP_HOST/PORT/USER/PASS, MAIL_FROM). Without SMTP_HOST
// (local dev) the message is only logged, so the link can be copied from the API logs.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: nodemailer.Transporter;
  private readonly from: string;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'FaceLink <no-reply@facelink.local>';

    if (host) {
      const port = Number(this.config.get('SMTP_PORT') ?? 587);
      const user = this.config.get<string>('SMTP_USER');
      this.transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user
          ? { user, pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
    }
  }

  get appUrl() {
    return (
      this.config.get<string>('APP_URL') ?? 'http://localhost:3071'
    ).replace(/\/$/, '');
  }

  async send(to: string, subject: string, text: string, html: string) {
    if (!this.transport) {
      this.logger.warn(
        `SMTP não configurado. E-mail para ${to}\n${subject}\n${text}`,
      );
      return;
    }
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      // never break sign-up or recovery because the mail server is down
      this.logger.error(
        `Falha ao enviar e-mail para ${to}: ${(error as Error).message}`,
      );
    }
  }

  sendVerification(to: string, name: string, token: string) {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    return this.send(
      to,
      'Confirme seu e-mail no FaceLink',
      `Olá, ${name}! Confirme seu e-mail: ${link}`,
      this.layout(
        `Olá, ${escapeHtml(name)}!`,
        'Confirme seu e-mail para ativar sua conta.',
        'Confirmar e-mail',
        link,
      ),
    );
  }

  sendPasswordReset(to: string, name: string, token: string) {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    return this.send(
      to,
      'Redefinir sua senha no FaceLink',
      `Olá, ${name}! Para criar uma nova senha acesse (vale por 1 hora): ${link}\nSe não foi você, ignore este e-mail.`,
      this.layout(
        `Olá, ${escapeHtml(name)}!`,
        'Recebemos um pedido para redefinir sua senha. O link vale por 1 hora. Se não foi você, ignore este e-mail.',
        'Criar nova senha',
        link,
      ),
    );
  }

  private layout(title: string, body: string, cta: string, link: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
<h2 style="color:#4c1d95">${title}</h2><p>${body}</p>
<p><a href="${link}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${cta}</a></p>
<p style="color:#6b7280;font-size:12px">Ou copie este endereço: ${link}</p></div>`;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
