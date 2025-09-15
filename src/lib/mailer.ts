// src/lib/mailer.ts
import { Resend } from "resend";
import nodemailer from "nodemailer";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

type Mail = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export function getTransport() {
  if (RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY);
    return {
      async sendMail(msg: Mail) {
        console.log("[mailer] using Resend", { to: msg.to, subject: msg.subject });
        const r = await resend.emails.send({
          from: msg.from,
          to: Array.isArray(msg.to) ? msg.to : [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });
        if ((r as any)?.error) throw new Error((r as any).error.message || "Resend error");
        return r;
      },
    };
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return {
      async sendMail(msg: Mail) {
        console.log("[mailer] using SMTP", { to: msg.to, subject: msg.subject });
        return transporter.sendMail(msg);
      },
    };
  }

  throw new Error("No mail transport configured (set RESEND_API_KEY or SMTP_* envs).");
}
