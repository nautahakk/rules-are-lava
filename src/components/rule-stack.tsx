import type { Rule, RuleVerdict } from '@/game/types';

export function RuleStack({ rules }: { rules: Array<Pick<Rule, 'id' | 'label' | 'evaluator'>> }) {
  return (
    <ol className="rule-stack" aria-label="Active rules">
      {rules.slice(-4).map((rule, index) => (
        <li className="rule-card" key={rule.id}>
          <span className="rule-index">R{index + 1}</span>
          <span>{rule.label}</span>
          <span className="rule-kind">{rule.evaluator === 'semantic' ? 'Jev' : 'Exact'}</span>
        </li>
      ))}
    </ol>
  );
}

export function VerdictList({ verdicts }: { verdicts: RuleVerdict[] }) {
  return (
    <ul className="verdict-list" aria-label="Round verdicts">
      {verdicts.map(verdict => (
        <li className={verdict.passed ? 'verdict verdict-pass' : 'verdict verdict-fail'} key={verdict.ruleId}>
          <span aria-hidden="true">{verdict.passed ? '✓' : '×'}</span>
          <div>
            <strong>
              {verdict.passed ? 'Pass' : 'Fail'}
              {verdict.evaluator === 'semantic' && verdict.probability !== undefined
                ? ` · ${Math.round(verdict.probability * 100)}%`
                : ''}
            </strong>
            <span>{verdict.label}</span>
            {verdict.evaluator === 'deterministic' && verdict.detail ? <small>{verdict.detail}</small> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
