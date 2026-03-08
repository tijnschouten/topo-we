import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('App flow', () => {
  it('toont feedback na kaartklik en gaat door naar volgende vraag', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Start oefenen' }));

    expect(screen.getByText('Zoek op kaart')).toBeInTheDocument();
    const mapTarget = container.querySelector('[data-target-id="plaats-dublin"]');
    if (!mapTarget) throw new Error('Kaarttarget niet gevonden');

    fireEvent.keyDown(mapTarget, { key: 'Enter' });
    const nextButton = screen.getByRole('button', { name: /Volgende vraag|Bekijk eindscore/i });
    expect(nextButton).toBeInTheDocument();

    await user.click(nextButton);
    expect(screen.queryByRole('button', { name: /Volgende vraag|Bekijk eindscore/i })).not.toBeInTheDocument();
    expect(screen.getByText('Zoek op kaart')).toBeInTheDocument();
  });

  it('ondersteunt meerkeuze modus', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Wat is dit? (meerkeuze)'));
    await user.click(screen.getByRole('button', { name: 'Start oefenen' }));

    expect(screen.getByText('Wat is dit?')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\d\./ })).not.toHaveLength(0);
  });
});
