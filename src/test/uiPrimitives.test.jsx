import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Badge, Input } from '../components/ui';

describe('UI Primitives (Design System & AGENTS.md compliance)', () => {
  describe('Button component', () => {
    it('renders with children and handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Acción</Button>);

      const btn = screen.getByRole('button', { name: /acción/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with primary variant and sm size defaults', () => {
      render(<Button variant="primary">Guardar</Button>);
      const btn = screen.getByRole('button', { name: /guardar/i });
      // AGENTS.md: rounded-xl, h-8 (size sm)
      expect(btn.className).toContain('rounded-xl');
      expect(btn.className).toContain('h-8');
      expect(btn.className).toContain('border-amber-500/40');
    });

    it('respects disabled state and loading state', () => {
      const handleClick = vi.fn();
      const { rerender } = render(
        <Button disabled onClick={handleClick}>
          Inactivo
        </Button>
      );

      const btn = screen.getByRole('button', { name: /inactivo/i });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();

      rerender(<Button loading>Cargando</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Badge component', () => {
    it('renders text with tabular-nums and variant classes', () => {
      render(<Badge variant="success">Completado</Badge>);
      const badge = screen.getByText(/completado/i);
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('rounded-md');
      expect(badge.className).toContain('tabular-nums');
      expect(badge.className).toContain('border-emerald-500/30');
    });

    it('renders status dot when dot prop is passed', () => {
      const { container } = render(
        <Badge variant="danger" dot>
          Alerta
        </Badge>
      );
      const dot = container.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
      expect(dot.className).toContain('bg-rose-400');
    });
  });

  describe('Input component', () => {
    it('renders input with default rounded-xl and h-8 according to standards', () => {
      render(<Input placeholder="Buscar contraparte..." />);
      const input = screen.getByPlaceholderText('Buscar contraparte...');
      expect(input).toBeInTheDocument();
      expect(input.className).toContain('rounded-xl');
      expect(input.className).toContain('h-8');
      expect(input.className).toContain('bg-slate-900/80');
    });

    it('handles onChange typing events correctly', () => {
      const handleChange = vi.fn();
      render(<Input placeholder="Monto" onChange={handleChange} />);
      const input = screen.getByPlaceholderText('Monto');

      fireEvent.change(input, { target: { value: '500.50' } });
      expect(handleChange).toHaveBeenCalled();
      expect(input.value).toBe('500.50');
    });

    it('displays error styling when error is true', () => {
      render(<Input error placeholder="Con error" />);
      const input = screen.getByPlaceholderText('Con error');
      expect(input.className).toContain('border-rose-500');
    });
  });
});
