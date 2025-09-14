import express from 'express';
import {
   getUnits,
}
   from '../controllers/unitController.js';
import { verifyToken } from '../middleware/auth.js';

const unitRoutes = express.Router();
unitRoutes.get('/get-units', verifyToken, getUnits);

export default unitRoutes;