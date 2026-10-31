const g: any = globalThis as any;
export function r2Configured(): boolean { return true; }
export async function presignGet(key: string, filename: string, secs: number): Promise<string> {
  g.__state.callOrder.push('presign');
  return `https://bucket.example.com/${key}?X-Amz-Signature=SIGNED&X-Amz-Expires=${secs}&fn=${encodeURIComponent(filename)}`;
}

/* The rest of the bucket, for the payment functions.

   __r2 is the bucket: a map of key to size. A test puts a key in it
   to mean "the screenshot really did upload", and leaves it out to
   mean the browser said so and nothing arrived. */
const bucket = (): Record<string, number> => (g.__r2 ||= {});

export async function presignPut(key: string, contentType: string, secs: number): Promise<string> {
  return `https://bucket.example.com/${key}?X-Amz-Signature=SIGNED&X-Amz-Expires=${secs}&ct=${encodeURIComponent(contentType)}`;
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  const size = bucket()[key];
  return typeof size === 'number' ? { size } : null;
}

export async function deleteObject(key: string): Promise<void> {
  delete bucket()[key];
}
