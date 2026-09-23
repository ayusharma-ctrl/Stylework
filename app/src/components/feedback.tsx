import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';
import { ApiError } from '../lib/api';
export function Loading() {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
      <LoaderCircle size={20} className="animate-spin" />
      Loading your data…
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="shrink-0 text-destructive" />
        <div>
          <p className="font-medium">{error.message}</p>
          {error instanceof ApiError && error.requestId && (
            <p className="mt-1 break-all text-xs text-muted-foreground">Reference: {error.requestId}</p>
          )}
          {retry && (
            <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
export function Empty({
  title = 'No results found',
  description = 'Try another search or adjust your filters.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="rounded-2xl bg-muted p-4">
        <Inbox size={24} className="text-muted-foreground" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
