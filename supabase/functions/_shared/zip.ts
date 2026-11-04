/* A zip file, written as it goes.

   Small on purpose. It stores, it does not compress: everything that
   goes in is a JPEG or a PNG, which are compressed already, and
   deflating them again spends CPU to make the file very slightly
   bigger. "Store" is what a photographer's zip should be anyway.

   One entry is held in memory at a time. The CRC and the length have
   to be in the local header, and knowing them means having read the
   whole member - but a member is one photograph, which the shop caps
   at 25MB, so that is the high-water mark however many are in the
   order. The alternative is streaming with data descriptors, which is
   a trailer some older unzip programs ignore, and this file is going
   to somebody's Windows machine to be printed from.

   No ZIP64. That needs more than 65,535 members or more than 4GB, and
   the function that calls this refuses long before either.         */

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

/* The ordinary CRC-32, table built once. */
const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* MS-DOS date and time, which is what a zip records. Two seconds is
   the resolution the format has; that is not a rounding error on our
   part. */
function dosTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

class Writer {
  private parts: number[] = [];
  u16(v: number) { this.parts.push(v & 0xff, (v >>> 8) & 0xff); }
  u32(v: number) {
    this.parts.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  }
  bytes(): Uint8Array { return new Uint8Array(this.parts); }
}

export type ZipEntry = {
  name: string;
  /* Fetches the member's bytes. Called once, when its turn comes, so
     nothing is read until it is about to be written. */
  read: () => Promise<Uint8Array>;
  at?: Date;
};

/* Names a zip can carry, and that two members cannot share.

   A customer uploads from a phone, and phones hand out IMG_0001.jpg
   over and over. Two members with one name is a zip that unpacks to
   one file, so the second becomes "IMG_0001 (2).jpg" - what a
   download folder would have done. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    /* Anything that could climb out of the folder, or that Windows
       will not have, becomes an underscore. */
    let name = String(raw || 'photo')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 180) || 'photo';

    const key = name.toLowerCase();
    const used = seen.get(key) ?? 0;
    seen.set(key, used + 1);
    if (used === 0) return name;

    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    return `${stem} (${used + 1})${ext}`;
  });
}

/* The archive, as a stream. Members are read one at a time and each
   is let go before the next is fetched. */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const names = uniqueNames(entries.map((e) => e.name));

  type Central = {
    name: Uint8Array; crc: number; size: number; offset: number;
    time: number; date: number;
  };
  const central: Central[] = [];
  let offset = 0;
  let i = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i < entries.length) {
        const entry = entries[i];
        const name = new TextEncoder().encode(names[i]);
        const body = await entry.read();
        const crc = crc32(body);
        const { time, date } = dosTime(entry.at ?? new Date());

        const head = new Writer();
        head.u32(LOCAL);
        head.u16(20);
        /* Bit 11: the name is UTF-8. Without it a name with an accent
           in it is read in the reader's own code page. */
        head.u16(0x0800);
        head.u16(0); /* stored */
        head.u16(time);
        head.u16(date);
        head.u32(crc);
        head.u32(body.length);
        head.u32(body.length);
        head.u16(name.length);
        head.u16(0);

        const header = head.bytes();
        controller.enqueue(header);
        controller.enqueue(name);
        controller.enqueue(body);

        central.push({ name, crc, size: body.length, offset, time, date });
        offset += header.length + name.length + body.length;
        i++;
        return;
      }

      /* Everything is written; the directory of it goes last. */
      const start = offset;
      let size = 0;
      for (const entry of central) {
        const w = new Writer();
        w.u32(CENTRAL);
        w.u16(20);
        w.u16(20);
        w.u16(0x0800);
        w.u16(0);
        w.u16(entry.time);
        w.u16(entry.date);
        w.u32(entry.crc);
        w.u32(entry.size);
        w.u32(entry.size);
        w.u16(entry.name.length);
        w.u16(0);
        w.u16(0);
        w.u16(0);
        w.u16(0);
        w.u32(0);
        w.u32(entry.offset);

        const bytes = w.bytes();
        controller.enqueue(bytes);
        controller.enqueue(entry.name);
        size += bytes.length + entry.name.length;
      }

      const end = new Writer();
      end.u32(END);
      end.u16(0);
      end.u16(0);
      end.u16(central.length);
      end.u16(central.length);
      end.u32(size);
      end.u32(start);
      end.u16(0);
      controller.enqueue(end.bytes());

      controller.close();
    }
  });
}
