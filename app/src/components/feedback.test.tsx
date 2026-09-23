import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Empty, ErrorState } from './feedback';
import { ApiError } from '../lib/api';
import { Modal } from './ui/dialog';
import { dateFilters } from './filters';
describe('recoverable interface states', () => {
  it('explains empty search results', () => {
    render(<Empty />);
    expect(screen.getByText('No results found')).toBeVisible();
    expect(screen.getByText(/adjust your filters/)).toBeVisible();
  });
  it('shows a trace reference and retries explicitly', async () => {
    const retry = vi.fn();
    render(<ErrorState error={new ApiError('Temporarily unavailable', 503, 'trace-123')} retry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('trace-123');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('closes an accessible dialog with Escape', async () => {
    const close = vi.fn();
    render(
      <Modal open onOpenChange={close} title="Archive status" description="History is preserved.">
        Content
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Archive status' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledWith(false);
  });
  it('uses inclusive reporting dates in Asia/Kolkata', () => {
    expect(dateFilters(new URLSearchParams('from=2026-09-01&to=2026-09-02'))).toEqual({
      createdFrom: '2026-08-31T18:30:00.000Z',
      createdTo: '2026-09-02T18:30:00.000Z',
    });
    expect(dateFilters(new URLSearchParams('from=bad'))).toEqual({});
  });
});
