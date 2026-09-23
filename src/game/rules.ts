import type { Rule, RuleVerdict } from './types';

export const RULES: readonly Rule[] = [
  { id: 'mars_event', label: 'Mention something that could reasonably happen on Mars.', evaluator: 'semantic', question: 'Does the response mention something that could reasonably happen on Mars?' },
  { id: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic', question: 'Does the response make an animal sound suspicious?' },
  { id: 'hopeful_no_promise', label: 'Sound hopeful without promising success.', evaluator: 'semantic', question: 'Does the response sound hopeful without promising success?' },
  { id: 'harmless_crime', label: 'Describe a harmless crime.', evaluator: 'semantic', question: 'Does the response describe a harmless crime?' },
  { id: 'implied_rain', label: 'Imply that it is raining without saying “rain.”', evaluator: 'semantic', question: 'Does the response imply rain without using the word rain?' },
  { id: 'tiny_disaster', label: 'Describe a disaster that would fit in a pocket.', evaluator: 'semantic', question: 'Does the response describe a disaster small enough to fit in a pocket?' },
  { id: 'bad_advice', label: 'Give advice that is clearly a bad idea.', evaluator: 'semantic', question: 'Does the response give advice that is clearly a bad idea?' },
  { id: 'awkward_apology', label: 'Apologize without using “sorry.”', evaluator: 'semantic', question: 'Does the response function as an apology without using the word sorry?' },
  { id: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic' },
  { id: 'no_e', label: 'Do not use the letter E.', evaluator: 'deterministic' },
  { id: 'question_end', label: 'End with a question mark.', evaluator: 'deterministic' },
  { id: 'include_number', label: 'Include a number.', evaluator: 'deterministic' }
] as const;

export function evaluateDeterministicRule(ruleId: string, text: string): RuleVerdict {
  const rule = RULES.find(candidate => candidate.id === ruleId);
  if (!rule || rule.evaluator !== 'deterministic') {
    throw new Error(`Not a deterministic rule: ${ruleId}`);
  }

  let passed: boolean;
  let detail: string;
  switch (ruleId) {
    case 'six_words': {
      const count = text.trim() ? text.trim().split(/\s+/u).length : 0;
      passed = count === 6;
      detail = `${count} of 6 words`;
      break;
    }
    case 'no_e':
      passed = !/e/iu.test(text);
      detail = passed ? 'No E found' : 'Contains the letter E';
      break;
    case 'question_end':
      passed = text.trimEnd().endsWith('?');
      detail = passed ? 'Ends with ?' : 'Does not end with ?';
      break;
    case 'include_number':
      passed = /\p{N}/u.test(text);
      detail = passed ? 'Contains a number' : 'No number found';
      break;
    default:
      throw new Error(`Unknown deterministic rule: ${ruleId}`);
  }

  return { ruleId, label: rule.label, evaluator: 'deterministic', passed, detail };
}
