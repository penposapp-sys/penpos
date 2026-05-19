import nodemailer from 'nodemailer'
import { error } from './errors.js'
import { error as logError, info } from './logger.js'

let transporter = null

const toBool = (value, fallback = false) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

const getMailerConfig = () => ({
  host: String(process.env.SMTP_HOST || '').trim(),
  port: Number(process.env.SMTP_PORT || 587),
  secure: toBool(process.env.SMTP_SECURE, false),
  user: String(process.env.SMTP_USER || '').trim(),
  pass: String(process.env.SMTP_PASS || '').trim(),
  from: String(process.env.MAIL_FROM || '').trim(),
})

const ensureTransporter = () => {
  if (transporter) return transporter

  const cfg = getMailerConfig()
  if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass || !cfg.from) {
    throw error('mail_config_missing', 'Mail ayarları eksik. Lütfen SMTP bilgilerini kontrol edin.', 500)
  }

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  })

  return transporter
}

export const sendMail = async ({ to, subject, text, html }) => {
  try {
    const cfg = getMailerConfig()
    const tx = ensureTransporter()
    const result = await tx.sendMail({
      from: cfg.from,
      to,
      subject,
      text,
      html,
    })
    try {
      info('[MAIL_SENT]', { to, subject, messageId: result?.messageId || null })
    } catch {}
    return result
  } catch (err) {
    try {
      logError('[MAIL_SEND_ERROR]', { to, subject }, err?.stack || err)
    } catch {}
    if (err?.status) throw err
    throw error('mail_send_failed', 'Şifre sıfırlama e-postası gönderilemedi.', 500)
  }
}
