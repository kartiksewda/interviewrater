import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const ROLE_LABELS: Record<string, string> = {
  sde1: 'SDE-1 (Software Development Engineer)',
  bank_po: 'Bank PO (Probationary Officer)',
  mba_gdpi: 'MBA GD-PI (Group Discussion & Personal Interview)',
};

export async function POST(req: NextRequest) {
  try {
    const { transcript, role, question, sessionId } = await req.json();
    if (!transcript || !role || !question || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const roleLabel = ROLE_LABELS[role] || role;
    let reportJson: any = null;

    if (ANTHROPIC_API_KEY) {
      reportJson = await scoreWithAnthropic(transcript, roleLabel, question);
    } else if (OPENAI_API_KEY) {
      reportJson = await scoreWithOpenAI(transcript, roleLabel, question);
    } else {
      // Fallback: generate a mock report for testing
      reportJson = generateMockReport(transcript, roleLabel, question);
    }

    // Save report to database
    const supabase = createServiceClient();
    await supabase.from('reports').insert({
      session_id: sessionId,
      report_json: reportJson,
    });

    return NextResponse.json({ report: reportJson });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}

async function scoreWithAnthropic(transcript: string, role: string, question: string): Promise<any> {
  const systemPrompt = buildSystemPrompt(role);
  const userMessage = `Interview question: ${question}\nTarget role: ${role}\nCandidate transcript (with filler annotations): ${transcript}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Anthropic API error: ${e}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseJsonResponse(text);
}

async function scoreWithOpenAI(transcript: string, role: string, question: string): Promise<any> {
  const systemPrompt = buildSystemPrompt(role);
  const userMessage = `Interview question: ${question}\nTarget role: ${role}\nCandidate transcript (with filler annotations): ${transcript}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`OpenAI API error: ${e}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseJsonResponse(text);
}

function buildSystemPrompt(role: string): string {
  return `You are a brutally honest, highly specific interview coach for Indian job seekers and exam candidates. You have interviewed thousands of candidates for ${role} positions in India and know exactly what separates a hire from a reject at this level. You do not give generic feedback — every point you make must reference specific words or phrases the candidate actually said.

You will receive:
- The interview question asked
- The target role (e.g. SDE-1, Bank PO, MBA GD-PI)
- A transcript of the candidate's spoken answer, including filler word annotations

Evaluate the answer against these five criteria. Be strict — a score of 8+/10 should be rare and earned. Most first-attempt answers should score in the 4-7 range.

1. STRUCTURE (STAR method) — score 0-10
   Does the answer follow Situation, Task, Action, Result? Identify which components are present, weak, or completely missing. An answer that is just a list of duties with no specific situation is a low score. An answer that jumps straight to "what I would do" instead of a real past example is a low score.

2. SPECIFICITY — score 0-10
   Does the candidate use concrete numbers, metrics, timeframes, tools, or named outcomes ("reduced load time by 40%", "led a team of 4", "closed the deal in 3 weeks") or do they speak in vague generalities ("I worked hard", "it went well", "I'm a team player")? Quote the vaguest sentence they said as evidence.

3. FILLER WORD FREQUENCY — score 0-10 (10 = clean, 0 = very high filler density)
   Count filler words and disfluencies (um, uh, like, so, basically, actually, you know, kind of) from the transcript. Calculate fillers per 100 words. Under 2 per 100 words = strong (9-10). 2-5 = average (5-8). Above 5 = weak (0-4).

4. CONFIDENCE vs HEDGING LANGUAGE — score 0-10
   Identify hedging phrases ("I think maybe", "I'm not sure but", "kind of", "I guess", "probably") versus confident, ownership-taking language ("I decided", "I led", "I ensured", "I achieved"). Quote one hedging example and one confident example if present. High hedging density = low score.

5. ROLE-RELEVANT CORRECTNESS — score 0-10
   Judge whether the technical or behavioral content is actually correct and appropriate for a ${role} candidate at their level. For technical roles, flag factual errors or shallow understanding. For behavioral/GD-PI roles, flag answers that would raise red flags with a real interviewer (blaming others, no self-awareness, unrealistic claims).

Then write ONE rewritten version of their answer — using their own real details and examples, not invented ones — restructured into a strong STAR-format answer that fixes their biggest weakness. Keep it realistic to what they'd actually say, not corporate-jargon-stuffed. Keep it under 150 words, spoken-language style, not essay style.

Respond ONLY with valid JSON in exactly this shape, no markdown formatting, no preamble:

{
  "overall_score": <integer 0-100, weighted average of the 5 criteria x2>,
  "headline_insight": "<one punchy sentence, the single most important thing they need to fix>",
  "structure": {
    "score": <0-10>,
    "verdict": "<Present | Weak | Missing>",
    "explanation": "<2-3 sentences, reference what they actually said>"
  },
  "specificity": {
    "score": <0-10>,
    "explanation": "<2-3 sentences>",
    "vague_quote_example": "<exact quote from their transcript that was too vague>"
  },
  "filler_words": {
    "score": <0-10>,
    "count": <integer, total filler words detected>,
    "per_100_words": <number, rounded to 1 decimal>,
    "most_common": ["<word1>", "<word2>"]
  },
  "confidence_language": {
    "score": <0-10>,
    "hedging_example": "<exact quote showing hedging, or null if none found>",
    "confident_example": "<exact quote showing confident language, or null if none found>"
  },
  "role_correctness": {
    "score": <0-10>,
    "explanation": "<2-3 sentences specific to their target role>"
  },
  "rewritten_answer": "<the full rewritten STAR-format answer, under 150 words>"
}`;
}

function parseJsonResponse(text: string): any {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

function generateMockReport(transcript: string, role: string, question: string): any {
  const words = transcript.split(/\s+/).filter(Boolean);
  const wordCount = words.length || 50;
  const fillerWords = ['um', 'uh', 'like', 'so', 'basically', 'actually', 'you know', 'kind of'];
  let fillerCount = 0;
  const fillerMap: Record<string, number> = {};
  const lowerText = transcript.toLowerCase();
  for (const f of fillerWords) {
    const matches = lowerText.match(new RegExp(`\\b${f}\\b`, 'g'));
    if (matches) {
      fillerCount += matches.length;
      fillerMap[f] = matches.length;
    }
  }
  const per100 = Math.round((fillerCount / wordCount) * 1000) / 10;
  const topFillers = Object.entries(fillerMap).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);

  const structureScore = 5;
  const specificityScore = 4;
  const fillerScore = per100 < 2 ? 9 : per100 <= 5 ? 6 : 3;
  const confidenceScore = 5;
  const roleScore = 5;
  const overall = Math.round(((structureScore + specificityScore + fillerScore + confidenceScore + roleScore) / 5) * 10);

  return {
    overall_score: overall,
    headline_insight: 'Your answer lacks specific examples and STAR structure — focus on one concrete situation with measurable results.',
    structure: {
      score: structureScore,
      verdict: 'Weak',
      explanation: 'Your answer touches on the topic but jumps between general statements without a clear Situation-Task-Action-Result flow. You describe what you would do rather than what you actually did.',
    },
    specificity: {
      score: specificityScore,
      explanation: 'Your answer uses vague language without concrete metrics, timeframes, or named outcomes. Add specific numbers and tools to make your experience credible.',
      vague_quote_example: words.slice(0, 10).join(' ') || 'I worked hard on this project',
    },
    filler_words: {
      score: fillerScore,
      count: fillerCount,
      per_100_words: per100,
      most_common: topFillers.length ? topFillers : ['um', 'like'],
    },
    confidence_language: {
      score: confidenceScore,
      hedging_example: words.length > 5 ? `"${words.slice(0, 8).join(' ')}"` : null,
      confident_example: null,
    },
    role_correctness: {
      score: roleScore,
      explanation: `For a ${role} candidate, your answer covers the topic at a surface level but would benefit from deeper technical or domain-specific detail to demonstrate real understanding.`,
    },
    rewritten_answer: 'In my previous project, I faced a specific challenge where the API response time was 3 seconds, affecting user experience. My task was to reduce it to under 500ms. I implemented caching with Redis and optimized our database queries, reducing response time by 80% to 600ms. This improved our user retention by 15% in the following month.',
  };
}
