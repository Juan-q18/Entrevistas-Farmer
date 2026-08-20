import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const COLUMN_GAP = 80;
const LINE_Y_TOLERANCE = 2.5;
const LINE_X_SPACE_GAP = 1.5;

function mergeItemsIntoLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    let placed = false;
    for (const line of lines) {
      if (Math.abs(line.y - item.y) > LINE_Y_TOLERANCE) continue;
      const gap = item.x - (line.x + line.width);
      line.text += (gap > LINE_X_SPACE_GAP ? ' ' : '') + item.str;
      line.width = item.x + item.width - line.x;
      placed = true;
      break;
    }
    if (!placed) {
      lines.push({ y: item.y, x: item.x, width: item.width, text: item.str });
    }
  }
  return lines.sort((a, b) => b.y - a.y).map((l) => l.text.trim()).filter(Boolean);
}

function clusterColumns(items) {
  const bands = [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    let band = bands.find((b) => Math.abs(b.y - item.y) <= LINE_Y_TOLERANCE);
    if (!band) {
      band = { y: item.y, items: [] };
      bands.push(band);
    }
    band.items.push(item);
  }

  const boundaries = [];
  for (const band of bands) {
    const runs = [...band.items].sort((a, b) => a.x - b.x);
    let prevRight = null;
    for (const run of runs) {
      if (prevRight !== null && run.x - prevRight > COLUMN_GAP) {
        boundaries.push((prevRight + run.x) / 2);
      }
      prevRight = Math.max(prevRight ?? 0, run.x + run.width);
    }
  }

  if (boundaries.length < 2) return [items];
  boundaries.sort((a, b) => a - b);
  const boundary = boundaries[Math.floor(boundaries.length / 2)];
  const left = items.filter((i) => i.x < boundary);
  const right = items.filter((i) => i.x >= boundary);
  if (!left.length || !right.length) return [items];
  return [left, right];
}

export async function extractPdfColumns(buffer) {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data }).promise;
  try {
    const texts = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items
        .filter((i) => typeof i.str === 'string' && i.str.trim())
        .map((i) => ({
          str: i.str,
          x: i.transform[4],
          y: i.transform[5],
          width: i.width ?? 0
        }));
      const columns = clusterColumns(items);
      texts.push(columns.map((col) => mergeItemsIntoLines(col).join('\n')).filter(Boolean));
    }
    return { pages: texts, pageCount: doc.numPages };
  } finally {
    try { doc.cleanup(); } catch {}
  }
}