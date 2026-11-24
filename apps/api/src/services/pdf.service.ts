import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfPageText = { pageNumber: number; text: string };

export async function extractPdfPages(buffer: Buffer): Promise<{ pageCount: number; pages: PdfPageText[] }> {
  const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
  const document = await task.promise;
  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push({ pageNumber, text });
  }
  const pageCount = document.numPages;
  await task.destroy();
  return { pageCount, pages };
}

export function chunkPage(text: string, targetCharacters = 1400, overlapCharacters = 180): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + targetCharacters, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start + targetCharacters * 0.65) end = boundary;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - overlapCharacters, start + 1);
  }
  return chunks;
}
