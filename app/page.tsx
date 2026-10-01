'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import FileUploadZone from '@/components/FileUploadZone';

export default function UploadPage() {
  const router = useRouter();

  const handleSuccess = ({ jobId, pageCount }: { jobId: string; pageCount: number }) => {
    router.push(`/options?job_id=${encodeURIComponent(jobId)}&page_count=${pageCount}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator currentStep={1} />
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center">Print Your Document</h1>
        <p className="text-sm text-gray-600 text-center">
          Upload your PDF file to get started with fast A4 printing.
        </p>
        <FileUploadZone onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
