import multer from 'multer';
import { ApiError } from '../lib/http';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

/** Upload em memória para arquivos CSV/XLSX. */
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase().replace(/.*(\.[a-z0-9]+)$/i, '$1');
    const mimeOk = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype);
    // VULN-FIX: exige extensão E MIME type corretos (antes era OR, permitindo bypass)
    if (ALLOWED_EXTENSIONS.includes(ext) && mimeOk) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest('Formato de arquivo não suportado. Use .csv ou .xlsx'));
    }
  },
});

// ──── Upload de imagem para mensagens (WhatsApp) ────
const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB (compatível com WhatsApp e Nginx)
const IMAGE_MIMES = [
  'image/jpeg',
  'image/pjpeg',
  'image/jfif',
  'image/png',
  'image/webp',
  'image/gif',
];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif'];

/** Upload em memória para imagens (anexo de mensagem). */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase().replace(/.*(\.[a-z0-9]+)$/i, '$1');
    const mimeOk = IMAGE_MIMES.includes(file.mimetype) || file.mimetype.startsWith('image/');
    // Valida extensão permitida E mimetype
    if ((IMAGE_EXTENSIONS.includes(ext) || ext === '') && mimeOk) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF'));
    }
  },
});
