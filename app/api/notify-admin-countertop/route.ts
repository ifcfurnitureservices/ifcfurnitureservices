import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Prevents Next.js from evaluating this route during static build collection
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    
    // Your existing route logic for notify-countertop goes here...

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in notify-countertop:", err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}