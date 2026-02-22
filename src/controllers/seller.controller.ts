import { Response } from 'express';
import SellerProfile from '../models/SellerProfile';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth.middleware';

// Apply to become seller
export const applyToBecomeSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { businessName, businessDescription } = req.body;

    if (!businessName) {
      res.status(400).json({ error: 'Business name is required' });
      return;
    }

    // Check if user already has a seller profile
    const existingProfile = await SellerProfile.findOne({ userId: req.user._id });
    if (existingProfile) {
      res.status(400).json({ error: 'Seller application already exists' });
      return;
    }

    // Create seller profile
    const sellerProfile = await SellerProfile.create({
      userId: req.user._id,
      businessName,
      businessDescription: businessDescription || '',
      status: 'pending'
    });

    res.status(201).json({
      message: 'Seller application submitted successfully',
      sellerProfile: {
        id: sellerProfile._id,
        businessName: sellerProfile.businessName,
        businessDescription: sellerProfile.businessDescription,
        status: sellerProfile.status,
        createdAt: sellerProfile.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to submit seller application' });
  }
};

// Get current seller profile
export const getCurrentSellerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sellerProfile = await SellerProfile.findOne({ userId: req.user._id })
      .populate('userId', 'email fullName');

    if (!sellerProfile) {
      res.status(404).json({ error: 'Seller profile not found' });
      return;
    }

    res.json({
      sellerProfile: {
        id: sellerProfile._id,
        userId: sellerProfile.userId,
        businessName: sellerProfile.businessName,
        businessDescription: sellerProfile.businessDescription,
        status: sellerProfile.status,
        createdAt: sellerProfile.createdAt,
        updatedAt: sellerProfile.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get seller profile' });
  }
};

// Update seller profile
export const updateSellerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { businessName, businessDescription } = req.body;

    const sellerProfile = await SellerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { businessName, businessDescription },
      { new: true, runValidators: true }
    ).populate('userId', 'email fullName');

    if (!sellerProfile) {
      res.status(404).json({ error: 'Seller profile not found' });
      return;
    }

    res.json({
      message: 'Seller profile updated successfully',
      sellerProfile: {
        id: sellerProfile._id,
        userId: sellerProfile.userId,
        businessName: sellerProfile.businessName,
        businessDescription: sellerProfile.businessDescription,
        status: sellerProfile.status,
        updatedAt: sellerProfile.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update seller profile' });
  }
};

// Get pending seller applications (admin only)
export const getPendingSellers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const pendingSellers = await SellerProfile.find({ status: 'pending' })
      .populate('userId', 'email fullName role')
      .sort({ createdAt: -1 });

    res.json({
      sellers: pendingSellers.map(seller => ({
        id: seller._id,
        userId: seller.userId,
        businessName: seller.businessName,
        businessDescription: seller.businessDescription,
        status: seller.status,
        createdAt: seller.createdAt
      })),
      count: pendingSellers.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get pending sellers' });
  }
};

// Get all sellers (admin only)
export const getAllSellers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellers = await SellerProfile.find()
      .populate('userId', 'email fullName role')
      .sort({ createdAt: -1 });

    res.json({
      sellers: sellers.map(seller => ({
        id: seller._id,
        userId: seller.userId,
        businessName: seller.businessName,
        businessDescription: seller.businessDescription,
        status: seller.status,
        createdAt: seller.createdAt,
        updatedAt: seller.updatedAt
      })),
      count: sellers.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get sellers' });
  }
};

// Approve seller (admin only)
export const approveSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sellerProfile = await SellerProfile.findById(id);
    if (!sellerProfile) {
      res.status(404).json({ error: 'Seller profile not found' });
      return;
    }

    if (sellerProfile.status === 'approved') {
      res.status(400).json({ error: 'Seller is already approved' });
      return;
    }

    // Update seller profile status
    sellerProfile.status = 'approved';
    await sellerProfile.save();

    // Update user role to seller if not already
    const user = await User.findById(sellerProfile.userId);
    if (user && user.role === 'customer') {
      user.role = 'seller';
      await user.save();
    }

    res.json({
      message: 'Seller approved successfully',
      sellerProfile: {
        id: sellerProfile._id,
        businessName: sellerProfile.businessName,
        status: sellerProfile.status,
        updatedAt: sellerProfile.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid seller ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to approve seller' });
  }
};

// Reject seller (admin only)
export const rejectSeller = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const sellerProfile = await SellerProfile.findById(id);
    if (!sellerProfile) {
      res.status(404).json({ error: 'Seller profile not found' });
      return;
    }

    if (sellerProfile.status === 'rejected') {
      res.status(400).json({ error: 'Seller is already rejected' });
      return;
    }

    // Update seller profile status
    sellerProfile.status = 'rejected';
    await sellerProfile.save();

    res.json({
      message: 'Seller rejected successfully',
      sellerProfile: {
        id: sellerProfile._id,
        businessName: sellerProfile.businessName,
        status: sellerProfile.status,
        updatedAt: sellerProfile.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid seller ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to reject seller' });
  }
};
