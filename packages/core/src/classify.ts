import type { Category } from './types.ts';

/**
 * Keyword lists per category, including common Hinglish words. Used when no AI
 * key is configured, and as a sanity check on AI output.
 */
const KEYWORDS: Record<Exclude<Category, 'Other'>, string[]> = {
  AI: [
    'ai', 'a.i.', 'artificial intelligence', 'chatgpt', 'gpt', 'openai', 'gemini', 'claude', 'anthropic', 'llm', 'llms',
    'prompt', 'prompts', 'prompt engineering', 'midjourney', 'stable diffusion', 'copilot', 'perplexity', 'ai tool',
    'ai tools', 'ai agent', 'agents', 'agentic', 'machine learning', 'deep learning', 'neural', 'genai', 'generative',
    'hugging face', 'cursor', 'notebooklm', 'sora', 'deepseek', 'mistral', 'llama', 'automation with ai', 'rag',
  ],
  Food: [
    'food', 'recipe', 'cafe', 'café', 'restaurant', 'eat', 'eats', 'dish', 'cook', 'cooking', 'breakfast', 'lunch',
    'dinner', 'snack', 'dessert', 'biryani', 'paneer', 'chai', 'coffee', 'pizza', 'burger', 'momos', 'street food',
    'thali', 'khana', 'swad', 'tasty', 'foodie', 'bakery', 'protein bowl', 'ingredients', 'chef', 'kitchen', 'masala',
  ],
  Travel: [
    'travel', 'trip', 'itinerary', 'goa', 'manali', 'ladakh', 'kerala', 'rishikesh', 'himachal', 'beach', 'trek',
    'hotel', 'hostel', 'flight', 'visa', 'backpacking', 'weekend getaway', 'road trip', 'places to visit', 'ghumna',
    'mountains', 'resort', 'homestay', 'tour', 'sightseeing', 'airport', 'train', 'irctc',
  ],
  Tech: [
    'tech', 'code', 'coding', 'developer', 'programming', 'python', 'javascript',
    'react', 'api', 'github', 'app', 'software', 'startup', 'saas', 'laptop', 'iphone', 'android', 'gadget', 'tool',
    'automation', 'website', 'cloud', 'cybersecurity', 'linux', 'gadgets',
  ],
  Career: [
    'career', 'job', 'jobs', 'interview', 'resume', 'cv', 'linkedin', 'hiring', 'internship', 'placement', 'salary',
    'promotion', 'product manager', 'pm interview', 'consulting', 'case interview', 'networking', 'mba', 'framework',
    'leadership', 'manager', 'cover letter', 'referral', 'offer letter',
  ],
  Finance: [
    'finance', 'money', 'invest', 'investing', 'investment', 'sip', 'mutual fund', 'stock', 'stocks', 'share market',
    'nifty', 'sensex', 'tax', 'itr', 'credit card', 'loan', 'emi', 'budget', 'savings', 'fd', 'crypto', 'upi',
    'insurance', 'paisa', 'portfolio returns', 'gold',
  ],
  Fitness: [
    'fitness', 'workout', 'gym', 'exercise', 'yoga', 'run', 'running', 'cardio', 'abs', 'dumbbell', 'squat', 'pushup',
    'push-up', 'stretch', 'weight loss', 'fat loss', 'muscle', 'protein', 'calories', 'steps', 'pilates', 'hiit',
  ],
  Learning: [
    'learn', 'learning', 'course', 'tutorial', 'explained', 'how to', 'guide', 'study', 'exam', 'upsc', 'notes',
    'lecture', 'book', 'books', 'reading', 'english', 'language', 'tips', 'lesson', 'skill', 'masterclass', 'history',
  ],
  Shopping: [
    'buy', 'shopping', 'sale', 'deal', 'deals', 'discount', 'amazon', 'flipkart', 'myntra', 'meesho', 'review',
    'unboxing', 'haul', 'price', 'link in bio', 'shop', 'product', 'outfit', 'fashion', 'skincare', 'sneakers', 'coupon',
  ],
  Entertainment: [
    'movie', 'film', 'series', 'netflix', 'prime video', 'hotstar', 'song', 'music', 'meme', 'comedy', 'funny', 'trailer',
    'cricket', 'ipl', 'football', 'game', 'gaming', 'anime', 'concert', 'podcast', 'standup',
  ],
  Home: [
    'home', 'decor', 'interior', 'room', 'diy', 'plants', 'gardening', 'cleaning', 'organise', 'organize', 'hack',
    'furniture', 'balcony', 'kitchen hack', 'parenting', 'pets',
  ],
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERNS = Object.entries(KEYWORDS).map(([cat, words]) => ({
  cat: cat as Category,
  res: words.map((w) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(w)}(?:s|es)?(?=$|[^\\p{L}\\p{N}])`, 'iu')),
}));

export interface Classification {
  category: Category;
  confidence: number;
  scores: Partial<Record<Category, number>>;
}

/** Pick the most likely category for a piece of text. Hashtags count double. */
export function classify(text: string, hashtags: string[] = []): Classification {
  const body = ` ${text.toLowerCase()} `;
  const tags = ` ${hashtags.join(' ')} `;
  const scores: Partial<Record<Category, number>> = {};
  let best: Category = 'Other';
  let bestScore = 0;
  let total = 0;
  for (const { cat, res } of PATTERNS) {
    let s = 0;
    for (const re of res) {
      if (re.test(body)) s += 1;
      if (re.test(tags)) s += 2;
    }
    if (s > 0) {
      scores[cat] = s;
      total += s;
      if (s > bestScore) {
        bestScore = s;
        best = cat;
      }
    }
  }
  const confidence = total === 0 ? 0 : Math.min(0.9, (bestScore / total) * Math.min(1, bestScore / 3));
  return { category: best, confidence: Number(confidence.toFixed(2)), scores };
}
