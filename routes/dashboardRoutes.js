import express from 'express';
import {
   vendorStats,
   updateShopStatus,
   getOrders,
   updateNotification
}
   from '../controllers/dashboardController.js';
import { verifyToken } from '../middleware/auth.js';

const dashboardRoutes = express.Router();
dashboardRoutes.get('/vendor-stats', verifyToken, vendorStats);
dashboardRoutes.put('/shop-status', verifyToken, updateShopStatus);
dashboardRoutes.get('/get-orders',  getOrders);
dashboardRoutes.put('/update-notification', verifyToken, updateNotification);

export default dashboardRoutes;
