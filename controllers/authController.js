import { adminCookie } from '../utils/cookies.js';
import bcrypt from 'bcrypt';
import con from '../db/db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { uploadToS3 } from '../utils/s3.js';
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

// Determine S3 folder based on document type
const getS3Folder = (fieldName) => {
  if (fieldName === "shop_logo" || fieldName === "shop_banner") {
    return "shop/";
  }
  return "profile/";
};


//=====createAcount=====
export const createAcount = async (req, res) => {
  try {
    const {
      prefix,
      first_name,
      last_name,
      password,
      email,
      country_id,
      country_code,
      mobile,
      address,
      pincode,
      latitude,
      longitude,
    } = req.body;

    if (
      !first_name || !last_name || !password || !email ||
      !country_id || !country_code || !mobile || !address || !pincode
    ) {
      return res.status(400).json({
        status: false,
        message: 'All required fields must be provided.',
      });
    }

    const [existingUser] = await con.query(
      `SELECT id FROM hr_users WHERE email = ? OR mobile = ?`,
      [email, mobile]
    );

    if (existingUser.length > 0) {
      return res.status(401).json({
        status: false,
        message: 'User with this email or phone number already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

   const insertQuery = `
  INSERT INTO hr_users (
    prefix, first_name, last_name, password, email,
    country_id, country_code, mobile, address, pincode,
    nif, latitude, longitude, role_id, built_in, exclude,
    passport, vehicle_type, is_active
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const insertValues = [
  prefix, first_name, last_name, hashedPassword, email,
  country_id, country_code, mobile, address, pincode,
  null,          // nif
  latitude, longitude,
  4,             // role_id
  0,             // built_in
  0,             // exclude
  null,          // passport
  0,          // vehicle_type
  'Y'            // is_active
];

    const [result] = await con.query(insertQuery, insertValues);

    return res.status(200).json({
      status: true,
      message: 'User registered successfully.',
      insertedId: result.insertId,
    });
  } catch (error) {
    console.error('Register Error:', error.message);
    return res.status(500).json({
      status: false,
      message: 'Server error while registering user.',
    });
  }
};

//======updateAccount=====
export const updateUserAccount = async (req, res) => {
  try {
    const { id, business_name, business_person, company_name, contact_mail, contact_mobile, business_type_id } = req.body;

    if (!id) {
      return res.status(400).json({ status: false, message: 'User ID is required.' });
    }

    const query = "UPDATE hr_users SET business_name=?, business_person=?, company_name=?, contact_mail=?, contact_mobile=?, business_type_id=? WHERE id=?";
    const values = [business_name, business_person, company_name, contact_mail, contact_mobile, business_type_id, id];

    const [result] = await con.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: false, message: 'No user found with the given ID.' });
    }

   return res.status(200).json({ 
      status: true, 
      message: 'User updated successfully.', 
      Id: id 
    });

  } catch (error) {
    console.error('Database or Server Error:', error);
    return res.status(500).json({ status: false, message: 'Internal server error.', error: error.message });
  }
};

//===== document upload=====
export const updateDocs = async (req, res) => {
  const { id } = req.params;
  const files = req.files;

  if (!id) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  try {
    let updateData = {};

    for (const fieldName in files) {
      const file = files[fieldName][0];
      const folder = getS3Folder(fieldName);
     
      const s3Path = await uploadToS3(
        file.buffer,
        file.originalname,
        folder,
        file.mimetype
      );
     
      updateData[fieldName] = s3Path;
    }

    if (Object.keys(updateData).length > 0) {
      await con.query("UPDATE hr_users SET ? WHERE id = ?", [updateData, id]);
    }

    res.status(200).json({
      success: true,
      message: "Documents updated successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating documents",
      error: error.message,
    });
  }
};

// =====login======
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: 'Email and password are required',
      });
    }

    const [rows] = await con.query(
      `SELECT
      u.*,
      c.category_name,
      cn.name AS country_name
   FROM hr_users u
   LEFT JOIN hr_category c
     ON u.business_type_id = c.cid
   LEFT JOIN hr_countries cn
     ON u.country_id = cn.id
   WHERE u.email = ?
     AND u.role_id = 4
     AND u.is_active = 'Y'`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'Invalid credentials',
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: 'Invalid credentials',
      });
    }

    adminCookie(
      process.env.JWT_SECRET,
      user,
      res,
      `${user.first_name} ${user.last_name} logged in`
    );

  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({
      status: false,
      message: 'Server error',
    });
  }
};

//======logout======
export const logout = async (req, res) => {
  try {
    res.clearCookie('admin_token', {
      httpOnly: true,
      sameSite: 'none',
      secure: true
    });

    return res.status(200).json({
      status: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout Error:', error.message);
    res.status(500).json({
      status: false,
      message: 'Server error during logout',
    });
  }
};

//=====forgotPassword====
export const sendResetOtp = async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ status: false, message: 'Email or phone is required' });
  }

  try {
    let query = '';
    let value = '';
    if (email) {
      query = 'SELECT * FROM hr_users WHERE email = ?';
      value = email;
    } else {
      query = 'SELECT * FROM hr_users WHERE phone = ?';
      value = phone;
    }

    const [result] = await con.query(query, [value]);

    if (result.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const otp = generateOTP();

    if (email) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAILER_HOST,
        port: Number(process.env.MAILER_PORT),
        secure: false,
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASSWORD,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
      });

      const mailOptions = {
        from: `"${process.env.MAILER_SENDER_NAME}" <${process.env.MAILER_USER}>`,
        to: email,
        subject: 'Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}`,
      };

      await transporter.sendMail(mailOptions);

      await con.query(
        'INSERT INTO hr_mail_otp (mail, otp, create_time) VALUES (?, ?, NOW())',
        [email, otp]
      );
    }

    if (phone) {
      await client.messages.create({
        body: `Your OTP for password reset is: ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone.startsWith('+') ? phone : `+91${phone}`,
      });

      // Optional: Insert into phone OTP table here
    }

    return res.status(200).json({
      status: true,
      message: 'OTP sent successfully',
    });

  } catch (error) {
    console.error('Error in sendResetOtp:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};

//==== resendResetOtp====
export const resendResetOtp = async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ status: false, message: 'Email or phone is required' });
  }

  try {
    let query = '';
    let value = '';

    if (email) {
      query = 'SELECT * FROM hr_users WHERE email = ?';
      value = email;
    } else {
      query = 'SELECT * FROM hr_users WHERE phone = ?';
      value = phone;
    }

    const [result] = await con.query(query, [value]);

    if (result.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const otp = generateOTP();

    if (email) {
      const transporter = nodemailer.createTransport({
        host: process.env.MAILER_HOST.replace(/'/g, ''),
        port: parseInt(process.env.MAILER_PORT.replace(/'/g, '')),
        secure: false,
        auth: {
          user: process.env.MAILER_USER,
          pass: process.env.MAILER_PASSWORD,
        },
      });

      const mailOptions = {
        from: `"${process.env.MAILER_SENDER_NAME}" <${process.env.MAILER_USER}>`,
        to: email,
        subject: 'Resend OTP - Password Reset',
        text: `Your OTP for password reset is: ${otp}`,
      };

      await transporter.sendMail(mailOptions);
    }

    if (phone) {
      await client.messages.create({
        body: `Your OTP for password reset is: ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone.startsWith('+') ? phone : `+91${phone}`,
      });
    }

    const insertOtpQuery = `INSERT INTO hr_mail_otp (mail, otp, create_time) VALUES (?, ?, NOW())`;
    await con.query(insertOtpQuery, [email, otp]);

    return res.status(200).json({
      status: true,
      message: 'OTP resent successfully',
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};

//==== verify OTP====
export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ status: false, message: 'Email and OTP are required' });
  }

  try {
    // 1. Get OTP from DB
    const [result] = await con.query(
      'SELECT * FROM hr_mail_otp WHERE mail = ? AND otp = ?',
      [email, otp]
    );

    if (result.length === 0) {
      return res.status(400).json({ status: false, message: 'Invalid OTP' });
    }

    // 2. Delete OTP row after successful verification
    await con.query('DELETE FROM hr_mail_otp WHERE mail = ?', [email]);

    return res.status(200).json({
      status: true,
      message: 'OTP verified successfully',
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};

//==== update password email=====
export const resetPassword = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: false,
      message: "Email and new password are required."
    });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update query
    const query = "UPDATE hr_users SET password = ? WHERE email = ?";
    const params = [hashedPassword, email];

    const [result] = await con.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "User not found."
      });
    }

    res.json({
      status: true,
      message: "Password reset successfully."
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      status: false,
      message: "Server error."
    });
  }
};

//======country list ======
export const getCountries = async (req, res) => {
  try {
    const [rows] = await con.query(
      `SELECT * FROM hr_countries WHERE phonecode > 0 AND is_active = '1' ORDER BY hr_countries.name DESC`
    );

    return res.status(200).json({
      status: true,
      message: 'Active countries fetched successfully',
      data: rows,
    });
  } catch (error) {
    console.error('Get Active Countries Error:', error.message);
    return res.status(500).json({
      status: false,
      message: 'Server error while fetching active countries',
    });
  }
};

//======= forgotPassword phone=====
export const forgotPasswordPhone = async (req, res) => {
  const { mobile, country_id } = req.body;

  if (!mobile || !country_id) {
    return res.status(400).json({ status: false, message: 'Phone number and country ID are required' });
  }

  try {
    // Check if user exists with given phone number
    const [users] = await con.query(
      'SELECT * FROM hr_users WHERE mobile = ?',
      [mobile]
    );

    if (users.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found with this phone number' });
    }

    // Generate OTP
    const otp = generateOTP();

    // Format phone number with +country_code
    const [countries] = await con.query(
      'SELECT phonecode FROM hr_countries WHERE id = ?',
      [country_id]
    );

    if (countries.length === 0) {
      return res.status(400).json({ status: false, message: 'Invalid country ID' });
    }

    const countryCode = countries[0].phonecode;
    const formattedPhone = mobile.startsWith('+') ? mobile : `+${countryCode}${mobile}`;

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your OTP for password reset is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    // Save OTP in hr_otp table
    await con.query(
      'INSERT INTO hr_otp (country_id, mobile, otp, create_time) VALUES (?, ?, ?, NOW())',
      [country_id, mobile, otp]
    );

    return res.status(200).json({
      status: true,
      message: 'OTP sent successfully',
    });

  } catch (error) {
    console.error("Error in sendForgotPasswordOtp:", error);
    return res.status(500).json({
      status: false,
      message: 'Internal server error',
    });
  }
};

//===== update password phone ===
export const updatePassword = async (req, res) => {
  try {
    const { country_id, country_code, mobile, password } = req.body;

    if (!country_id || !country_code || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [rows] = await con.query(
      `SELECT id FROM hr_users WHERE country_id = ? AND country_code = ? AND mobile = ?`,
      [country_id, country_code, mobile]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await con.query(
      `UPDATE hr_users SET password = ? WHERE id = ?`,
      [hashedPassword, rows[0].id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Password not updated" });
    }

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

//==== change password====
export const changePassword = async (req, res) => {
  try {
    const { id, old_password, confirm_password } = req.body;

    if (!id || !old_password || !confirm_password) {
      return res.status(400).json({ status: false, message: "All fields are required" });
    }

    // 1. Get user by ID
    const [rows] = await con.query(
      "SELECT password FROM hr_users WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const hashedPassword = rows[0].password;

    // 2. Compare old password
    const isMatch = await bcrypt.compare(old_password, hashedPassword);
    if (!isMatch) {
      return res.status(400).json({ status: false, message: "Old password is incorrect" });
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHashedPassword = await bcrypt.hash(confirm_password, salt);

    // 4. Update password in DB
    await con.query(
      "UPDATE hr_users SET password = ? WHERE id = ?",
      [newHashedPassword, id]
    );

    return res.status(200).json({ status: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
