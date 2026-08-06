'use client';
import { useState, useRef, useEffect } from 'react';

async function parseApiResponse(response) {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  if (!isJson) throw new Error(`Server returned non-JSON response (status ${response.status}).`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Server returned invalid JSON (status ${response.status}).`);
  }
}

function Section({ label, children }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 border-b border-gray-200 pb-1.5 mb-2.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function Bullets({ items = [] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1 mt-1">
      {items.map((b, i) => (
        <li key={i} className="text-sm text-gray-700 pl-4 relative leading-6">
          <span className="absolute left-0 top-0">•</span>
          {b}
        </li>
      ))}
    </ul>
  );
}

function ResumeView({ resume }) {
  if (!resume) return null;
  const {
    name, title, contact, summary,
    skills = [], projects = [], experience = [], education = [],
    additional = {},
  } = resume;

  return (
    <div className="font-sans text-gray-800">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">{name}</h2>
        {title && <p className="text-sm font-semibold text-indigo-600 mt-0.5">{title}</p>}
        {contact && <p className="text-xs text-gray-500 mt-1.5 leading-5">{contact}</p>}
      </div>

      {summary && (
        <Section label="Professional Summary">
          <p className="text-sm leading-7 text-gray-700">{summary}</p>
        </Section>
      )}

      {skills.length > 0 && (
        <Section label="Skills">
          <div className="space-y-1.5">
            {skills.map((s, i) => (
              <p key={i} className="text-sm leading-6">
                <span className="font-semibold text-gray-800">{s.category}: </span>
                <span className="text-gray-600">{s.items}</span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {projects.length > 0 && (
        <Section label="Projects">
          <div className="space-y-4">
            {projects.map((p, i) => (
              <div key={i}>
                <p className="text-sm font-bold text-gray-900">
                  {p.title}
                  {p.stack && <span className="font-normal text-gray-500"> | {p.stack}</span>}
                </p>
                <Bullets items={p.bullets} />
                {p.link && <p className="text-xs text-indigo-500 mt-1">{p.link}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {experience.length > 0 && (
        <Section label="Experience">
          <div className="space-y-4">
            {experience.map((e, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900">{e.role}</p>
                  <p className="text-xs text-gray-500 shrink-0">{e.dates}</p>
                </div>
                <p className="text-xs text-gray-600 font-medium italic mb-1">{e.company}</p>
                <Bullets items={e.bullets} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {education.length > 0 && (
        <Section label="Education">
          <div className="space-y-3">
            {education.map((ed, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900">{ed.degree}</p>
                  <p className="text-xs text-gray-500 shrink-0">{ed.dates}</p>
                </div>
                <p className="text-xs text-gray-600 font-medium italic">{ed.school}</p>
                <Bullets items={ed.details} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {(additional.softSkills || additional.languages) && (
        <Section label="Additional">
          {additional.softSkills && (
            <p className="text-sm leading-6">
              <span className="font-semibold text-gray-800">Soft Skills: </span>
              <span className="text-gray-600">{additional.softSkills}</span>
            </p>
          )}
          {additional.languages && (
            <p className="text-sm leading-6 mt-1">
              <span className="font-semibold text-gray-800">Languages: </span>
              <span className="text-gray-600">{additional.languages}</span>
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

export default function Results({ data, file, targetRole }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null); // structured JSON object
  const [genError, setGenError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scoreColor =
    data.score >= 70 ? '#16a34a' :
    data.score >= 50 ? '#d97706' :
    '#dc2626';

  const scoreBg =
    data.score >= 70 ? '#f0fdf4' :
    data.score >= 50 ? '#fffbeb' :
    '#fef2f2';

  const scoreLabel =
    data.score >= 70 ? 'Strong' :
    data.score >= 50 ? 'Needs Work' :
    'Weak';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    setGenerated(null);
    setMessages([]);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('targetRole', targetRole || 'a software engineering internship');
      formData.append('analysis', JSON.stringify(data));

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      const result = await parseApiResponse(res);
      if (!res.ok) throw new Error(result.error || `Request failed with status ${res.status}`);
      if (result.error) throw new Error(result.error);
      setGenerated(result.generated);
      setMessages([{
        role: 'assistant',
        content: `Resume generated. Ask me to refine any section — e.g. "Make the summary shorter" or "Add more backend keywords".`
      }]);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleChat = async () => {
    if (!input.trim() || !generated) return;
    const userMessage = input.trim();
    setInput('');
    setChatLoading(true);
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: generated,
          instruction: userMessage,
          targetRole: targetRole || 'a software engineering internship',
        }),
      });
      const result = await parseApiResponse(res);
      if (!res.ok) throw new Error(result.error || `Request failed with status ${res.status}`);
      if (result.error) throw new Error(result.error);
      setGenerated(result.refined);
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Done. Resume updated. Keep going if you want more changes.`
      }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generated) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - marginX * 2;
    let y = 18;

    const checkPageBreak = (needed = 8) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 18;
      }
    };

    const addSectionHeader = (label) => {
      checkPageBreak(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229);
      doc.text(label.toUpperCase(), marginX, y);
      y += 1.5;
      doc.setDrawColor(210, 210, 210);
      doc.line(marginX, y, marginX + contentWidth, y);
      y += 5;
      doc.setTextColor(30, 30, 30);
    };

    const addBullets = (bullets = []) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(50, 50, 50);
      bullets.forEach((b) => {
        const lines = doc.splitTextToSize(`•  ${b}`, contentWidth - 4);
        lines.forEach((line) => {
          checkPageBreak();
          doc.text(line, marginX + 4, y);
          y += 4.6;
        });
      });
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(generated.name || '', marginX, y);
    y += 6.5;

    if (generated.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(79, 70, 229);
      doc.text(generated.title, marginX, y);
      y += 5;
    }

    if (generated.contact) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110, 110, 110);
      const contactLines = doc.splitTextToSize(generated.contact, contentWidth);
      contactLines.forEach((line) => {
        doc.text(line, marginX, y);
        y += 4;
      });
    }
    y += 3;

    if (generated.summary) {
      addSectionHeader('Professional Summary');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(generated.summary, contentWidth);
      lines.forEach((line) => {
        checkPageBreak();
        doc.text(line, marginX, y);
        y += 4.6;
      });
      y += 3;
    }

    if (generated.skills?.length) {
      addSectionHeader('Skills');
      generated.skills.forEach((s) => {
        checkPageBreak();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        const label = `${s.category}: `;
        doc.text(label, marginX, y);
        const labelWidth = doc.getTextWidth(label);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(s.items, contentWidth - labelWidth);
        doc.text(lines[0] || '', marginX + labelWidth, y);
        y += 4.6;
        for (let i = 1; i < lines.length; i++) {
          checkPageBreak();
          doc.text(lines[i], marginX, y);
          y += 4.6;
        }
      });
      y += 3;
    }

    if (generated.projects?.length) {
      addSectionHeader('Projects');
      generated.projects.forEach((p) => {
        checkPageBreak(10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        const titleLine = p.stack ? `${p.title}  |  ${p.stack}` : p.title;
        doc.text(titleLine, marginX, y);
        y += 4.6;
        addBullets(p.bullets);
        if (p.link) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(79, 70, 229);
          checkPageBreak();
          doc.text(p.link, marginX + 4, y);
          y += 4.6;
        }
        y += 2;
      });
      y += 1;
    }

    if (generated.experience?.length) {
      addSectionHeader('Experience');
      generated.experience.forEach((e) => {
        checkPageBreak(10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        doc.text(e.role || '', marginX, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(130, 130, 130);
        const datesWidth = doc.getTextWidth(e.dates || '');
        doc.text(e.dates || '', marginX + contentWidth - datesWidth, y);
        y += 4.4;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(e.company || '', marginX, y);
        y += 4.6;
        doc.setTextColor(30, 30, 30);
        addBullets(e.bullets);
        y += 2;
      });
      y += 1;
    }

    if (generated.education?.length) {
      addSectionHeader('Education');
      generated.education.forEach((ed) => {
        checkPageBreak(10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        doc.text(ed.degree || '', marginX, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(130, 130, 130);
        const datesWidth = doc.getTextWidth(ed.dates || '');
        doc.text(ed.dates || '', marginX + contentWidth - datesWidth, y);
        y += 4.4;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(ed.school || '', marginX, y);
        y += 4.6;
        doc.setTextColor(30, 30, 30);
        addBullets(ed.details);
        y += 2;
      });
      y += 1;
    }

    if (generated.additional?.softSkills || generated.additional?.languages) {
      addSectionHeader('Additional');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 40);
      if (generated.additional.softSkills) {
        checkPageBreak();
        doc.text(`Soft Skills: ${generated.additional.softSkills}`, marginX, y);
        y += 4.6;
      }
      if (generated.additional.languages) {
        checkPageBreak();
        doc.text(`Languages: ${generated.additional.languages}`, marginX, y);
        y += 4.6;
      }
    }

    const fileName = (generated.name || 'improved-resume').replace(/\s+/g, '_');
    doc.save(`${fileName}_Resume.pdf`);
  };

  return (
    <div className="w-full mt-10 space-y-8">

      {/* ── Score + Summary Row ── */}
      <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div
          className="shrink-0 w-24 h-24 rounded-full flex flex-col items-center justify-center border-4"
          style={{ borderColor: scoreColor, background: scoreBg }}
        >
          <span className="text-3xl font-bold" style={{ color: scoreColor }}>{data.score}</span>
          <span className="text-xs font-semibold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">AI Summary</p>
          <p className="text-gray-700 font-medium leading-relaxed">{data.summary}</p>
        </div>
      </div>

      {/* ── Analysis Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-white border border-green-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3">Strengths</p>
          <ul className="space-y-2">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Weaknesses</p>
          <ul className="space-y-2">
            {data.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">Suggestions</p>
          <ul className="space-y-2">
            {data.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 font-medium">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">Missing Keywords</p>
          <div className="flex flex-wrap gap-2">
            {data.keywords_missing.map((k, i) => (
              <span
                key={i}
                className="text-xs font-semibold px-3 py-1 rounded-full border"
                style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' }}
              >
                {k}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ── Generate Button ── */}
      <div className="border-t border-gray-100 pt-6">
        {targetRole && (
          <p className="text-center text-sm text-gray-400 font-medium mb-3">
            Optimizing for: <span className="text-indigo-500 font-semibold">{targetRole}</span>
          </p>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-base tracking-wide"
        >
          {generating ? 'Generating improved resume...' : 'Generate Improved Resume'}
        </button>
      </div>

      {genError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 font-medium text-sm">
          {genError}
        </div>
      )}

      {/* ── Two-Panel Layout ── */}
      {generated && (
        <div
          className="w-full grid grid-cols-1 lg:grid-cols-2 gap-0 border border-gray-200 rounded-2xl overflow-hidden shadow-md min-h-0"
          style={{ height: '680px' }}
        >

          {/* LEFT — Resume Panel */}
          <div className="flex flex-col border-r border-gray-200 min-h-0">
            <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-600">
              <div>
                <p className="text-white font-bold text-sm tracking-wide">Improved Resume</p>
                <p className="text-indigo-200 text-xs mt-0.5">AI-rewritten for your target role</p>
              </div>
              <button
                onClick={handleDownload}
                className="bg-white text-indigo-600 hover:bg-indigo-50 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              >
                Download PDF
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-6 min-h-0">
              <ResumeView resume={generated} />
            </div>
          </div>

          {/* RIGHT — AI Chat Panel */}
          <div className="flex flex-col bg-gray-50 min-h-0">
            <div className="px-5 py-3.5 bg-gray-800">
              <p className="text-white font-bold text-sm tracking-wide">Refine with AI</p>
              <p className="text-gray-400 text-xs mt-0.5">Ask me to adjust any part of your resume</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-0.5">
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap font-medium ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    AI
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder='e.g. "Make the summary punchier"'
                  className="flex-1 text-sm border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-400 font-medium"
                />
                <button
                  onClick={handleChat}
                  disabled={chatLoading || !input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold w-10 h-10 rounded-xl transition-colors flex items-center justify-center"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}