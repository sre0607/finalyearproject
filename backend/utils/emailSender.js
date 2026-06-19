/*
 * EmailSender.js - Nodemailer Email Service Helper
 * Purpose: Connects standard SMTP mail transporters to dispatch order confirmations or reset passwords alerts.
 */

const nodemailer = require('nodemailer');

/**
 * Dispatches a customizable email using configured SMTP hosts
 * @param {object} options - Mail options (to, subject, html body)
 */
const sendEmail = async (options) => {
  const host = process.env.MAIL_HOST;
  const port = process.env.MAIL_PORT || 587;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  const isConfigured = host && port && user && pass && user !== 'your_email@gmail.com';

  if (!isConfigured && process.env.NODE_ENV !== 'test') {
    console.warn('\n[WARNING] SMTP Email service is not configured. Please define MAIL_HOST, MAIL_PORT, MAIL_USER, and MAIL_PASS in .env.\n');
    throw new Error('Email service is not configured. Forgot password reset link cannot be sent.');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: {
      user: user || process.env.EMAIL_USERNAME || 'your_email@gmail.com',
      pass: pass || process.env.EMAIL_PASSWORD || 'your_email_app_password'
    },
    connectionTimeout: 3000,
    socketTimeout: 3000,
    greetingTimeout: 3000
  });

  // Build standard message envelope
  const message = {
    from: `${process.env.EMAIL_FROM || 'noreply@florish.com'} <${process.env.EMAIL_FROM || 'noreply@florish.com'}>`,
    to: options.email,
    subject: options.subject,
    html: options.html || options.message
  };

  try {
    const info = await transporter.sendMail(message);
    console.log(`Email dispatched successfully to ${options.email}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Email Dispatch Error to ${options.email}:`, error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = sendEmail;
