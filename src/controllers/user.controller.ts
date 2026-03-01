import { Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import SellerProfile from '../models/SellerProfile';
import { AuthRequest } from '../middleware/auth.middleware';
import { createError } from '../utils/errors';

// Get current user profile
export const getCurrentUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get user profile' });
  }
};

// Update current user profile
export const updateCurrentUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { fullName } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fullName },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
};

// Get all users (admin only)
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    res.json({
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })),
      count: users.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get users' });
  }
};

// Get user by ID (admin only)
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
};

// Change user role (admin only)
export const changeUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['customer', 'seller', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Valid role is required (customer, seller, admin)' });
      return;
    }

    // Prevent changing own role
    if (req.user && id === req.user._id.toString()) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update user role' });
  }
};

// Create user (admin only)
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, role, businessName, businessDescription } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (!role || !['customer', 'seller'].includes(role)) {
      res.status(400).json({ error: 'Valid role is required (customer, seller). Admin accounts cannot be created through this endpoint.' });
      return;
    }

    // Prevent creating admin accounts
    if (role === 'admin') {
      res.status(403).json({ error: 'Admin accounts cannot be created through this endpoint' });
      return;
    }

    // If creating a seller, business name is required
    if (role === 'seller' && !businessName) {
      res.status(400).json({ error: 'Business name is required for seller accounts' });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Ensure role is 'seller' if businessName is provided (creating a seller)
    const finalRole = businessName ? 'seller' : role;

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName: fullName || '',
      role: finalRole
    });

    let sellerProfile = null;
    
    // If creating a seller, create seller profile
    if (finalRole === 'seller') {
      sellerProfile = await SellerProfile.create({
        userId: user._id,
        businessName: businessName,
        businessDescription: businessDescription || '',
        status: 'pending' // New sellers created by admin start with pending status
      });
    }

    res.status(201).json({
      message: `User created successfully${role === 'seller' ? ' with seller profile' : ''}`,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt
      },
      sellerProfile: sellerProfile ? {
        id: sellerProfile._id,
        businessName: sellerProfile.businessName,
        businessDescription: sellerProfile.businessDescription,
        status: sellerProfile.status
      } : null
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'User with this email already exists' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
};

// Update user (admin only)
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, email } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update fullName if provided
    if (fullName !== undefined) {
      user.fullName = fullName;
    }

    // Update email if provided
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
      if (existingUser) {
        res.status(400).json({ error: 'Email is already taken' });
        return;
      }
      user.email = email.toLowerCase();
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        updatedAt: user.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    if (error.code === 11000) {
      res.status(400).json({ error: 'Email is already taken' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
};

// Delete user (admin only)
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (req.user && id === req.user._id.toString()) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
};
