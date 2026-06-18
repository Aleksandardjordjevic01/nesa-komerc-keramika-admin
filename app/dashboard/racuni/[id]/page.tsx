'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '../../../../components/layout/dashboard-layout';
import { getInvoice, type Invoice } from '../../../../lib/api/client';
import InvoiceForm from '../_components/invoice-form';

export default function EditRacunPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then(setInvoice)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-destructive text-sm">
          {error ?? 'Račun nije pronađen'}
        </div>
      </DashboardLayout>
    );
  }

  return <InvoiceForm initial={invoice} />;
}
