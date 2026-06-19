'use client';
import { useState } from 'react';
import Results from '../components/Results';

async function parseApiResponse(response: Response) {
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('targetRole', targetRole);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await parseApiResponse(res);
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-2xl font-bold text-green-600">ResumeAI</span>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">
            Analyze your resume with AI
          </h1>
          <p className="text-gray-500 text-lg">
            Upload your CV and get instant feedback, a score, and improvement tips
          </p>
        </div>

        {/* Target Role Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Target Role (optional)
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Frontend Developer, Data Analyst..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-green-400"
          />
        </div>

        {/* Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center bg-white hover:border-green-400 transition-colors cursor-pointer"
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div className="text-5xl mb-4">📄</div>
          {file ? (
            <p className="text-green-600 font-medium">{file.name}</p>
          ) : (
            <>
              <p className="text-gray-600 font-medium">Drop your PDF here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            </>
          )}
          <input
            id="fileInput"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={!file || loading}
          className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          {loading ? 'Analyzing...' : 'Analyze Resume'}
        </button>

        {/* Loading */}
        {loading && (
          <div className="text-center mt-8">
            <div className="text-4xl animate-spin inline-block">⏳</div>
            <p className="text-gray-500 mt-3">Sending to Groq AI, please wait...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
            ❌ {error}
          </div>
        )}

        {/* Results */}
        {result && <Results data={result} file={file} targetRole={targetRole} />}

      </div>
    </main>
  );
}