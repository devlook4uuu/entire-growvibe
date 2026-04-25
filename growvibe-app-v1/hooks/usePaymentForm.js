import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { invalidatePaymentCache } from './usePaymentList';

export const PAYMENT_METHODS = [
  { key: 'cash',          label: 'Cash' },
  { key: 'bank_transfer', label: 'Bank Transfer' },
  { key: 'cheque',        label: 'Cheque' },
  { key: 'online',        label: 'Online' },
];

export const PAYMENT_STATUSES = [
  { key: 'paid',    label: 'Paid',    color: '#22C55E', bg: '#ECFDF5' },
  { key: 'partial', label: 'Partial', color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'unpaid',  label: 'Unpaid',  color: '#EF4444', bg: '#FEF2F2' },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePaymentForm(schoolId, paymentId) {
  const isEdit = !!paymentId;

  const [payment, setPayment]       = useState(null);
  const [fetching, setFetching]     = useState(isEdit);
  const [fetchError, setFetchError] = useState(null);

  // ── Load payment (edit only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setFetching(true);
      const { data, error } = await supabase
        .from('subscription_payments')
        .select(
          'id, school_id, payment_month, fee, amount_paid, remaining_due, ' +
          'payment_method, payment_status, payment_description'
        )
        .eq('id', paymentId)
        .single();

      if (cancelled) return;
      if (error || !data) setFetchError(error?.message || 'Payment not found.');
      else setPayment(data);
      setFetching(false);
    })();

    return () => { cancelled = true; };
  }, [paymentId, isEdit]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save(values) {
    const {
      payment_month, fee, amount_paid, remaining_due,
      payment_method, payment_status, payment_description,
    } = values;

    try {
      const record = {
        school_id:           schoolId,
        payment_month:       payment_month.trim(),
        fee:                 Number(fee) || 0,
        amount_paid:         Number(amount_paid) || 0,
        remaining_due:       Number(remaining_due) || 0,
        payment_method:      payment_method || null,
        payment_status,
        payment_description: payment_description?.trim() || null,
      };

      if (!isEdit) {
        const { error } = await supabase
          .from('subscription_payments')
          .insert(record);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('subscription_payments')
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq('id', paymentId);
        if (error) throw new Error(error.message);
      }

      invalidatePaymentCache(schoolId);
      return { success: true };

    } catch (err) {
      return { success: false, error: err.message || 'Failed to save. Please try again.' };
    }
  }

  return { isEdit, payment, fetching, fetchError, save };
}
