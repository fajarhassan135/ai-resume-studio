export const runtime = 'nodejs';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQCLOUD;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen/qwen3.6-27b';

function cleanJsonResponse(raw) {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

export async function POST(request) {
  try {
    const { resume, instruction, targetRole } = await request.json();

    if (!GROQ_API_KEY) {
      return Response.json(
        { error: 'Missing GROQ API key. Set GROQ_API_KEY (or GROQCLOUD) in .env.local.' },
        { status: 500 }
      );
    }

    const prompt = `You are an expert resume writer. Here is the user's current resume as structured JSON:

${JSON.stringify(resume, null, 2)}

They are targeting: "${targetRole}"

Their request: "${instruction}"

Apply their requested change. Return ONLY a single raw JSON object. No markdown, no code fences, no explanation, no <think> tags. It must keep the exact same shape as the input JSON (the same keys: name, title, contact, summary, skills, projects, experience, education, additional). Only change the content the request asks you to change, keep everything else the same. Do not drop any field, and do not invent new information that was not already present unless the user explicitly asked you to add something.`;

    const completion = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_completion_tokens: 3000,
        reasoning_effort: 'none',
      }),
    });

    const payload = await completion.json();
    if (!completion.ok) {
      return Response.json(
        { error: payload?.error?.message || 'Groq API request failed' },
        { status: completion.status }
      );
    }

    const raw = payload?.choices?.[0]?.message?.content || '';
    const cleaned = cleanJsonResponse(raw);

    if (!cleaned) {
      return Response.json({ error: 'Empty response from model' }, { status: 500 });
    }

    let refined;
    try {
      refined = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: 'Model returned invalid JSON. Please try again.' }, { status: 500 });
    }

    return Response.json({ refined });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}