'use client';
import { useState, useRef, useEffect } from 'react';

async function parseApiResponse(response) {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    throw new Error(`Server returned non-JSON response (status ${response.status}).`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Server returned invalid JSON (status ${response.status}).`);
  }
}

export default function Results({ data, file, targetRole }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [genError, setGenError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scoreColor =
    data.score >= 70 ? 'text-green-500' :
    data.score >= 50 ? 'text-amber-500' :
    'text-red-500';

  const ringColor =
    data.score >= 70 ? 'border-green-500' :
    data.score >= 50 ? 'border-amber-500' :
    'border-red-500';

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

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const result = await parseApiResponse(res);
      if (!res.ok) throw new Error(result.error || `Request failed with status ${res.status}`);
      if (result.error) throw new Error(result.error);
      setGenerated(result.generated);
      setMessages([{
        role: 'assistant',
        content: `Your improved resume is ready! You can now ask me to refine it further. For example:\n• "Make my summary shorter"\n• "Add more ML keywords"\n• "Make the experience section more impactful"`
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
        content: `Done! I've updated your resume. Keep asking if you want more changes.`
      }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDownload = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(generated, 180);
    let y = 15;
    lines.forEach((line) => {
      if (y > 280) { doc.addPage(); y = 15; }
      doc.text(line, 15, y);
      y += 7;
    });
    doc.save('improved-resume.pdf');
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-10 space-y-6">

      {/* Score */}
      <div className="flex flex-col items-center">
        <div className={`w-28 h-28 rounded-full border-8 ${ringColor} flex items-center justify-center`}>
          <span className={`text-4xl font-bold ${scoreColor}`}>{data.score}</span>
        </div>
        <p className="text-gray-500 mt-2 text-sm">Resume Score</p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <p className="text-gray-700 text-center">{data.summary}</p>
      </div>

      {/* Grid sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-xl p-5 border border-green-200">
          <h3 className="font-semibold text-green-700 mb-3">✅ Strengths</h3>
          <ul className="space-y-2">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-green-800 text-sm">• {s}</li>
            ))}
          </ul>
        </div>

        <div className="bg-red-50 rounded-xl p-5 border border-red-200">
          <h3 className="font-semibold text-red-700 mb-3">⚠️ Weaknesses</h3>
          <ul className="space-y-2">
            {data.weaknesses.map((w, i) => (
              <li key={i} className="text-red-800 text-sm">• {w}</li>
            ))}
          </ul>
        </div>

        <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
          <h3 className="font-semibold text-blue-700 mb-3">💡 Suggestions</h3>
          <ul className="space-y-2">
            {data.suggestions.map((s, i) => (
              <li key={i} className="text-blue-800 text-sm">• {s}</li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
          <h3 className="font-semibold text-amber-700 mb-3">🔑 Missing Keywords</h3>
          <div className="flex flex-wrap gap-2">
            {data.keywords_missing.map((k, i) => (
              <span key={i} className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full border border-amber-300">
                {k}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          {generating ? '✨ Generating improved resume...' : '✨ Generate Improved Resume'}
        </button>
        {targetRole && (
          <p className="text-center text-gray-400 text-sm mt-2">Optimized for: {targetRole}</p>
        )}
      </div>

      {genError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          ❌ {genError}
        </div>
      )}

      {/* Side Panel Layout */}
      {generated && (
        <div className="flex gap-4 border border-indigo-200 rounded-xl overflow-hidden" style={{ height: '600px' }}>

          {/* Left — Generated Resume */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-100 bg-indigo-50">
              <h3 className="font-semibold text-indigo-700 text-sm">✨ Improved Resume</h3>
              <button
                onClick={handleDownload}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                ⬇️ Download PDF
              </button>
            </div>
            <pre className="flex-1 overflow-y-auto whitespace-pre-wrap text-gray-700 text-xs font-mono leading-relaxed p-4">
              {generated}
            </pre>
          </div>

          {/* Divider */}
          <div className="w-px bg-indigo-100" />

          {/* Right — Chat Panel */}
          <div className="w-72 flex flex-col bg-gray-50">
            <div className="px-4 py-3 border-b border-indigo-100 bg-indigo-50">
              <h3 className="font-semibold text-indigo-700 text-sm">💬 Refine with AI</h3>
              <p className="text-xs text-indigo-400 mt-0.5">Ask me to fix anything</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 text-gray-400 rounded-xl rounded-bl-sm px-3 py-2 text-xs">
                    Updating resume...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                  placeholder="e.g. Add Python skills..."
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
                />
                <button
                  onClick={handleChat}
                  disabled={chatLoading || !input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-xs px-3 py-2 rounded-lg transition-colors"
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