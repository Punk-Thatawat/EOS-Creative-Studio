/** A page as a JPEG data URL, with the picture's size in pixels. */
export type EditedPage = { url: string; width: number; height: number };

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A zip with nothing compressed: pictures are JPEGs already and the XML is tiny, so a plain archive is all a .docx needs. */
export function zipStore(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // 1 January 2024 00:00 in DOS date and time
  const dosDate = ((2024 - 1980) << 9) | (1 << 5) | 1;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(10, 0, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(14, dosDate, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + file.data.length;
  }
  const size = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)].map((part) => part as BlobPart), { type: "application/zip" });
}

const dataUrlBytes = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (character) => character.charCodeAt(0));

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

/** The page width in twentieths of a point: A4. A page that is not A4-shaped keeps its own proportions. */
const PAGE_TWIPS = 11906;
const EMU_PER_TWIP = 635;

/**
 * A Word file with one page per picture, each filling its page. The pictures are the form with every edit drawn on it,
 * so the file looks exactly like what was on screen (but its text cannot be edited in Word).
 */
export function pagesToDocx(pages: EditedPage[]): Blob {
  const body = pages.map((page, index) => {
    const width = PAGE_TWIPS;
    const height = Math.round((PAGE_TWIPS * page.height) / page.width);
    const id = index + 1;
    const picture = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width * EMU_PER_TWIP}" cy="${height * EMU_PER_TWIP}"/><wp:docPr id="${id}" name="Page ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="page${id}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width * EMU_PER_TWIP}" cy="${height * EMU_PER_TWIP}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
    // A little spare height so the paragraph holding the picture never spills onto a page of its own. The last page uses the document's own section.
    const section = `<w:sectPr><w:pgSz w:w="${width}" w:h="${height + 120}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
    return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${index < pages.length - 1 ? section : ""}</w:pPr><w:r>${picture}</w:r></w:p>`;
  }).join("");
  const last = pages[pages.length - 1] ?? { width: 1, height: 1 };
  const lastHeight = Math.round((PAGE_TWIPS * last.height) / last.width);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="${PAGE_TWIPS}" w:h="${lastHeight + 120}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const relationships = pages.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${index + 1}.jpg"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: "_rels/.rels", data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: "word/document.xml", data: encoder.encode(documentXml) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`) },
    ...pages.map((page, index) => ({ name: `word/media/page${index + 1}.jpg`, data: dataUrlBytes(page.url) })),
  ];
  const blob = zipStore(files);
  return new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/**
 * The pages saved with a reading, as a file the preview opens like any form the person uploads: the picture itself for
 * a single page, a PDF of the pictures for several.
 */
export async function jpegPagesToFile(pages: Array<{ base64: string }>, name: string): Promise<File> {
  const bytes = pages.map((page) => Uint8Array.from(atob(page.base64), (character) => character.charCodeAt(0)));
  const base = name.replace(/\.[^.]+$/, "") || "form";
  if (bytes.length === 1) return new File([bytes[0]!], `${base}.jpg`, { type: "image/jpeg" });
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const data of bytes) {
    const picture = await pdf.embedJpg(data);
    pdf.addPage([picture.width, picture.height]).drawImage(picture, { x: 0, y: 0, width: picture.width, height: picture.height });
  }
  return new File([Uint8Array.from(await pdf.save())], `${base}.pdf`, { type: "application/pdf" });
}
