import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure Nodemailer using Gmail App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, clientId, executorId, jobId } = body;

    if (!projectId || !executorId || !clientId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch Project Details (We just need Customer Name & Address for the email text)
    const { data: project, error: projectError } = await supabaseAdmin
      .from('modular_projects')
      .select('customer_name, city, address')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new Error('Failed to fetch project details');

    // 2. Fetch Executor Details (To get Executor Email)
    const { data: executor, error: executorError } = await supabaseAdmin
      .from('executors')
      .select('full_name, email')
      .eq('id', executorId)
      .single();

    if (executorError || !executor) throw new Error('Failed to fetch executor details');

    // 3. Fetch Client/Dealer Details (To get Dealer Email)
    // ⚠️ IMPORTANT: If your dealer table is named differently (e.g., 'dealers' or 'users'), change 'clients' below!
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients') 
      .select('full_name, email')
      .eq('id', clientId)
      .single();

    if (clientError || !client) throw new Error('Failed to fetch client/dealer details');

    // 4. Prepare Email Content
    const emailPromises = [];

    // Send Email to the EXECUTOR
    if (executor.email) {
      emailPromises.push(
        transporter.sendMail({
          from: `"Modular Admin" <${process.env.EMAIL_USER}>`,
          to: executor.email,
          subject: `Action Required: Countertop Verified for Job ${jobId}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #8ED26B;">Countertop Installation Verified</h2>
              <p>Hi ${executor.full_name},</p>
              <p>The countertop for Job <strong>${jobId}</strong> has been verified by the Admin.</p>
              <p><strong>Customer:</strong> ${project.customer_name}<br/>
              <strong>Location:</strong> ${project.address}, ${project.city}</p>
              <p>Your carpenter application has now been unlocked for this project. You may proceed to complete the job and submit the final sign-off.</p>
              <br/>
              <p>Best Regards,<br/>Operations Team</p>
            </div>
          `,
        })
      );
    }

    // Send Email to the CLIENT (DEALER)
    if (client.email) {
      emailPromises.push(
        transporter.sendMail({
          from: `"Modular Interiors" <${process.env.EMAIL_USER}>`,
          to: client.email,
          subject: `Project Update: Countertop Completed for Job ${jobId}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #8ED26B;">Countertop Stage Completed</h2>
              <p>Hi ${client.full_name},</p>
              <p>This is an automated update regarding your customer <strong>${project.customer_name}</strong> (Job ID: ${jobId}).</p>
              <p>We have successfully verified and completed the countertop installation stage. Our execution team has been notified to proceed with the final finishing and project handover.</p>
              <br/>
              <p>Thank you for partnering with us,<br/>Modular Interiors Team</p>
            </div>
          `,
        })
      );
    }

    // 5. Execute all emails concurrently
    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, message: 'Emails sent to Client and Executor' }, { status: 200 });

  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}