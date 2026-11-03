/**
 * Planilhas CSV no formato do Excel em português: separador ";" (também aceita "," e tabulação),
 * campos entre aspas e BOM UTF-8 para os acentos abrirem certo no Excel.
 */

function count(text, char) {
  return text.split(char).length - 1;
}

/** Converte o texto do CSV em linhas de células. O separador é o que mais aparece no cabeçalho. */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const header = clean.split(/\r?\n/, 1)[0];
  const delimiter = [';', '\t', ','].reduce((best, candidate) => (count(header, candidate) > count(header, best) ? candidate : best), ';');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (clean[index + 1] === '"') { field += '"'; index += 1; } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Lê o arquivo como UTF-8; se não for (CSV salvo pelo Excel no padrão do Windows), usa Windows-1252. */
export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Gera e baixa um CSV que o Excel abre direto, com acentos. */
export function downloadCsv(fileName, rows) {
  const csv = rows.map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
