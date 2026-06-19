export const runtime = 'nodejs';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQCLOUD;
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen/qwen3-32b';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume');
    const targetRole = formData.get('targetRole') || 'a software engineering internship';
    const analysisRaw = formData.get('analysis');

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!GROQ_API_KEY) {
      return Response.json(
        { error: 'Missing GROQ API key. Set GROQ_API_KEY (or GROQCLOUD) in .env.local.' },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const resumeText = pdfData.text;

    let analysisSummary = '';
    if (analysisRaw) {
      try {
        const analysis = JSON.parse(analysisRaw);
        analysisSummary = `
Here is the analysis of the original resume:
- Score: ${analysis.score}/100
- Weaknesses: ${analysis.weaknesses?.join(', ')}
- Suggestions: ${analysis.suggestions?.join(', ')}
- Missing Keywords: ${analysis.keywords_missing?.join(', ')}
Use this analysis to guide your improvements.`;
      } catch {
        // ignore parse errors, proceed without analysis
      }
    }

    const prompt = `You are an expert resume writer. Rewrite the following resume to be highly optimized for the role: "${targetRole}".
${analysisSummary}

Rules:
- Output ONLY the improved resume text. No explanations, no commentary, no <think> tags, no markdown.
- Keep it professional, ATS-friendly, and impactful.
- Add quantifiable achievements where possible.
- Use strong action verbs.
- Include relevant keywords for the target role.
- Keep the same general structure (contact info, summary, experience, education, skills).

Original Resume:
${resumeText}`;

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

    const raw = payload?.choices?.[0]?.message?.content || '';

    // Strip <think> blocks and any leftover markdown
    const generated = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```[a-z]*/gi, '')
      .replace(/```/g, '')
      .trim();

    if (!generated) {
      return Response.json({ error: 'Empty response from model' }, { status: 500 });
    }

    return Response.json({ generated });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}