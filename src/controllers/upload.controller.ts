import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

// Upload single image
export const uploadImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Return the image URL
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
};
