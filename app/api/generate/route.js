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

    const prompt = `You are an expert resume writer. Read the resume below, which belongs to a real person, and rewrite it to be highly optimized for the role: "${targetRole}". Use ONLY the person's own real information from their resume. Never invent a different name, company, degree, or fabricated statistic.
${analysisSummary}

Return ONLY a single raw JSON object. No markdown, no code fences, no explanation, no <think> tags. It must match exactly this shape:

{
  "name": "Full name from the resume",
  "title": "Professional title/role from the resume",
  "contact": "One line with email, phone, location, LinkedIn, GitHub as available, separated by | ",
  "summary": "2 to 4 sentence professional summary rewritten for the target role",
  "skills": [
    { "category": "Category name", "items": "Comma separated list of skills" }
  ],
  "projects": [
    { "title": "Project name", "stack": "Tech stack used", "bullets": ["achievement 1", "achievement 2"], "link": "github link if present, else empty string" }
  ],
  "experience": [
    { "role": "Job title", "company": "Company name", "dates": "Date range", "bullets": ["achievement 1", "achievement 2"] }
  ],
  "education": [
    { "degree": "Degree name", "school": "Institution", "dates": "Date range", "details": ["relevant detail"] }
  ],
  "additional": { "softSkills": "Comma separated soft skills if present, else empty string", "languages": "Comma separated languages if present, else empty string" }
}

Rules:
- Keep it professional, ATS-friendly, and impactful.
- Strengthen wording and add quantifiable framing only where it is truthful based on the original resume, never invent numbers.
- Use strong action verbs in bullets.
- Include relevant keywords for the target role where truthful.
- If a section does not exist in the original resume (e.g. no projects), return an empty array for it. Do not invent one.
- Every field listed above must be present in your output even if its value is empty.

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

    let generated;
    try {
      generated = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: 'Model returned invalid JSON. Please try again.' }, { status: 500 });
    }

    return Response.json({ generated });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}