import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import MarketplaceSettings from '../models/MarketplaceSettings';

// Get marketplace settings (public - sellers can see commission rate)
export const getMarketplaceSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let settings = await MarketplaceSettings.findOne();
    if (!settings) {
      settings = await MarketplaceSettings.create({ commissionRate: 0.10 }); // Default 10%
    }

    res.json({
      commissionRate: settings.commissionRate,
      commissionRatePercent: Math.round(settings.commissionRate * 100) // For display purposes
    });
  } catch (error: any) {
    console.error('Error getting marketplace settings:', error);
    res.status(500).json({ error: error.message || 'Failed to get marketplace settings' });
  }
};

// Get marketplace settings for admin (includes all data)
export const getMarketplaceSettingsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    let settings = await MarketplaceSettings.findOne();
    if (!settings) {
      settings = await MarketplaceSettings.create({ commissionRate: 0.10 }); // Default 10%
    }

    res.json({
      commissionRate: settings.commissionRate,
      commissionRatePercent: Math.round(settings.commissionRate * 100),
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    });
  } catch (error: any) {
    console.error('Error getting marketplace settings:', error);
    res.status(500).json({ error: error.message || 'Failed to get marketplace settings' });
  }
};

// Update marketplace settings (admin only)
export const updateMarketplaceSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { commissionRate } = req.body;

    // Validate input
    if (commissionRate === undefined || commissionRate === null) {
      res.status(400).json({ error: 'Commission rate is required' });
      return;
    }

    const rate = typeof commissionRate === 'number' ? commissionRate : parseFloat(commissionRate);

    if (isNaN(rate) || rate < 0 || rate > 1) {
      res.status(400).json({ error: 'Commission rate must be between 0 and 1 (0% to 100%)' });
      return;
    }

    // Get or create settings
    let settings = await MarketplaceSettings.findOne();
    if (!settings) {
      settings = await MarketplaceSettings.create({ commissionRate: rate });
    } else {
      settings.commissionRate = rate;
      await settings.save();
    }

    res.json({
      message: 'Marketplace settings updated successfully',
      commissionRate: settings.commissionRate,
      commissionRatePercent: Math.round(settings.commissionRate * 100),
      updatedAt: settings.updatedAt
    });
  } catch (error: any) {
    console.error('Error updating marketplace settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update marketplace settings' });
  }
};
