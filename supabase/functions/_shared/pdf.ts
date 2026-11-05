/* A PDF of photographs, one to a page.

   A zip is a container the studio has to unpack before it can see
   anything. A PDF opens, scrolls and prints, which is what these
   pictures are for.

   Nothing is re-encoded. A JPEG goes into the file exactly as it
   arrived, as a DCTDecode image - the same bytes the customer
   uploaded, so a print taken from this is a print taken from the
   original. That is also why this is small and quick: there is no
   decoding and no compression, just a wrapper.

   Each page is the size of its own picture, in points at 72 dpi, so
   nothing is cropped, letterboxed or rotated. A portrait photograph
   makes a portrait page.

   JPEG only. Anything else is listed on a page of its own saying so
   rather than being silently dropped - the studio needs to know a
   photograph exists even when this cannot show it.               */

const enc = (s: string) => new TextEncoder().encode(s);

/* Width, height and components, read out of a JPEG's own headers.
   A PDF has to be told the size and whether it is grey, colour or
   CMYK, and the file already says. */
export function jpegInfo(
  bytes: Uint8Array
): { width: number; height: number; components: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];

    /* Start-of-frame: the one that carries the dimensions. C4, C8 and
       CC are tables, not frames, which is the trap in reading these. */
    const isFrame =
      (marker >= 0xc0 && marker <= 0xcf) &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrame) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9]
      };
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; /* image data: too far */

    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

export type PdfPhoto = {
  name: string;
  bytes: Uint8Array | null;
  /* Set when the picture could not be put in, and said on its page. */
  problem?: string;
};

/* Text that cannot break out of a PDF string. */
const pdfText = (s: string) =>
  String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const COLOUR: Record<number, string> = {
  1: '/DeviceGray',
  3: '/DeviceRGB',
  4: '/DeviceCMYK'
};

export function buildPdf(title: string, photos: PdfPhoto[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const put = (part: Uint8Array | string) => {
    const bytes = typeof part === 'string' ? enc(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };

  /* Objects are numbered from 1 and their byte offsets recorded, which
     is the whole of what the cross-reference table at the end is. */
  const startObject = (n: number) => {
    offsets[n] = length;
    put(`${n} 0 obj\n`);
  };

  put('%PDF-1.4\n');
  /* A comment of high bytes, which is how a PDF tells anything
     shipping it that it is not text. */
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  type Page = { contents: number; image: number | null; w: number; h: number; label: string };
  const pages: Page[] = [];

  /* 1 is the catalogue and 2 the page tree; pages start after. */
  let next = 3;

  for (const photo of photos) {
    const info = photo.bytes ? jpegInfo(photo.bytes) : null;

    if (photo.bytes && info && COLOUR[info.components]) {
      const imageNumber = next++;
      startObject(imageNumber);
      put(
        `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} ` +
          `/ColorSpace ${COLOUR[info.components]} /BitsPerComponent 8 ` +
          `/Filter /DCTDecode /Length ${photo.bytes.length} >>\nstream\n`
      );
      put(photo.bytes);
      put('\nendstream\nendobj\n');

      /* The page is the picture's own size in points, so the image is
         drawn over the whole of it at its natural proportions. */
      const contentsNumber = next++;
      const draw = `q\n${info.width} 0 0 ${info.height} 0 0 cm\n/Im0 Do\nQ\n`;
      startObject(contentsNumber);
      put(`<< /Length ${enc(draw).length} >>\nstream\n${draw}endstream\nendobj\n`);

      pages.push({
        contents: contentsNumber, image: imageNumber,
        w: info.width, h: info.height, label: photo.name
      });
    } else {
      /* Said out loud on a page rather than left out. */
      const why = photo.problem || (photo.bytes ? 'not a JPEG' : 'could not be read');
      const draw =
        `BT\n/F1 13 Tf\n56 742 Td\n(${pdfText(photo.name)}) Tj\n` +
        `0 -20 Td\n(This photograph could not be included: ${pdfText(why)}.) Tj\nET\n`;
      const contentsNumber = next++;
      startObject(contentsNumber);
      put(`<< /Length ${enc(draw).length} >>\nstream\n${draw}endstream\nendobj\n`);
      pages.push({ contents: contentsNumber, image: null, w: 595, h: 842, label: photo.name });
    }
  }

  const fontNumber = next++;
  startObject(fontNumber);
  put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  const pageNumbers = pages.map(() => next++);

  pages.forEach((page, i) => {
    startObject(pageNumbers[i]);
    const resources = page.image
      ? `<< /XObject << /Im0 ${page.image} 0 R >> >>`
      : `<< /Font << /F1 ${fontNumber} 0 R >> >>`;
    put(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.w} ${page.h}] ` +
        `/Resources ${resources} /Contents ${page.contents} 0 R >>\nendobj\n`
    );
  });

  startObject(2);
  put(
    `<< /Type /Pages /Count ${pages.length} ` +
      `/Kids [${pageNumbers.map((n) => `${n} 0 R`).join(' ')}] >>\nendobj\n`
  );

  const infoNumber = next++;
  startObject(infoNumber);
  put(`<< /Title (${pdfText(title)}) /Producer (WrappedStudio) >>\nendobj\n`);

  startObject(1);
  put('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const total = next;
  const xref = length;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) {
    table += `${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  put(table);
  put(`trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoNumber} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
