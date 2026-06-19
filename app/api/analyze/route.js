export const runtime = 'nodejs';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQCLOUD;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen/qwen3-32b';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume');

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    const prompt = `You are an expert resume reviewer. Analyze this resume and return ONLY a JSON object with no extra text, no markdown, no backticks. Just raw JSON like this:
{
  "score": 82,
  "summary": "Two sentence overview here.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"],
  "keywords_missing": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Resume text:
${resumeText}`;

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
        temperature: 0.2,
      }),
    });

    const payload = await completion.json();
    if (!completion.ok) {
      return Response.json(
        { error: payload?.error?.message || 'Groq API request failed' },
        { status: completion.status }
      );
    }

    const text = payload?.choices?.[0]?.message?.content || '';

    const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
    if (!cleaned) {
      return Response.json({ error: 'Empty response from Qwen' }, { status: 500 });
    }

    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}