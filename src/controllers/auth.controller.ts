import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { JWT_CONFIG } from '../config/jwt';
import { createError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth.middleware';

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
