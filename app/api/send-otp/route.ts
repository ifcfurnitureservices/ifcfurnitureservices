import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    // Configure your email server details here
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your email provider
      auth: {
        user: process.env.EMAIL_USER, // e.g., your company gmail address
        pass: process.env.EMAIL_APP_PASSWORD, // e.g., your Gmail App Password
      },
    });

    // The email content
    const mailOptions = {
      from: `"InstaFitCore Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Password Reset OTP - InstaFitCore',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-w: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #8ED26B;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password for your InstaFitCore Client Portal.</p>
          <p>Your 6-digit verification code is:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <strong style="font-size: 24px; letter-spacing: 5px; color: #1e293b;">${otp}</strong>
          </div>
          <p style="font-size: 12px; color: #64748b;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'OTP sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send OTP email' }, { status: 500 });
  }
}