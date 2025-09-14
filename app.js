import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import cors from 'cors';
import authRoute from './routes/authRoutes.js';
import otpRoutes from './routes/otpRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

config({
    path: './config.env'
});

const app = express();
app.use(cors({
    origin: [process.env.FRONTEND_URL, process.env.LOCAL_HOST],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', authRoute);
app.use('/api', otpRoutes);
app.use('/api', categoryRoutes);
app.use('/api', productRoutes);
app.use('/api', unitRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', orderRoutes);

export default app;
