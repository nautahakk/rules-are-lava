import { render, screen } from '@testing-library/react';
import { Leaderboard } from './leaderboard';

const top = Array.from({ length: 10 }, (_, index) => ({
  rank: index < 2 ? 1 : index,
  critterName: index === 0 ? 'Binary Badger' : `Critter ${index + 1}`,
  score: index < 2 ? 14 : 14 - index,
  isPlayer: false
}));

it('shows ten daily rows, shared ranks, and an outside player row', () => {
  render(<Leaderboard
    top={top}
    player={{ rank: 27, critterName: 'Pixel Panda', score: 3, isPlayer: true }}
    resetAt="2099-09-24T00:00:00.000Z"
  />);

  expect(screen.getAllByRole('listitem')).toHaveLength(11);
  expect(screen.getByText('Binary Badger').closest('li')).toHaveTextContent('1');
  expect(screen.getByText('Critter 2').closest('li')).toHaveTextContent('1');
  expect(screen.getByText('Pixel Panda').closest('li')).toHaveTextContent('27');
  expect(screen.getByText('Your best')).toBeInTheDocument();
});

it('does not duplicate the player when already in the top ten', () => {
  const represented = [{ ...top[0], isPlayer: true }, ...top.slice(1)];
  render(<Leaderboard
    top={represented}
    player={{ ...represented[0], isPlayer: true }}
    resetAt="2099-09-24T00:00:00.000Z"
  />);
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
  expect(screen.queryByText('Your best')).not.toBeInTheDocument();
});
