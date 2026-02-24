import { Response } from 'express';
import Address from '../models/Address';
import { AuthRequest } from '../middleware/auth.middleware';

// Get all addresses for current user
export const getUserAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

    res.json({
      addresses: addresses.map(address => ({
        id: address._id,
        userId: address.userId,
        fullName: address.fullName,
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        phone: address.phone,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt
      })),
      count: addresses.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get addresses' });
  }
};

// Get address by ID
export const getAddressById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const address = await Address.findById(id);

    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Check if user owns this address
    if (address.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      address: {
        id: address._id,
        userId: address.userId,
        fullName: address.fullName,
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        phone: address.phone,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid address ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get address' });
  }
};

// Create new address
export const createAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { fullName, address, city, state, zipCode, country, phone, isDefault } = req.body;

    if (!fullName || !address || !city || !zipCode || !country) {
      res.status(400).json({ error: 'Full name, address, city, zip code, and country are required' });
      return;
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await Address.updateMany(
        { userId: req.user._id },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = await Address.create({
      userId: req.user._id,
      fullName,
      address,
      city,
      state: state || '',
      zipCode,
      country,
      phone: phone || '',
      isDefault: isDefault || false
    });

    res.status(201).json({
      message: 'Address created successfully',
      address: {
        id: newAddress._id,
        userId: newAddress.userId,
        fullName: newAddress.fullName,
        address: newAddress.address,
        city: newAddress.city,
        state: newAddress.state,
        zipCode: newAddress.zipCode,
        country: newAddress.country,
        phone: newAddress.phone,
        isDefault: newAddress.isDefault,
        createdAt: newAddress.createdAt,
        updatedAt: newAddress.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create address' });
  }
};

// Update address
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { fullName, address, city, state, zipCode, country, phone, isDefault } = req.body;

    const existingAddress = await Address.findById(id);
    if (!existingAddress) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Check if user owns this address
    if (existingAddress.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingAddress.isDefault) {
      await Address.updateMany(
        { userId: req.user._id, _id: { $ne: id } },
        { $set: { isDefault: false } }
      );
    }

    // Update fields
    if (fullName !== undefined) existingAddress.fullName = fullName;
    if (address !== undefined) existingAddress.address = address;
    if (city !== undefined) existingAddress.city = city;
    if (state !== undefined) existingAddress.state = state;
    if (zipCode !== undefined) existingAddress.zipCode = zipCode;
    if (country !== undefined) existingAddress.country = country;
    if (phone !== undefined) existingAddress.phone = phone;
    if (isDefault !== undefined) existingAddress.isDefault = isDefault;

    await existingAddress.save();

    res.json({
      message: 'Address updated successfully',
      address: {
        id: existingAddress._id,
        userId: existingAddress.userId,
        fullName: existingAddress.fullName,
        address: existingAddress.address,
        city: existingAddress.city,
        state: existingAddress.state,
        zipCode: existingAddress.zipCode,
        country: existingAddress.country,
        phone: existingAddress.phone,
        isDefault: existingAddress.isDefault,
        createdAt: existingAddress.createdAt,
        updatedAt: existingAddress.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid address ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update address' });
  }
};

// Delete address
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const address = await Address.findById(id);

    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Check if user owns this address
    if (address.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await Address.findByIdAndDelete(id);

    res.json({
      message: 'Address deleted successfully'
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid address ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to delete address' });
  }
};

// Set default address
export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const address = await Address.findById(id);

    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Check if user owns this address
    if (address.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Unset other defaults
    await Address.updateMany(
      { userId: req.user._id, _id: { $ne: id } },
      { $set: { isDefault: false } }
    );

    // Set this as default
    address.isDefault = true;
    await address.save();

    res.json({
      message: 'Default address updated successfully',
      address: {
        id: address._id,
        userId: address.userId,
        fullName: address.fullName,
        address: address.address,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
        phone: address.phone,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid address ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to set default address' });
  }
};
