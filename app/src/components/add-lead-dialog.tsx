import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, json, queryClient, ApiError } from '../lib/api';
import { Modal } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ErrorState } from './feedback';

type Receipt = {
  eventId: string;
  state: 'pending' | 'processed' | 'ignored' | 'failed';
  leadId: string | null;
  errorMessage?: string;
};
const empty = { fullName: '', email: '', phone: '', company: '', campaign: '' };
type Payload = {
  eventId: string;
  externalLeadId: string;
  version: number;
  occurredAt: string;
  data: Record<string, unknown>;
};
export function AddLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fields, setFields] = useState(empty),
    [validation, setValidation] = useState('');
  const [submitted, setSubmitted] = useState<Payload | null>(null);
  const [accepted, setAccepted] = useState<Receipt | null>(null);
  const [pollUntil, setPollUntil] = useState(0);
  const done = useRef<string | null>(null);
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (payload: Payload) =>
      api<Receipt>('/webhook/meta-lead', { method: 'POST', body: json(payload) }),
    onError: (error) => {
      if (error instanceof ApiError && [400, 413, 422].includes(error.status)) setSubmitted(null);
    },
    onSuccess: (receipt) => {
      setAccepted(receipt);
      setPollUntil(Date.now() + 30000);
    },
  });
  const outcome = useQuery({
    queryKey: ['manual-intake', accepted?.eventId],
    queryFn: ({ signal }) =>
      api<Receipt>('/webhook-events/' + encodeURIComponent(accepted!.eventId) + '?source=manual', { signal }),
    enabled: open && !!accepted,
    refetchInterval: (query) =>
      query.state.data?.state === 'pending' && Date.now() < pollUntil ? 1000 : false,
  });
  const receipt = outcome.data || accepted;
  useEffect(() => {
    if (
      !open ||
      !receipt?.leadId ||
      !['processed', 'ignored'].includes(receipt.state) ||
      done.current === receipt.eventId
    )
      return;
    done.current = receipt.eventId;
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
    void queryClient.invalidateQueries({ queryKey: ['activities'] });
    onOpenChange(false);
    navigate('/leads/' + receipt.leadId);
    setFields(empty);
    setSubmitted(null);
    setAccepted(null);
    mutation.reset();
  }, [open, receipt, onOpenChange, navigate]);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setValidation('');
    if (submitted) {
      mutation.mutate(submitted);
      return;
    }
    if (!fields.fullName.trim()) {
      setValidation('Enter a full name.');
      return;
    }
    if (!fields.email.trim() && !fields.phone.trim()) {
      setValidation('Enter an email address or phone number.');
      return;
    }
    if (fields.phone.trim() && !/^\+[1-9]\d{6,14}$/.test(fields.phone.trim())) {
      setValidation('Use a valid phone number, including country code.');
      return;
    }
    const payload = {
      eventId: crypto.randomUUID(),
      externalLeadId: crypto.randomUUID(),
      version: 1,
      occurredAt: new Date().toISOString(),
      data: {
        ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() || null])),
        metadata: {},
      },
    };
    setSubmitted(payload);
    mutation.mutate(payload);
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add lead"
      description="Enter a name and at least one contact method. Your lead will be added to the pipeline."
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={!!submitted} className="space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <Input
              className="mt-1"
              autoFocus
              required
              maxLength={160}
              value={fields.fullName}
              onChange={(e) => setFields({ ...fields, fullName: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Email
            <Input
              className="mt-1"
              type="email"
              maxLength={254}
              value={fields.email}
              onChange={(e) => setFields({ ...fields, email: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <Input
              className="mt-1"
              type="tel"
              placeholder="+919876543210"
              maxLength={32}
              value={fields.phone}
              onChange={(e) => setFields({ ...fields, phone: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Company
            <Input
              className="mt-1"
              maxLength={160}
              value={fields.company}
              onChange={(e) => setFields({ ...fields, company: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Campaign
            <Input
              className="mt-1"
              maxLength={160}
              value={fields.campaign}
              onChange={(e) => setFields({ ...fields, campaign: e.target.value })}
            />
          </label>
        </fieldset>
        {validation && (
          <p role="alert" className="text-sm text-destructive">
            {validation}
          </p>
        )}
        {mutation.error && <ErrorState error={mutation.error} />}
        {outcome.error && <ErrorState error={outcome.error} retry={() => void outcome.refetch()} />}
        {receipt?.state === 'pending' && (
          <p role="status" className="text-sm">
            Lead accepted and waiting to be processed. You can close this dialog and reopen it to check
            progress.
          </p>
        )}
        {receipt?.state === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            {receipt.errorMessage || 'Processing failed.'} Reference: {receipt.eventId}. Contact your
            administrator to replay this submission.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {accepted ? (
            <Button
              type="button"
              onClick={() => {
                setPollUntil(Date.now() + 30000);
                void outcome.refetch();
              }}
              disabled={outcome.isFetching}
            >
              Check progress
            </Button>
          ) : (
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding lead?' : submitted ? 'Retry submission' : 'Add lead'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
