import { buildXIntent } from './share-on-x';

it('builds a semantic Jev result intent without response text', () => {
  expect(buildXIntent({
    score: 9,
    failedRule: { label: 'Sound hopeful without promising success.', evaluator: 'semantic' },
    siteUrl: 'https://rulesarelava.example'
  })).toBe(
    'https://x.com/intent/post?text=' + encodeURIComponent(
      'I survived 9 rounds of Rules Are Lava 🌋\n\nJev\'s ruling got me on: “Sound hopeful without promising success.”\nCan you beat 9?\n\nhttps://rulesarelava.example'
    )
  );
});

it('credits exact failures to the lava, not Jev', () => {
  const url = buildXIntent({
    score: 4,
    failedRule: { label: 'Use exactly six words.', evaluator: 'deterministic' },
    siteUrl: 'https://rulesarelava.example'
  });
  expect(decodeURIComponent(url)).toContain('The lava got me on: “Use exactly six words.”');
  expect(decodeURIComponent(url)).not.toContain("Jev's ruling");
});

it('handles a timeout without naming a rule', () => {
  const url = buildXIntent({ score: 9, failedRule: null, siteUrl: 'https://rulesarelava.example' });
  expect(decodeURIComponent(url)).toContain('The lava caught me at round 9.');
  expect(decodeURIComponent(url)).not.toContain('got me on');
});
