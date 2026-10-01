import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    const { data: job, error: dbError } = await supabase
      .from('print_jobs')
      .select('file_path')
      .eq('id', jobId)
      .single();

    if (dbError || !job) {
      console.error('Failed to find job:', dbError);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { data, error: storageError } = await supabase
      .storage
      .from('print-files')
      .createSignedUrl(job.file_path, 3600); // 60 minutes expiry

    if (storageError || !data) {
      console.error('Failed to create signed URL:', storageError);
      return NextResponse.json({ error: 'Storage error' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
