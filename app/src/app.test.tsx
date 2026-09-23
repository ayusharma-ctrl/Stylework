import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
describe('application foundation', () => { it('has a named workspace', () => { render(<App />); expect(screen.getByRole('heading', { name: 'Stylework' })).toBeInTheDocument(); }); });
