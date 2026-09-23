import { render, screen } from '@testing-library/react';
import Page from './page';

it('introduces the Jev-refereed game', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Rules Are Lava' })).toBeInTheDocument();
  expect(screen.getByText('A survival writing game refereed by Jev.')).toBeInTheDocument();
});
