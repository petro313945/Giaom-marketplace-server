import { Router } from 'express';
import {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../controllers/address.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateId } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Address routes
router.get('/', getUserAddresses);
router.get('/:id', validateId, getAddressById);
router.post('/', createAddress);
router.put('/:id', validateId, updateAddress);
router.delete('/:id', validateId, deleteAddress);
router.patch('/:id/default', validateId, setDefaultAddress);

export default router;
