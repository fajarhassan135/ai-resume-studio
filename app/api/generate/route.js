export const runtime = 'nodejs';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQCLOUD;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen/qwen3-32b';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume');
    const targetRole = formData.get('targetRole') || 'a software engineering internship';
    const analysis = formData.get('analysis');

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    const prompt = `You are an expert resume writer. A student is targeting: "${targetRole}".

Here is their current resume:
${resumeText}

Here is the analysis of their resume:
${analysis}

Rewrite and improve this resume to:
- Fix all weaknesses mentioned in the analysis
- Add missing keywords relevant to the target role
- Make it ATS-optimized
- Keep it concise, professional, and impactful
- Use strong action verbs
- Quantify achievements where possible

Return the improved resume as plain text, properly formatted with clear sections like:
CONTACT INFO
SUMMARY
SKILLS
EXPERIENCE
PROJECTS
EDUCATION

Do not add any explanation. Just return the resume text.`;

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

    const generated = payload?.choices?.[0]?.message?.content || '';

    return Response.json({ generated });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}