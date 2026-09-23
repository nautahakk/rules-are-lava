type FailedRule = { label: string; evaluator: 'deterministic' | 'semantic' } | null;

export function buildXIntent({ score, failedRule, siteUrl }: {
  score: number;
  failedRule: FailedRule;
  siteUrl: string;
}): string {
  const ruling = !failedRule
    ? `The lava caught me at round ${score}.`
    : failedRule.evaluator === 'semantic'
      ? `Jev's ruling got me on: “${failedRule.label}”`
      : `The lava got me on: “${failedRule.label}”`;
  const text = `I survived ${score} rounds of Rules Are Lava 🌋\n\n${ruling}\nCan you beat ${score}?\n\n${siteUrl}`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export function ShareOnX({ score, failedRule, siteUrl }: {
  score: number;
  failedRule: FailedRule;
  siteUrl: string;
}) {
  return <a className="button button-secondary" href={buildXIntent({ score, failedRule, siteUrl })} target="_blank" rel="noopener noreferrer">Share on X</a>;
}
