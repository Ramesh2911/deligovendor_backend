import express from 'express';
import {
   login,
   logout,
   getCountries,
   createAcount,
   updateUserAccount,
   updateDocs,
   sendResetOtp,
   resendResetOtp,
   verifyResetOtp,
   resetPassword,
   forgotPasswordPhone,
   updatePassword,
   changePassword
}
   from '../controllers/authController.js';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';

const authRoutes = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

authRoutes.post('/createuseraccount', createAcount);
authRoutes.put('/useraccountupdate',  updateUserAccount);
authRoutes.put(
  "/update-docs/:id",
  upload.fields([
    { name: "profile_picture", maxCount: 1 },
    { name: "owner_id_doc", maxCount: 1 },
    { name: "nif_doc", maxCount: 1 },
    { name: "health_license", maxCount: 1 },
    { name: "shop_logo", maxCount: 1 },
    { name: "shop_banner", maxCount: 1 },
    { name: "service_agreement", maxCount: 1 },
  ]),
  updateDocs
);
authRoutes.post('/login', login);
authRoutes.post('/logout', verifyToken, logout);
authRoutes.post('/reset-password-otp', sendResetOtp);
authRoutes.post('/resend-reset-otp', resendResetOtp);
authRoutes.post('/verify-reset-otp', verifyResetOtp);
authRoutes.put('/reset-password', resetPassword);
authRoutes.get('/country-list', getCountries);
authRoutes.post('/forgot-password-phone', forgotPasswordPhone);
authRoutes.put("/update-password", updatePassword);
authRoutes.put("/change-password", verifyToken, changePassword);

export default authRoutes;