import { closeSync, fstatSync, openSync, readSync } from "node:fs";

export function decodeJsonText(buffer, { fatal = true, stream = false } = {}) {
  const encoding = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe
    ? "utf-16le"
    : buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff
      ? "utf-16be"
      : "utf-8";
  return new TextDecoder(encoding, { fatal }).decode(buffer, { stream });
}

export function readJsonFile(path, maxBytes) {
  const descriptor = openSync(path, "r");
  try {
    const info = fstatSync(descriptor);
    if (!info.isFile()) throw new Error("NOT_A_FILE");
    if (info.size > maxBytes) throw new Error("FILE_TOO_LARGE");
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const bytesRead = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maxBytes) throw new Error("FILE_TOO_LARGE");
    return JSON.parse(decodeJsonText(buffer.subarray(0, length)));
  } finally {
    closeSync(descriptor);
  }
}
