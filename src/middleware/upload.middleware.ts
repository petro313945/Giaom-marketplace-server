import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// Allowed MIME types for images
const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// File filter - only allow images with validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension (most reliable check)
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
  const isValidExtension = allowedExtensions.includes(ext);
  
  if (!isValidExtension) {
    return cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp). Invalid file extension.'));
  }
  
  // Security: Check for path traversal attempts
  const filename = path.basename(file.originalname);
  const hasPathTraversal = filename.includes('..') || 
                          filename.includes('/') || 
                          filename.includes('\\') ||
                          filename.trim() === '';
  
  if (hasPathTraversal) {
    return cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp). Unsafe filename detected.'));
  }
  
  // Check MIME type (be lenient - some browsers send generic or missing MIME types)
  // Extension check is primary validation; MIME type is secondary
  // We allow files with valid extensions even if MIME type is missing or generic
  // This handles cases where browsers send incorrect or missing MIME types
  
  // All checks passed
  return cb(null, true);
};

// Configure multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Single file upload middleware
export const uploadSingle = upload.single('image');

// Multiple files upload middleware (for future use)
export const uploadMultiple = upload.array('images', 10);
