import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_APP_PASSWORD 
      },
    });

    const { projectId } = await req.json();

    const { data: project, error: projError } = await supabaseAdmin
      .from('modular_projects')
      .select('job_id, customer_name, client_id')
      .eq('id', projectId)
      .single();
      
    if (projError || !project) throw new Error("Project missing");

    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('full_name, email')
      .eq('id', project.client_id)
      .single();

    const emailPromises = [];
    const ADMIN_EMAIL = process.env.EMAIL_USER;

    // Send to Admin
    if (ADMIN_EMAIL) {
      emailPromises.push(transporter.sendMail({
        from: `"Modular Execution" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAIL,
        subject: `Project Ready for Final Closure - Job ${project.job_id}`,
        html: `<p>Job <strong>${project.job_id}</strong> (${project.customer_name}) has received final sign-offs from the execution team. Please review and close the project.</p>`
      }));
    }

    // Send to Client
    if (client?.email) {
      emailPromises.push(transporter.sendMail({
        from: `"Modular Execution" <${process.env.EMAIL_USER}>`,
        to: client.email,
        subject: `Project Completed - Job ${project.job_id}`,
        html: `<p>Hi ${client.full_name},</p><p>We are thrilled to inform you that the installation for your customer <strong>${project.customer_name}</strong> (Job ${project.job_id}) is completed and fully signed off!</p>`
      }));
    }

    await Promise.all(emailPromises);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Error:", err.message);
    return NextResponse.json({ error: 'Failed', details: err.message }, { status: 500 });
  }
}