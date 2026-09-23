import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Signin from './pages/signin';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
describe('sign in', () => {
  it('provides accessible email-only entry', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Signin />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('type', 'email');
    expect(screen.getByRole('button', { name: /Continue to workspace/ })).toBeEnabled();
    expect(screen.getByText(/no password or email verification/)).toBeInTheDocument();
  });
});
