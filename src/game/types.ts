export type EvaluatorKind = 'deterministic' | 'semantic';
export type RunStatus = 'active' | 'completed';

export type Rule = {
  id: string;
  label: string;
  evaluator: EvaluatorKind;
  question?: string;
};

export type RuleVerdict = {
  ruleId: string;
  label: string;
  evaluator: EvaluatorKind;
  passed: boolean;
  probability?: number;
  detail?: string;
};

export type RunState = {
  roundIndex: number;
  lives: number;
  score: number;
  status: RunStatus;
};
