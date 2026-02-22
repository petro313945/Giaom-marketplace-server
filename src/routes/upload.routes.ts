import { Router } from 'express';
import { uploadImage } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadSingle } from '../middleware/upload.middleware';

const router = Router();

// Protected route - only authenticated users can upload
router.post('/', authenticate, uploadSingle, uploadImage);

export default router;
