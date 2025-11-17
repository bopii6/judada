import nodemailer from 'nodemailer';
import { getEnv } from '../config/env';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter() {
    if (!this.transporter) {
      const env = getEnv();

      // 如果没有配置SMTP，使用Gmail作为默认
      const smtpHost = env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = env.SMTP_PORT || 587;
      const smtpUser = env.SMTP_USER;
      const smtpPass = env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        console.warn('邮件服务未配置，请设置SMTP_USER和SMTP_PASS环境变量');
        return null;
      }

      // nodemailer API: use createTransport (not createTransporter)
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }
    return this.transporter;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) {
        return false;
      }

      const env = getEnv();
      const mailOptions = {
        from: options.from || env.EMAIL_FROM || env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      };

      await transporter.sendMail(mailOptions);
      console.log(`邮件已发送至: ${options.to}`);
      return true;
    } catch (error) {
      console.error('邮件发送失败:', error);
      return false;
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    const subject = 'Jude English Lab - 登录验证码';
    const text = `您的验证码是：${code}\n\n验证码5分钟内有效，请尽快使用。\n\n如果这不是您本人的操作，请忽略此邮件。`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af; text-align: center;">Jude English Lab</h2>
        <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #334155; margin-bottom: 20px;">登录验证码</h3>
          <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 5px;">${code}</span>
          </div>
          <p style="color: #64748b; margin: 20px 0;">验证码5分钟内有效，请尽快使用</p>
        </div>
        <div style="text-align: center; color: #94a3b8; font-size: 14px;">
          <p>如果这不是您本人的操作，请忽略此邮件</p>
          <p>© 2024 Jude English Lab</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
