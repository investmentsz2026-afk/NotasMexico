import * as path from 'path';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.txt',
  '.csv',
]);

export interface ValidationResult {
  isValid: boolean;
  detectedMime: string;
  sanitizedFilename: string;
  error?: string;
}

export interface ContentScanResult {
  isClean: boolean;
  threatSignature?: string;
}

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * Escáner síncrono de firmas maliciosas (EICAR y payloads activos embebidos).
 * Complementa la integración asíncrona de ClamAV/S3 Event Scanner (OBS-06-01).
 */
export function scanFileContent(buffer: Buffer): ContentScanResult {
  const rawText = buffer.toString('latin1');

  if (rawText.includes(EICAR_SIGNATURE) || rawText.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    return {
      isClean: false,
      threatSignature: 'EICAR-Test-Signature',
    };
  }

  // Detección de acciones de ejecución de comandos o lanzamiento embebidas en PDF
  if (rawText.startsWith('%PDF-') && (/\/Launch\s*<<|\/JavaScript\s*<<.*cmd\.exe/i.test(rawText))) {
    return {
      isClean: false,
      threatSignature: 'PDF-Embedded-Executable-Action',
    };
  }

  return {
    isClean: true,
  };
}

export function sanitizeFilename(filename: string): string {
  // Eliminar rutas relativas, caracteres nulos y caracteres no permitidos
  const basename = path.basename(filename).replace(/[\0\r\n\t]/g, '');
  // Reemplazar espacios y caracteres conflictivos conservando letras, números, puntos y guiones
  const sanitized = basename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return sanitized.length > 0 ? sanitized : 'documento_sin_nombre';
}

export function validateFile(
  buffer: Buffer,
  originalFilename: string,
  claimedMimeType: string,
): ValidationResult {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized).toLowerCase();

  // 1. Validar extensión permitida
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      detectedMime: claimedMimeType,
      sanitizedFilename: sanitized,
      error: `Extensión de archivo '${ext}' no permitida por la política de seguridad institucional. Extensiones admitidas: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
    };
  }

  // 2. Validar tamaño máximo
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      detectedMime: claimedMimeType,
      sanitizedFilename: sanitized,
      error: `El archivo excede el tamaño máximo permitido de 25 MB (recibido: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  if (buffer.length === 0) {
    return {
      isValid: false,
      detectedMime: claimedMimeType,
      sanitizedFilename: sanitized,
      error: 'El archivo está vacío (0 bytes)',
    };
  }

  // 3. Inspección de Magic Bytes (Firmas binarias estrictas)
  let detectedMime: string | null = null;

  // PDF: %PDF- (hex: 25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    detectedMime = 'application/pdf';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedMime = 'image/png';
  }
  // JPEG: FF D8 FF
  else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg';
  }
  // ZIP / Office OpenXML (docx, xlsx, pptx): 50 4B 03 04 (PK..)
  else if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    if (ext === '.docx') {
      detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (ext === '.xlsx') {
      detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (ext === '.pptx') {
      detectedMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else {
      detectedMime = 'application/zip';
    }
  }
  // Texto plano / CSV: Comprobar que sea texto válido UTF-8/ASCII sin bytes binarios nulos
  else if (ext === '.txt' || ext === '.csv') {
    let isBinary = false;
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];
      if (byte === 0 || (byte < 7 && byte !== 9 && byte !== 10 && byte !== 13)) {
        isBinary = true;
        break;
      }
    }
    if (!isBinary) {
      detectedMime = ext === '.csv' ? 'text/csv' : 'text/plain';
    }
  }

  // Si no se detectó una firma válida o hubo discrepancia
  if (!detectedMime) {
    return {
      isValid: false,
      detectedMime: claimedMimeType,
      sanitizedFilename: sanitized,
      error: `Firma binaria de archivo (magic bytes) no coincide con el tipo MIME declarado o formato no permitido (MIME spoofing detectado)`,
    };
  }

  // Validar coherencia entre extensión y tipo detectado
  if (ext === '.pdf' && detectedMime !== 'application/pdf') {
    return {
      isValid: false,
      detectedMime,
      sanitizedFilename: sanitized,
      error: 'Discrepancia de integridad: la extensión indica PDF pero el contenido binario no corresponde.',
    };
  }
  if ((ext === '.png' && detectedMime !== 'image/png') || ((ext === '.jpg' || ext === '.jpeg') && detectedMime !== 'image/jpeg')) {
    return {
      isValid: false,
      detectedMime,
      sanitizedFilename: sanitized,
      error: 'Discrepancia de integridad: la extensión de imagen no coincide con la firma binaria del archivo.',
    };
  }

  return {
    isValid: true,
    detectedMime,
    sanitizedFilename: sanitized,
  };
}

