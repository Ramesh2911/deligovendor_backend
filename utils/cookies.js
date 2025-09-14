import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/awsConfig.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import jwt from "jsonwebtoken";

async function getImageUrl(key) {
  if (!key) return null;
  const cleanedKey = key.replace(/^https?:\/\/[^/]+\/[^/]+\//, "");

  const command = new GetObjectCommand({
    Bucket: "deligo.image",
    Key: cleanedKey, 
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

//===== Admin cookie===== 
export const adminCookie = async (jwt_secret, user, res, message) => {
  const expiresIn = 30 * 24 * 60 * 60 * 1000;
  const token = jwt.sign(
    { id: user.id, email: user.email },
    jwt_secret,
    { expiresIn: '30d' }
  );

  const expiresAt = new Date(Date.now() + expiresIn);
 
  const profile_picture = await getImageUrl(user.profile_picture);
  const shop_logo = await getImageUrl(user.shop_logo);
  const shop_banner = await getImageUrl(user.shop_banner);
  const nif_doc = await getImageUrl(user.nif_doc);
  const health_license = await getImageUrl(user.health_license);
  const bank_doc = await getImageUrl(user.bank_doc);

  res.status(200)
    .cookie('admin_token', token, {
      httpOnly: true,
      maxAge: expiresIn,
      sameSite: 'none',
      secure: true
    })
    .json({
      status: true,
      message,
      user: {
        prefix: user.prefix,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        mobile: user.mobile,
        id: user.id,
        business_type_id: user.business_type_id,
        is_online: user.is_online,
        is_admin_verify: user.is_admin_verify,
        business_name: user.business_name,
        address: user.address,
        pincode: user.pincode,
        profile_picture,
        nif_doc,
        health_license,
        shop_logo,
        shop_banner,
        bank_doc,
        company_name: user.company_name,
        category_name: user.category_name,
        country_name: user.country_name,
        country_id: user.country_id,
        nif: user.nif,
        business_person: user.business_person,
        contact_mail: user.contact_mail,
        contact_mobile: user.contact_mobile,
        bank_id: user.bank_id,
        account_no: user.account_no,
        latitude: user.latitude,
        longitude: user.longitude,
        rating: user.rating,
        token,
        token_expires_at: expiresAt.toISOString()
      }
    });
};
