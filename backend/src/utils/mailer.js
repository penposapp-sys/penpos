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
  from: String(process.env.SMTP_FROM || process.env.MAIL_FROM || '').trim(),
})

const getMissingMailerConfigKeys = (cfg) => {
  const missing = []
  if (!cfg.host) missing.push('SMTP_HOST')
  if (!cfg.port) missing.push('SMTP_PORT')
  if (!cfg.user) missing.push('SMTP_USER')
  if (!cfg.pass) missing.push('SMTP_PASS')
  if (!cfg.from) missing.push('SMTP_FROM')
  return missing
}

const ensureTransporter = () => {
  if (transporter) return transporter

  const cfg = getMailerConfig()
  const missing = getMissingMailerConfigKeys(cfg)
  if (missing.length > 0) {
    const err = error('mail_config_missing', 'E-posta servisi yapılandırılmamış', 503)
    err.expose = true
    err.meta = { missing }
    throw err
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
      logError('[MAIL_SEND_ERROR]', {
        to,
        subject,
        code: String(err?.code || ''),
        responseCode: err?.responseCode ?? null,
        command: String(err?.command || ''),
        missing: Array.isArray(err?.meta?.missing) ? err.meta.missing : []
      }, err?.stack || err)
    } catch {}
    if (err?.status) throw err
    const sendErr = error('mail_send_failed', 'Şifre sıfırlama e-postası şu anda gönderilemiyor.', 503)
    sendErr.expose = true
    throw sendErr
  }
}
