import express from 'express';
import {
   orderDetails,
   updateOrderStatus,
   verifyDeliveryOtp,
   itemUpdateStatus
}
   from '../controllers/orderController.js';
import { verifyToken } from '../middleware/auth.js';

const orderRoutes = express.Router();
orderRoutes.get('/orders', verifyToken, orderDetails);
orderRoutes.put('/update-order-status', verifyToken, updateOrderStatus);
orderRoutes.put('/verify-delivery-otp', verifyToken, verifyDeliveryOtp);
orderRoutes.put('/multi-update-status', verifyToken, itemUpdateStatus);

export default orderRoutes;