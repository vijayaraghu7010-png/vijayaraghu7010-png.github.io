const g: any = globalThis as any;
export function r2Configured(): boolean { return true; }
export async function presignGet(key: string, filename: string, secs: number): Promise<string> {
  g.__state.callOrder.push('presign');
  return `https://bucket.example.com/${key}?X-Amz-Signature=SIGNED&X-Amz-Expires=${secs}&fn=${encodeURIComponent(filename)}`;
}
