import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sanitizeFilename } from '@/lib/filename';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const { fileName, fileSize, pageCount } = await request.json();

    if (!fileName || !fileSize || !pageCount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerClient();
    const jobId = randomUUID();
    const sanitizedFilename = sanitizeFilename(fileName);
    const uploadPath = `jobs/${jobId}/${sanitizedFilename}`;

    // Generate signed upload URL (2 hours)
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('print-files')
      .createSignedUploadUrl(uploadPath);

    if (uploadError || !uploadData) {
      console.error('Failed to create signed upload URL:', uploadError);
      return NextResponse.json({ error: 'Storage error' }, { status: 500 });
    }

    // Insert DB record
    const { error: dbError } = await supabase
      .from('print_jobs')
      .insert({
        id: jobId,
        file_name: fileName,
        file_path: uploadPath,
        page_count: pageCount,
        payment_status: 'PENDING',
        job_status: 'QUEUED',
        total_price: 0,
        copies: 1, // Default value to satisfy NOT NULL constraints if any
        print_options: { orientation: 'portrait', colourMode: 'bw' } // Defaults
      });

    if (dbError) {
      console.error('Failed to insert print job:', dbError);
      // Attempt rollback deletion of the signed upload path
      await supabase.storage.from('print-files').remove([uploadPath]);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      jobId,
      uploadUrl: uploadData.signedUrl,
      uploadPath
    });
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
