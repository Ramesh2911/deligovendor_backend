import express from 'express';
import {
   mainCategories,
   subCategories
}
   from '../controllers/categoryController.js';
import { verifyToken } from '../middleware/auth.js';

const categoryRoutes = express.Router();
categoryRoutes.get('/mainCategories', mainCategories);
categoryRoutes.get('/subCategories', verifyToken, subCategories);

export default categoryRoutes;