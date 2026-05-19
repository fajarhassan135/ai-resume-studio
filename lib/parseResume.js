export async function parseResume(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to parse PDF: ' + error.message);
  }
}\