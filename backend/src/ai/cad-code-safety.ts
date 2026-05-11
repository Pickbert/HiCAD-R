import { BadRequestException } from '@nestjs/common';

const blockedPatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bimportScripts\s*\(/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bglobalThis\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bimport\s*\(/
];

export function validateCadCodeSafety(code: string, maxBytes = 200_000): string {
  if (Buffer.byteLength(code, 'utf8') > maxBytes) {
    throw new BadRequestException(`CAD code exceeds ${maxBytes} bytes`);
  }
  const blocked = blockedPatterns.find((pattern) => pattern.test(code));
  if (blocked) {
    throw new BadRequestException(`CAD code contains blocked token: ${blocked.source}`);
  }
  return code;
}
