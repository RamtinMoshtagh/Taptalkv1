// services/openai.ts
import { OpenAI } from 'openai';
import { OPENAI_API_KEY } from '@env';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function generateInsight(conflicts: { timestamp: string; tag: string }[]) {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  const formatted = conflicts.map(c => `- ${c.timestamp.split('T')[0]}: ${c.tag}`).join('\n');

  const prompt = `
You are a kind and emotionally intelligent assistant helping couples grow through gentle reflection.

Each week, you receive a log of short conflict tags (like "Money", "Chores", "Misunderstanding", etc.) that one of the partners logs via an app.

Your task is to analyze the conflict logs from the past week and offer a warm, insightful summary.

Include these three sections:

1. 💔 Top Conflict Themes: What were the most common topics? Mention them in a calm tone.
2. 🕰️ Time Patterns (if any): Did conflicts seem to cluster around certain times or days?
3. 💡 Suggestions for Awareness and Growth: Offer 1–2 kind, non-judgmental suggestions the couple can reflect on together. Keep them short and emotionally supportive.

Here are the logs:

${formatted}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const insight = completion.choices[0].message.content ?? 'No insight generated.';
    const formatDate = (date: Date) => {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return { day, month, year };
};

const start = formatDate(oneWeekAgo);
const end = formatDate(now);
const sameMonth = start.month === end.month;
const sameYear = start.year === end.year;

const rangeString = sameMonth && sameYear
  ? `${start.day}–${end.day} ${end.month} ${end.year}`
  : `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;


    return {
      insight,
      dateRange: `🗓️ ${rangeString}`,
    };
  } catch (err) {
    console.error('OpenAI error:', err);
    return {
      insight: 'Something went wrong generating the insight.',
      dateRange: '',
    };
  }
}

