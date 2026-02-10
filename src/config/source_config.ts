export const SOURCE_CONFIG = {
  weights: {
    stocktwits: 0.85,
    reddit_wallstreetbets: 0.6,
    reddit_stocks: 0.9,
    reddit_investing: 0.8,
    reddit_options: 0.85,
    sec_8k: 0.95,
    sec_4: 0.9,
    news: 0.7,
    crypto: 0.8
  },
  decayHalfLifeMinutes: 120,
  engagement: {
    upvotes: { 1000: 1.5, 500: 1.3, 200: 1.2, 100: 1.1, 50: 1.0, 0: 0.8 } as Record<number, number>,
    comments: { 200: 1.4, 100: 1.25, 50: 1.15, 20: 1.05, 0: 0.9 } as Record<number, number>
  },
  flairMultipliers: {
    DD: 1.5,
    "Technical Analysis": 1.3,
    Fundamentals: 1.3,
    News: 1.2,
    Discussion: 1.0,
    Chart: 1.1,
    "Daily Discussion": 0.7,
    "Weekend Discussion": 0.6,
    YOLO: 0.6,
    Gain: 0.5,
    Loss: 0.5,
    Meme: 0.4,
    Shitpost: 0.3
  } as Record<string, number>
};
