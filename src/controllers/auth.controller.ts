import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import PasswordResetToken from '../models/PasswordResetToken';
import { JWT_CONFIG } from '../config/jwt';
import { createError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendPasswordResetEmail } from '../utils/emailService';

// Generate JWT tokens
const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn
  });

  const refreshToken = jwt.sign({ userId }, JWT_CONFIG.refreshSecret, {
    expiresIn: JWT_CONFIG.refreshExpiresIn
  });

  return { accessToken, refreshToken };
};

// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName: fullName || '',
      role: 'customer'
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Send response (exclude password)
    const userResponse = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Send response (exclude password)
    const userResponse = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Login failed' });
  }
};

// Get current user
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const userResponse = {
      id: req.user._id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role
    };

    res.json({ user: userResponse });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
};

// Refresh token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_CONFIG.refreshSecret) as { userId: string };

    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id.toString());

    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }
    res.status(500).json({ error: error.message || 'Token refresh failed' });
  }
};

// Request password reset
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration to 1 hour from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Invalidate any existing tokens for this user
      await PasswordResetToken.updateMany(
        { userId: user._id, used: false },
        { used: true }
      );

      // Create new reset token
      await PasswordResetToken.create({
        userId: user._id,
        token,
        expiresAt
      });

      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, user.fullName || 'Customer', token);
      } catch (error: any) {
        // Log error but don't fail the request (security best practice)
        console.error('Failed to send password reset email:', error.message);
        // In development, still log the token for testing
        if (process.env.NODE_ENV === 'development') {
          console.log(`Password reset token for ${user.email}: ${token}`);
          console.log(`Reset link: ${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`);
        }
      }
    }

    // Always return success message (security best practice)
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process password reset request' });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Find valid reset token
    const resetToken = await PasswordResetToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() } // Token not expired
    }).populate('userId');

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const user = resetToken.userId as any;
    if (!user) {
      res.status(400).json({ error: 'User not found' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword
    });

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    res.json({
      message: 'Password has been reset successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
};
