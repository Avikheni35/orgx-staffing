import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transportConfig = env.SMTP_HOST
  ? {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    }
  : { streamTransport: true, newline: 'unix' as const };

const transporter = nodemailer.createTransport(transportConfig);

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  if (!env.SMTP_HOST) {
    const urlMatch = opts.html.match(/href="([^"]+)"/);
    const url = urlMatch ? urlMatch[1] : '(no link found)';
    console.log('\n─────────────────────────────────────────');
    console.log(`[EMAIL DEV] To:      ${opts.to}`);
    console.log(`[EMAIL DEV] Subject: ${opts.subject}`);
    console.log('[EMAIL DEV] Link:');
    console.log(url);
    console.log('─────────────────────────────────────────\n');
    return;
  }
  await transporter.sendMail({ from: env.EMAIL_FROM, ...opts });
}

export function passwordResetHtml(resetUrl: string, lang: 'de' | 'en'): string {
  return lang === 'de'
    ? `<h2>Passwort zurücksetzen</h2>
       <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen. Der Link ist 30 Minuten gültig.</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>`
    : `<h2>Reset your password</h2>
       <p>Click the link below to reset your password. The link expires in 30 minutes.</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>If you didn't request this, ignore this email.</p>`;
}

export function magicLinkHtml(magicUrl: string, lang: 'de' | 'en'): string {
  return lang === 'de'
    ? `<h2>Ihr Anmelde-Link</h2>
       <p>Klicken Sie auf den folgenden Link, um sich anzumelden. Der Link ist 1 Stunde gültig.</p>
       <p><a href="${magicUrl}">${magicUrl}</a></p>`
    : `<h2>Your login link</h2>
       <p>Click the link below to sign in. The link expires in 1 hour.</p>
       <p><a href="${magicUrl}">${magicUrl}</a></p>`;
}

export function otpHtml(otp: string, lang: 'de' | 'en'): string {
  return lang === 'de'
    ? `<h2>Ihr Anmeldecode</h2>
       <p>Ihr Einmalpasswort lautet:</p>
       <h1 style="letter-spacing:8px;font-size:36px;">${otp}</h1>
       <p>Der Code ist <strong>10 Minuten</strong> gültig. Geben Sie ihn nicht weiter.</p>`
    : `<h2>Your login code</h2>
       <p>Your one-time password is:</p>
       <h1 style="letter-spacing:8px;font-size:36px;">${otp}</h1>
       <p>This code is valid for <strong>10 minutes</strong>. Do not share it.</p>`;
}

export function workerInviteHtml(
  activateUrl: string,
  workerFirstName: string,
  invitedByName: string,
  lang: 'de' | 'en'
): string {
  return lang === 'de'
    ? `<h2>Willkommen, ${workerFirstName}!</h2>
       <p>${invitedByName} hat Sie zum Mitarbeiterportal eingeladen.</p>
       <p>Klicken Sie auf den folgenden Link, um Ihr Konto zu aktivieren. Der Link ist 72 Stunden gültig.</p>
       <p><a href="${activateUrl}">Konto aktivieren</a></p>`
    : `<h2>Welcome, ${workerFirstName}!</h2>
       <p>${invitedByName} has invited you to the worker portal.</p>
       <p>Click the link below to activate your account. The link expires in 72 hours.</p>
       <p><a href="${activateUrl}">Activate account</a></p>`;
}

export function generateContractHtml(params: {
  workerName: string;
  agencyName: string;
  businessName: string;
  shiftTitle: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  payRatePerHour: number;
}): string {
  const fmt = (d: Date) =>
    d.toLocaleString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  const netHours = (
    (params.endTime.getTime() - params.startTime.getTime()) / 3_600_000 -
    params.breakMinutes / 60
  ).toFixed(2);
  const grossPay = (parseFloat(netHours) * params.payRatePerHour).toFixed(2);

  return `
<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#333;">
  <h1 style="border-bottom:2px solid #1976d2;padding-bottom:12px;color:#1976d2;">Arbeitnehmerüberlassungsvertrag (AÜV)</h1>
  <h2 style="color:#555;">Arbeitsvertrag / Einsatzauftrag</h2>

  <table style="width:100%;margin:24px 0;border-collapse:collapse;">
    <tr><td style="padding:8px;width:220px;color:#666;font-weight:bold;">Verleiher (Agentur)</td><td style="padding:8px;">${params.agencyName}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Entleiher (Kundenunternehmen)</td><td style="padding:8px;">${params.businessName}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Arbeitnehmer</td><td style="padding:8px;">${params.workerName}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Tätigkeit / Position</td><td style="padding:8px;">${params.shiftTitle}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Einsatzbeginn</td><td style="padding:8px;">${fmt(params.startTime)}</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Einsatzende</td><td style="padding:8px;">${fmt(params.endTime)}</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Pause</td><td style="padding:8px;">${params.breakMinutes} Minuten</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Nettostunden</td><td style="padding:8px;">${netHours} Stunden</td></tr>
    <tr><td style="padding:8px;color:#666;font-weight:bold;">Stundenlohn (brutto)</td><td style="padding:8px;">${params.payRatePerHour.toFixed(2)} €/h</td></tr>
    <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;font-weight:bold;">Gesamtvergütung (brutto)</td><td style="padding:8px;font-weight:bold;">${grossPay} €</td></tr>
  </table>

  <h3>Vertragsbedingungen</h3>
  <ol style="line-height:1.8;">
    <li>Der Verleiher stellt dem Entleiher den oben genannten Arbeitnehmer für den vereinbarten Einsatzzeitraum zur Verfügung.</li>
    <li>Der Einsatz erfolgt gemäß den Bestimmungen des Arbeitnehmerüberlassungsgesetzes (AÜG) in der jeweils gültigen Fassung.</li>
    <li>Die Vergütung entspricht mindestens dem gesetzlichen Mindestlohn gemäß MiLoG.</li>
    <li>Arbeitszeiten werden gemäß ArbZG eingehalten. Die gesetzliche Mindestruhezeit von 11 Stunden zwischen zwei Einsätzen wird gewährleistet.</li>
    <li>Der Arbeitnehmer verpflichtet sich, die vereinbarte Tätigkeit pünktlich und gewissenhaft auszuführen.</li>
    <li>Krankheit oder Verhinderung ist unverzüglich dem Verleiher mitzuteilen.</li>
    <li>Die Verarbeitung personenbezogener Daten erfolgt gemäß DSGVO und der Datenschutzerklärung des Verleihers.</li>
  </ol>

  <p style="margin-top:32px;color:#666;font-size:13px;">
    Durch die digitale Unterzeichnung bestätigt der Arbeitnehmer, diesen Vertrag gelesen und akzeptiert zu haben.
    Die digitale Signatur ist gemäß eIDAS-Verordnung (einfache elektronische Signatur) rechtsgültig.
  </p>
</div>`;
}

export function contractEmailHtml(params: {
  workerName: string;
  agencyName: string;
  shiftTitle: string;
  startTime: Date;
  portalUrl: string;
}): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <h2 style="color:#1976d2;">Ihr Arbeitsvertrag ist zur Unterschrift bereit</h2>
  <p>Hallo ${params.workerName},</p>
  <p>
    <strong>${params.agencyName}</strong> hat Ihre Bewerbung für den Einsatz
    <strong>„${params.shiftTitle}"</strong> am <strong>${fmt(params.startTime)}</strong> genehmigt.
  </p>
  <p>
    Bitte unterzeichnen Sie den Vertrag digital, um Ihre Teilnahme zu bestätigen.
    Der Vertrag kann in Ihrem Mitarbeiterportal eingesehen und unterzeichnet werden.
  </p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${params.portalUrl}"
       style="background:#1976d2;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;">
      Vertrag jetzt unterzeichnen
    </a>
  </p>
  <p style="color:#888;font-size:13px;">
    Falls Sie Fragen haben, wenden Sie sich bitte an Ihre Agentur.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#aaa;font-size:12px;">
    Diese E-Mail wurde automatisch von ${params.agencyName} versendet.
  </p>
</div>`;
}

export function inviteHtml(inviteUrl: string, agencyName: string, lang: 'de' | 'en'): string {
  return lang === 'de'
    ? `<h2>Einladung zu ${agencyName}</h2>
       <p>Sie wurden eingeladen, dem Portal von ${agencyName} beizutreten.</p>
       <p><a href="${inviteUrl}">Konto einrichten</a></p>`
    : `<h2>Invitation to ${agencyName}</h2>
       <p>You've been invited to join ${agencyName}'s portal.</p>
       <p><a href="${inviteUrl}">Set up your account</a></p>`;
}
