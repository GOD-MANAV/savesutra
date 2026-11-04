import type { Analysis, SaveItem } from './types.ts';
import { detectPlatform } from './url.ts';

/**
 * Sample library shown in demo mode (the web demo and a fresh install), so a
 * reviewer can try every view without an account or an API key. All creators,
 * handles and IDs are invented.
 */
interface Seed {
  url: string;
  author: string;
  duration?: number;
  daysAgo: number;
  note?: string;
  progress?: SaveItem['progress'];
  pinned?: boolean;
  /** Days ago the link was first shared (imported from an old chat). */
  sharedDaysAgo?: number;
  channel?: SaveItem['channel'];
  a: Omit<Analysis, 'engine' | 'confidence'> & { confidence?: number };
}

const SEEDS: Seed[] = [
  {
    url: 'https://www.instagram.com/reel/DemoAITools7/',
    author: 'ai.with.isha',
    duration: 61,
    daysAgo: 0,
    progress: 'todo',
    pinned: true,
    a: {
      title: '7 new AI tools worth trying this week',
      summary:
        'A quick roundup of seven AI tools: a research assistant, a slide maker, a meeting note-taker, a free image editor, a coding agent, a voice dictation app and a PDF chat tool, with what each is best at.',
      keyPoints: ['NotebookLM turns your PDFs into podcasts and quizzes', 'Gamma makes a deck from one prompt', 'Granola writes meeting notes without a bot', 'Try free tiers before paying'],
      category: 'AI',
      tags: ['ai-tools', 'productivity', 'free-tools', 'students'],
      entities: [
        { type: 'tool', name: 'NotebookLM', detail: 'Research notes, audio overviews' },
        { type: 'tool', name: 'Gamma', detail: 'Slides from a prompt' },
        { type: 'tool', name: 'Granola', detail: 'Meeting notes' },
        { type: 'tool', name: 'Photoroom', detail: 'Image editing' },
        { type: 'tool', name: 'Claude Code', detail: 'Coding agent' },
        { type: 'tool', name: 'Wispr Flow', detail: 'Voice dictation' },
        { type: 'tool', name: 'ChatPDF', detail: 'Chat with PDFs' },
      ],
      links: [
        { url: 'https://notebooklm.google.com', label: 'NotebookLM', source: 'screen' },
        { url: 'https://gamma.app', label: 'Gamma', source: 'screen' },
        { url: 'https://www.granola.ai', label: 'Granola', source: 'audio' },
        { url: 'https://wisprflow.ai', label: 'Wispr Flow', source: 'screen' },
      ],
      transcriptExcerpt: 'Tool number one, NotebookLM. Upload your class notes and it makes a podcast out of them…',
    },
  },
  {
    url: 'https://www.instagram.com/reel/DemoCafeHKV1/',
    author: 'delhi.foodtrail',
    duration: 42,
    daysAgo: 0,
    note: 'Try the rooftop one with Maa this Sunday',
    a: {
      title: '3 hidden cafés in Hauz Khas Village under ₹500',
      summary:
        'A walk-through of three budget cafés: a rooftop with lake views, a bookstore café with board games, and a Korean dessert bar. Best visited on weekdays before 5 pm.',
      keyPoints: ['Rooftop café has the best lake view at sunset', 'Bookstore café lets you play board games free', 'Korean bingsu starts at ₹250', 'Go on weekdays to skip the queue'],
      category: 'Food',
      tags: ['delhi', 'cafes', 'budget', 'hauz-khas', 'weekend-plan'],
      entities: [
        { type: 'place', name: 'Rooftop café, lake view', detail: 'Hauz Khas Village · ~₹400 for two' },
        { type: 'place', name: 'Bookstore café', detail: 'Board games · open till 11 pm' },
        { type: 'place', name: 'Korean dessert bar', detail: 'Bingsu from ₹250' },
        { type: 'price', name: '₹500 for two' },
      ],
      links: [{ url: 'https://linktr.ee/delhi.foodtrail', label: 'Full café list (in bio)', source: 'screen' }],
      transcriptExcerpt: 'Café number one is on the third floor, you can see the whole lake from here…',
    },
  },
  {
    url: 'https://www.youtube.com/watch?v=DemoPortfol',
    author: 'BuildWithRiya',
    duration: 728,
    daysAgo: 0,
    a: {
      title: 'Build a portfolio website in 1 hour for ₹0',
      summary: 'Step-by-step guide to a personal portfolio using a free template, GitHub Pages hosting and a custom domain, with tips on what recruiters look for.',
      keyPoints: ['Start from an open-source template', 'Host free on GitHub Pages', 'Add a custom domain for about ₹700 a year', 'Lead with 3 strong projects, not 10 weak ones'],
      category: 'Tech',
      tags: ['portfolio', 'github', 'web', 'career', 'free-tools'],
      entities: [
        { type: 'tool', name: 'GitHub Pages', detail: 'Free static hosting' },
        { type: 'tool', name: 'VS Code' },
        { type: 'step', name: 'Fork template → edit content → enable Pages' },
        { type: 'price', name: '₹700/year domain' },
      ],
      links: [
        { url: 'https://pages.github.com', label: 'GitHub Pages', source: 'description' },
        { url: 'https://github.com/topics/portfolio-template', label: 'Portfolio templates', source: 'screen' },
        { url: 'https://code.visualstudio.com', label: 'VS Code', source: 'description' },
        { url: 'https://education.github.com/pack', label: 'Student Developer Pack', source: 'audio' },
      ],
    },
  },
  {
    url: 'https://www.linkedin.com/posts/demo-pm-frameworks-7250',
    author: 'Arjun Mehta',
    daysAgo: 1,
    a: {
      title: '5 frameworks for product-sense interviews',
      summary: 'A product manager shares five frameworks for product-sense rounds, with when to use each and a common mistake for every one.',
      keyPoints: ['CIRCLES for open design questions', 'Start with users and their pain, not features', 'Prioritise with impact vs effort', 'Always close with metrics and trade-offs', 'Practise out loud with a timer'],
      category: 'Career',
      tags: ['product-management', 'interview', 'frameworks', 'apm'],
      entities: [
        { type: 'book', name: 'Decode and Conquer' },
        { type: 'book', name: 'Cracking the PM Interview' },
      ],
      links: [{ url: 'https://www.lennysnewsletter.com', label: 'Newsletter mentioned', source: 'caption' }],
    },
  },
  {
    url: 'https://www.instagram.com/reel/DemoGoa3Days/',
    author: 'wanderwithkabir',
    duration: 58,
    daysAgo: 1,
    a: {
      title: 'Goa in 3 days on ₹12,000 (budget itinerary)',
      summary: 'A three-day North and South Goa plan for about ₹12,000 per person, covering a hostel stay, scooter rental, beaches, a fort and where to eat cheaply.',
      keyPoints: ['Day 1: Anjuna and Vagator, sunset at Chapora Fort', 'Day 2: Old Goa churches and Panjim', 'Day 3: Palolem in South Goa', 'Rent a scooter for ~₹400 a day'],
      category: 'Travel',
      tags: ['goa', 'itinerary', 'budget-travel', 'beaches'],
      entities: [
        { type: 'place', name: 'Chapora Fort', detail: 'North Goa · sunset' },
        { type: 'place', name: 'Palolem Beach', detail: 'South Goa' },
        { type: 'place', name: 'Fontainhas', detail: 'Panjim · Latin quarter' },
        { type: 'price', name: '₹12,000 per person' },
        { type: 'price', name: '₹400/day scooter' },
      ],
      links: [],
    },
  },
  {
    url: 'https://www.instagram.com/reel/DemoPaneerBowl/',
    author: 'fitfoodbyananya',
    duration: 35,
    daysAgo: 2,
    a: {
      title: '15-minute high-protein paneer bowl',
      summary: 'A quick vegetarian bowl with about 35 g of protein using paneer, chickpeas and curd dressing.',
      keyPoints: ['Air-fry paneer for 8 minutes', 'Toss chickpeas in chaat masala', 'Curd + mint for the dressing', '~35 g protein per bowl'],
      category: 'Food',
      tags: ['recipe', 'high-protein', 'vegetarian', 'meal-prep'],
      entities: [
        { type: 'ingredient', name: 'Paneer', detail: '150 g' },
        { type: 'ingredient', name: 'Boiled chickpeas', detail: '1 cup' },
        { type: 'ingredient', name: 'Hung curd', detail: '3 tbsp' },
        { type: 'ingredient', name: 'Mint, chaat masala, lemon' },
      ],
      links: [],
    },
  },
  {
    url: 'https://x.com/demo_devtips/status/1853000000000000001',
    author: 'devtips',
    daysAgo: 3,
    a: {
      title: 'Gemini API free tier: 6 tips to stay within limits',
      summary: 'A thread on using the Gemini API free tier for side projects: model choice, batching, caching and handling rate limits.',
      keyPoints: ['Use the Flash model for most tasks', 'Batch small requests together', 'Cache repeated prompts', 'Back off on 429 errors'],
      category: 'AI',
      tags: ['ai', 'gemini', 'api', 'side-project'],
      entities: [{ type: 'tool', name: 'Google AI Studio' }],
      links: [
        { url: 'https://aistudio.google.com', label: 'Google AI Studio', source: 'caption' },
        { url: 'https://ai.google.dev/gemini-api/docs', label: 'Gemini API docs', source: 'caption' },
        { url: 'https://ai.google.dev/pricing', label: 'Pricing', source: 'caption' },
      ],
    },
  },
  {
    url: 'https://www.youtube.com/watch?v=DemoSIPvsLmp',
    author: 'PaisaSimplified',
    duration: 540,
    daysAgo: 5,
    a: {
      title: 'SIP vs lump sum: which is better for beginners?',
      summary: 'Explains rupee-cost averaging, when a lump sum beats a SIP, and a simple rule for first-time investors. Not financial advice.',
      keyPoints: ['SIPs reduce timing risk', 'Lump sum can win in long bull runs', 'Start with an index fund', 'Keep 6 months of expenses as an emergency fund'],
      category: 'Finance',
      tags: ['sip', 'mutual-funds', 'investing', 'beginners'],
      entities: [{ type: 'product', name: 'Nifty 50 index fund' }],
      links: [{ url: 'https://www.amfiindia.com', label: 'AMFI', source: 'description' }],
    },
  },
  {
    url: 'https://www.instagram.com/reel/DemoDumbbell20/',
    author: 'coachsameer',
    duration: 47,
    daysAgo: 6,
    a: {
      title: '20-minute dumbbell full-body workout at home',
      summary: 'A five-move dumbbell circuit for beginners, done three rounds with 40 seconds on and 20 seconds rest.',
      keyPoints: ['Goblet squat', 'Bent-over row', 'Romanian deadlift', 'Shoulder press', 'Renegade row'],
      category: 'Fitness',
      tags: ['workout', 'home-gym', 'dumbbells', 'beginner'],
      entities: [{ type: 'step', name: '3 rounds · 40s on / 20s off' }],
      links: [],
    },
  },
  {
    url: 'https://www.youtube.com/shorts/DemoCaseMath',
    author: 'CaseCrackers',
    duration: 55,
    daysAgo: 7,
    a: {
      title: 'Case interview mental-math shortcuts',
      summary: 'Three shortcuts for consulting case math: rounding to friendly numbers, the rule of 72 and percentage flips.',
      keyPoints: ['Round to friendly numbers first', 'Rule of 72 for doubling time', 'x% of y = y% of x'],
      category: 'Career',
      tags: ['consulting', 'case-interview', 'mental-math'],
      entities: [],
      links: [],
    },
  },
  {
    url: 'https://www.instagram.com/p/DemoRishikesh/',
    author: 'mountainsmeetme',
    daysAgo: 8,
    a: {
      title: 'Rishikesh weekend plan from Delhi',
      summary: 'A two-day Rishikesh plan with rafting, cafés in Tapovan and the evening Ganga aarti, plus bus and train options from Delhi.',
      keyPoints: ['Overnight Volvo from Kashmere Gate', 'Rafting 16 km stretch ~₹600', 'Ganga aarti at Triveni Ghat'],
      category: 'Travel',
      tags: ['rishikesh', 'weekend', 'delhi', 'rafting'],
      entities: [
        { type: 'place', name: 'Triveni Ghat', detail: 'Evening aarti' },
        { type: 'place', name: 'Tapovan', detail: 'Cafés' },
        { type: 'price', name: '₹600 rafting' },
      ],
      links: [{ url: 'https://www.irctc.co.in', label: 'IRCTC', source: 'caption' }],
    },
  },
  {
    url: 'https://blog.example.com/rag-explained-simply',
    author: 'The Product Notebook',
    daysAgo: 9,
    progress: 'done',
    a: {
      title: 'RAG explained simply, for product managers',
      summary: 'An article explaining retrieval-augmented generation with a library analogy, when PMs should choose it over fine-tuning, and three metrics to track.',
      keyPoints: ['RAG = search your docs, then let the model answer', 'Cheaper and fresher than fine-tuning', 'Track answer accuracy, citation rate and latency'],
      category: 'AI',
      tags: ['rag', 'llm', 'product-management', 'explainer'],
      entities: [
        { type: 'tool', name: 'Vector database', detail: 'Stores embeddings' },
        { type: 'tool', name: 'LangChain' },
      ],
      links: [{ url: 'https://python.langchain.com', label: 'LangChain docs', source: 'page' }],
    },
  },
  {
    url: 'https://www.youtube.com/watch?v=DemoOldChat01',
    author: 'StartupStories',
    duration: 1260,
    daysAgo: 0,
    sharedDaysAgo: 365,
    channel: 'import',
    note: 'Imported from WhatsApp chat with Maa',
    a: {
      title: 'How a Delhi chai startup reached 100 outlets',
      summary: 'A founder interview on growing a chai brand from one cart to 100 outlets: unit economics, franchise model and early mistakes.',
      keyPoints: ['Started with one cart near a college', 'Franchise model after outlet 10', 'Unit economics before expansion'],
      category: 'Career',
      tags: ['startups', 'founder-story', 'delhi', 'business'],
      entities: [{ type: 'place', name: 'Laxmi Nagar', detail: 'First cart' }],
      links: [],
    },
  },
];

/** Build the demo library relative to `now`, newest first. */
export function demoItems(now: Date = new Date()): SaveItem[] {
  const total = SEEDS.length;
  return SEEDS.map((s, i) => {
    const { platform, kind } = detectPlatform(s.url);
    const created = new Date(now.getTime() - s.daysAgo * 86_400_000 - i * 3_600_000).toISOString();
    const sharedAt = s.sharedDaysAgo ? new Date(now.getTime() - s.sharedDaysAgo * 86_400_000).toISOString() : undefined;
    const analysis: Analysis = { ...s.a, engine: kind === 'post' || kind === 'thread' ? 'ai-text' : 'ai-video', confidence: s.a.confidence ?? 0.86, model: 'demo' };
    return {
      id: `demo-${i + 1}`,
      seq: 120 + (total - i),
      url: s.url,
      platform,
      kind,
      status: 'ready',
      channel: s.channel ?? (i % 3 === 0 ? 'whatsapp' : 'share'),
      progress: s.progress,
      pinned: s.pinned,
      sharedAt,
      meta: { url: s.url, platform, kind, title: s.a.title, author: s.author, durationSec: s.duration },
      analysis,
      note: s.note,
      createdAt: created,
      updatedAt: created,
    } satisfies SaveItem;
  });
}
