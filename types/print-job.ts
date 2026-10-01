export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
export type JobStatus = 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED';

export interface PrintJob {
  id: string;
  file_name: string;
  file_path: string;
  copies: number;
  print_options: {
    orientation: 'portrait' | 'landscape';
    colourMode: 'bw' | 'colour';
  };
  payment_status: PaymentStatus;
  job_status: JobStatus;
  error_message: string | null;
  created_at: string;
  printed_at: string | null;
  total_price: number;
  page_count: number;
  estimated_sheets_printed?: number;
  print_progress_known?: boolean;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  QUEUED:   'Waiting to print',
  PRINTING: 'Printing now',
  PRINTED:  'Ready for collection',
  FAILED:   'Print failed',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Awaiting payment',
  PAID:    'Payment confirmed',
  FAILED:  'Payment failed',
};
