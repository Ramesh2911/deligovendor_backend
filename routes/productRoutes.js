import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
   addProduct,
   updateProduct,
   getProductsByVendor,
   getTaxes
}
   from '../controllers/productController.js';
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

const productRoutes = express.Router();

productRoutes.post('/addProduct', upload.single("product_image"), verifyToken, addProduct);
productRoutes.put('/updateProduct/:pid', upload.single("product_image"), verifyToken, updateProduct);
productRoutes.get('/products-by-vendor', verifyToken, getProductsByVendor);
productRoutes.get('/taxes', verifyToken, getTaxes);

export default productRoutes;
