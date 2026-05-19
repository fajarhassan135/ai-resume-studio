export const runtime = 'nodejs';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQCLOUD;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen/qwen3-32b';

export async function POST(request) {
  try {
    const { resume, instruction, targetRole } = await request.json();

    const prompt = `You are an expert resume writer. The user has this resume:

${resume}

They are targeting: "${targetRole}"

Their request: "${instruction}"

Apply their requested change to the resume. Return ONLY the full updated resume text, no explanation, no preamble. Just the resume.`;

    if (!GROQ_API_KEY) {
      return Response.json(
        { error: 'Missing GROQ API key. Set GROQ_API_KEY (or GROQCLOUD) in .env.local.' },
        { status: 500 }
      );
    }

    const completion = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });

    const payload = await completion.json();
    if (!completion.ok) {
      return Response.json(
        { error: payload?.error?.message || 'Groq API request failed' },
        { status: completion.status }
      );
    }

    const refined = payload?.choices?.[0]?.message?.content || '';

    return Response.json({ refined });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}