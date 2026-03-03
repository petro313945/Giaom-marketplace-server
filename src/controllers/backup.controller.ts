import { Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { AuthRequest } from '../middleware/auth.middleware';

// Import all models to ensure they're registered
import User from '../models/User';
import Product from '../models/Product';
import Category from '../models/Category';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Review from '../models/Review';
import Address from '../models/Address';
import Wishlist from '../models/Wishlist';
import SellerProfile from '../models/SellerProfile';
import Report from '../models/Report';
import Payout from '../models/Payout';
import RefundRequest from '../models/RefundRequest';
import HomeSettings from '../models/HomeSettings';
import MarketplaceSettings from '../models/MarketplaceSettings';
import PasswordResetToken from '../models/PasswordResetToken';

// Create backups directory if it doesn't exist
const BACKUPS_DIR = path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

/**
 * Create a database backup
 * Exports all collections to JSON files and creates a zip archive
 */
export const createBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(BACKUPS_DIR, `backup-${timestamp}`);
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Get all collections from mongoose
    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({ error: 'Database connection not available' });
      return;
    }

    const collections = await db.listCollections().toArray();
    const backupData: { [key: string]: number } = {};

    // Export each collection to JSON
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);
      
      // Skip system collections
      if (collectionName.startsWith('system.')) {
        continue;
      }

      try {
        const documents = await collection.find({}).toArray();
        const jsonData = JSON.stringify(documents, null, 2);
        const filePath = path.join(backupDir, `${collectionName}.json`);
        
        fs.writeFileSync(filePath, jsonData, 'utf8');
        backupData[collectionName] = documents.length;
      } catch (error: any) {
        console.error(`Error backing up collection ${collectionName}:`, error);
        // Continue with other collections even if one fails
      }
    }

    // Create metadata file
    const metadata = {
      timestamp: new Date().toISOString(),
      database: mongoose.connection.name,
      collections: backupData,
      totalCollections: Object.keys(backupData).length,
      totalDocuments: Object.values(backupData).reduce((sum, count) => sum + count, 0),
      createdBy: {
        userId: req.user._id.toString(),
        email: req.user.email,
        name: req.user.name
      }
    };

    fs.writeFileSync(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // Create zip archive
    const zipFileName = `backup-${timestamp}.zip`;
    const zipFilePath = path.join(BACKUPS_DIR, zipFileName);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`Backup archive created: ${zipFilePath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(backupDir, false);
      archive.finalize();
    });

    // Clean up temporary backup directory (keep only the zip)
    fs.rmSync(backupDir, { recursive: true, force: true });

    res.json({
      message: 'Backup created successfully',
      backup: {
        filename: zipFileName,
        path: `/api/backup/download/${zipFileName}`,
        size: fs.statSync(zipFilePath).size,
        timestamp: metadata.timestamp,
        collections: backupData,
        totalCollections: metadata.totalCollections,
        totalDocuments: metadata.totalDocuments
      }
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to create backup' });
  }
};

/**
 * List all available backups
 */
export const listBackups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(file => file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
          downloadUrl: `/api/backup/download/${file}`
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({
      backups,
      total: backups.length
    });
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: error.message || 'Failed to list backups' });
  }
};

/**
 * Download a backup file
 */
export const downloadBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { filename } = req.params;
    
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const filePath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }

    // Check if it's a zip file
    if (!filename.endsWith('.zip')) {
      res.status(400).json({ error: 'Invalid backup file' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to download backup' });
  }
};

/**
 * Delete a backup file
 */
export const deleteBackup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { filename } = req.params;
    
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const filePath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Backup file not found' });
      return;
    }

    fs.unlinkSync(filePath);

    res.json({
      message: 'Backup deleted successfully',
      filename
    });
  } catch (error: any) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete backup' });
  }
};
