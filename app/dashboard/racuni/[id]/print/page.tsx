'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { getInvoice, type Invoice } from '../../../../../lib/api/client';

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace('/api/v1', '');
const LOGO_URL = `${BACKEND_URL}/uploads/logo/nesa-komerc-logo.svg`;

// Podaci firme — menjaj po potrebi
const COMPANY = {
  name: 'Neša Komerc D.O.O.',
  address: 'Stevana Sinđelića br. 309',
  city: '35210 Svilajnac',
  pib: '101477147',
  mb: '06341225',
  bank: 'Raiffeisen banka a.d. Beograd',
  account: '265-0000000000-00',
  phone: '+381 35 8814 077',
  email: 'office@nesa-komerc.com',
};

function fmt(n: number) {
  return new Intl.NumberFormat('sr-Latn-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  racun: 'RAČUN',
  predracun: 'PREDRAČUN',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nacrt', issued: 'Izdat', paid: 'Plaćen', cancelled: 'Otkazan',
};

export default function PrintInvoicePage() {
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600 text-sm">
        {error ?? 'Račun nije pronađen'}
      </div>
    );
  }

  const total = Number(invoice.totalAmount);
  const hasDiscount = invoice.items.some((i) => (i.discount ?? 0) > 0);

  return (
    <>
      {/* Toolbar — skriva se pri štampi */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Nazad
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium"
        >
          <Printer className="w-4 h-4" />
          Štampaj / Snimi PDF
        </button>
      </div>

      {/* Sadržaj — jedino ovo se štampa */}
      <div className="print:pt-0 pt-16 bg-white min-h-screen">
        <div
          className="mx-auto bg-white"
          style={{ maxWidth: '794px', padding: '32px 40px 48px', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111' }}
        >
          {/* Zaglavlje */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_URL} alt={COMPANY.name} style={{ height: '48px', marginBottom: '10px', display: 'block' }} />
              <div style={{ color: '#111', lineHeight: '1.6', fontSize: '10px' }}>
                <div>{COMPANY.address}</div>
                <div>{COMPANY.city}</div>
                <div>PIB: {COMPANY.pib} | MB: {COMPANY.mb}</div>
                <div>{COMPANY.phone}</div>
                <div>{COMPANY.email}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }}>
                {TYPE_LABEL[invoice.type] ?? invoice.type.toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111', marginTop: '3px' }}>
                {invoice.invoiceNumber}
              </div>
              <div style={{ marginTop: '8px', color: '#111', lineHeight: '1.6', fontSize: '10px' }}>
                <div>Datum izdavanja: <strong>{fmtDate(invoice.issueDate)}</strong></div>
                {invoice.dueDate && <div>Datum valute: <strong>{fmtDate(invoice.dueDate)}</strong></div>}
                <div>Status: <strong>{STATUS_LABEL[invoice.status] ?? invoice.status}</strong></div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid #111', marginBottom: '20px' }} />

          {/* Kupac */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#111', marginBottom: '6px' }}>
              Kupac
            </div>
            <div style={{ background: '#fff', border: '1px solid #111', borderRadius: '6px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '3px' }}>{invoice.clientName}</div>
              <div style={{ color: '#111', lineHeight: '1.6', fontSize: '10px' }}>
                {invoice.clientAddress && <div>{invoice.clientAddress}</div>}
                {(invoice.clientZip || invoice.clientCity) && <div>{[invoice.clientZip, invoice.clientCity].filter(Boolean).join(' ')}</div>}
                {invoice.clientPib && <div>PIB: {invoice.clientPib}</div>}
                {invoice.clientMb && <div>Matični broj: {invoice.clientMb}</div>}
                {invoice.clientEmail && <div>{invoice.clientEmail}</div>}
                {invoice.clientPhone && <div>{invoice.clientPhone}</div>}
              </div>
            </div>
          </div>

          {/* Tabela stavki */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderTop: '2px solid #111', borderBottom: '2px solid #111' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111' }}>Opis</th>
                <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111', width: '40px' }}>Jed.</th>
                <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111', width: '45px' }}>Kol.</th>
                <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111', width: '90px' }}>Cena</th>
                {hasDiscount && (
                  <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111', width: '50px' }}>Pop.%</th>
                )}
                <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#111', width: '90px' }}>Iznos</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => {
                const discountPct = item.discount ?? 0;
                const lineTotal = item.quantity * item.unitPrice * (1 - discountPct / 100);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '8px 10px', color: '#111' }}>{item.description}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#111' }}>{item.unit}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#111' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#111' }}>{fmt(item.unitPrice)}</td>
                    {hasDiscount && (
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: '#111' }}>
                        {discountPct > 0 ? `${discountPct}%` : '—'}
                      </td>
                    )}
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#111' }}>{fmt(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Rekapitulacija */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
            <div style={{ width: '240px', border: '2px solid #111', borderRadius: '5px', padding: '9px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '12px', color: '#111' }}>ZA UPLATU:</span>
              <span style={{ fontWeight: 700, fontSize: '12px', color: '#111' }}>{fmt(total)} RSD</span>
            </div>
          </div>

          {/* Napomena */}
          {invoice.notes && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#111', marginBottom: '5px' }}>
                Napomena
              </div>
              <div style={{ color: '#111', lineHeight: '1.6', fontSize: '10px' }}>{invoice.notes}</div>
            </div>
          )}

          {/* Podnožje */}
          <hr style={{ border: 'none', borderTop: '1px solid #111', margin: '24px 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#111', fontSize: '9px' }}>
            <span>{COMPANY.name} | PIB: {COMPANY.pib} | MB: {COMPANY.mb}</span>
            <span>{invoice.invoiceNumber}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          @page { margin: 0; size: A4; }
        }
      `}</style>
    </>
  );
}
