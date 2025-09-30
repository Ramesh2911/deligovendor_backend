import express from 'express';
import {
   getBanks
}
   from '../controllers/bankController.js';

const bankRoutes = express.Router();
bankRoutes.get('/get-banks', getBanks);

export default bankRoutes;