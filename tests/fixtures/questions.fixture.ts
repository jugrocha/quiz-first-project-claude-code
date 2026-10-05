import type { Category, Level, Question } from '@/types/question';

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const CATEGORIES: Category[] = ['fundamentos', 'features', 'api-sdk', 'boas-praticas'];

/**
 * A larger synthetic pool (default: 20 questions per level, spread evenly
 * across the 4 categories), used only for draw-balance stress tests. The
 * real seed (src/data/questions.json) only has 6 per level, which isn't
 * enough headroom to meaningfully stress-test the category cap.
 */
export function buildQuestionPool(perLevel = 20): Question[] {
  const questions: Question[] = [];
  for (const level of LEVELS) {
    for (let i = 0; i < perLevel; i++) {
      const category = CATEGORIES[i % CATEGORIES.length];
      questions.push({
        id: `${level}-${category}-${i}`,
        level,
        category,
        statement: `Synthetic statement ${level} ${category} #${i}`,
        answer: i % 2 === 0,
        explanation: `Synthetic explanation ${level} ${category} #${i}`,
      });
    }
  }
  return questions;
}
