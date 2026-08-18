// encoding.ts — 中文 txt 编码探测与解码(纯函数,无 vscode 依赖,可独立测试)

export type Encoding = 'utf-8' | 'gbk' | 'gb18030' | 'utf-16le' | 'utf-16be';

// UTF-8 解码错误率低于该阈值仍视为 UTF-8(容忍零星坏字节,坏字节用替换符)
const UTF8_ERROR_RATIO = 0.05;

/**
 * 探测编码:
 * 1. BOM: UTF-8 / UTF-16LE / UTF-16BE
 * 2. 无 BOM:严格 UTF-8 解码前 64KB —— 全通过 → utf-8;
 *    少量错误(错误率 < 5%,如转换残留的零星坏字节)→ utf-8(非致命解码);
 *    错误密集 → gbk(GBK/GB2312)
 */
export function detectEncoding(buf: Buffer, forced?: string): Encoding {
  if (forced && forced !== 'auto') {
    return forced as Encoding;
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf-8';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'utf-16le';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'utf-16be';

  const sample = buf.subarray(0, 65536);
  let errors = 0;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
  } catch {
    const dec = new TextDecoder('utf-8', { fatal: false }).decode(sample);
    errors = (dec.match(/�/g) || []).length;
  }
  if (errors === 0) return 'utf-8';
  const ratio = errors / Math.max(1, sample.length / 4); // 约每 4 字节 1 字
  return ratio < UTF8_ERROR_RATIO ? 'utf-8' : 'gbk';
}

/** 解码全文(utf-16 显式剥 BOM;utf-16be 字节交换;gbk 失败回退 gb18030;utf-8 容忍坏字节) */
export function decodeText(buf: Buffer, forced?: string): string {
  const enc = detectEncoding(buf, forced);
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    let data = buf;
    // TextDecoder('utf-16le') 不会剥离 BOM,显式处理
    if (data.length >= 2 && ((data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0xfe && data[1] === 0xff))) {
      data = data.subarray(2);
    }
    if (enc === 'utf-16be') {
      const swapped = Buffer.alloc(data.length);
      for (let i = 0; i + 1 < data.length; i += 2) {
        swapped[i] = data[i + 1];
        swapped[i + 1] = data[i];
      }
      data = swapped;
    }
    return new TextDecoder('utf-16le').decode(data);
  }
  if (enc === 'utf-8') {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf); // 坏字节 → U+FFFD
  }
  const label = enc === 'gb18030' ? 'gb18030' : 'gbk';
  try {
    return new TextDecoder(label).decode(buf);
  } catch {
    return new TextDecoder('gb18030').decode(buf);
  }
}
