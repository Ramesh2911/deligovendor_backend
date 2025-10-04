import con from '../db/db.js';
import { uploadToS3 } from '../utils/s3.js';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/awsConfig.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";

async function getImageUrl(key) {
  if (!key) return null;
  const cleanedKey = key.replace(/^https?:\/\/[^/]+\/[^/]+\//, "");

  const command = new GetObjectCommand({
    Bucket: "deligo.image",
    Key: cleanedKey, 
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

//=====addProduct=====
export const addProduct = async (req, res) => {
  try {
    const {
      product_cat,
      product_sub_cat,
      vendor_id,
      product_name,
      product_short,
      product_desc,
      mrp_price,
      price,
      sku,
      brand,
      stock_quantity,
      product_unit_id,
      is_active,
      tax,          
      tax_amount,   
    } = req.body;

    const errors = [];

    if (!product_cat) errors.push("Product category is required");
    if (!product_sub_cat) errors.push("Product sub-category is required");
    if (!vendor_id) errors.push("Vendor ID is required");
    if (!product_name?.trim()) errors.push("Product name is required");
    if (!product_short?.trim()) errors.push("Short description is required");
    if (!product_desc?.trim()) errors.push("Product description is required");
    if (!mrp_price || isNaN(parseFloat(mrp_price)))
      errors.push("MRP price is invalid");
    if (!price || isNaN(parseFloat(price)))
      errors.push("Selling price is invalid");
    if (!sku?.trim()) errors.push("SKU is required");
    if (!brand?.trim()) errors.push("Brand is required");
    if (!stock_quantity || isNaN(parseInt(stock_quantity)))
      errors.push("Stock quantity is invalid");
    if (!product_unit_id) errors.push("Product unit ID is required");
    if (typeof is_active === "undefined")
      errors.push("Active status is required");
    if (tax && isNaN(parseFloat(tax)))
      errors.push("Tax percentage is invalid");
    if (tax_amount && isNaN(parseFloat(tax_amount)))
      errors.push("Tax amount is invalid");

    if (req.file) {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      const maxSize = 5 * 1024 * 1024;

      if (!allowedTypes.includes(req.file.mimetype)) {
        errors.push("Invalid image type. Only jpg, jpeg, png are allowed");
      }

      if (req.file.size > maxSize) {
        errors.push("Image size exceeds 5MB limit");
      }
    } else {
      errors.push("Product image is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: false,
        message: "Validation failed",
        errors,
      });
    }

    let productImageKey = null;
    if (req.file) {
      const fileContent = req.file.buffer;
      const fileName = req.file.originalname;
      const mimetype = req.file.mimetype;

      productImageKey = await uploadToS3(
        fileContent,
        fileName,
        mimetype,
        "grocery/"
      );
    }

    const query = `
      INSERT INTO hr_product
      (
        product_cat,
        product_sub_cat,
        vendor_id,
        product_name,
        product_image,
        product_short,
        product_desc,
        mrp_price,
        price,
        tax_percentage,
        tax_price,
        sku,
        brand,
        stock_quantity,
        product_unit_id,
        is_active,
        created_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      product_cat,
      product_sub_cat,
      vendor_id,
      product_name,
      productImageKey,
      product_short,
      product_desc,
      mrp_price,
      price,
      tax || 0,          // store percentage
      tax_amount || 0,   // store amount
      sku,
      brand,
      stock_quantity,
      product_unit_id,
      is_active,
    ];

    const [result] = await con.query(query, values);

    res.status(200).json({
      status: true,
      message: "Product added successfully",
      productId: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

//====updateProduct=====
export const updateProduct = async (req, res) => {
  const { pid } = req.params;
  if (!pid) {
    return res.status(400).json({ status: false, message: "Product ID (pid) is required" });
  }

  try {
    const fields = [];
    const values = [];
    const errors = [];

    const allowedFields = [
      "product_cat",
      "product_sub_cat",
      "vendor_id",
      "product_name",
      "product_short",
      "product_desc",
      "mrp_price",
      "price",
      "sku",
      "brand",
      "stock_quantity",
      "product_unit_id",
      "is_active",
      "tax",
      "tax_amount",
    ];
  
    if (req.body.mrp_price && req.body.mrp_price !== '' && isNaN(parseFloat(req.body.mrp_price))) {
      errors.push("MRP price must be a valid number");
    }
    if (req.body.price && req.body.price !== '' && isNaN(parseFloat(req.body.price))) {
      errors.push("Selling price must be a valid number");
    }
    if (req.body.stock_quantity && req.body.stock_quantity !== '' && isNaN(parseInt(req.body.stock_quantity))) {
      errors.push("Stock quantity must be a valid number");
    }
    if (req.body.tax && req.body.tax !== '' && isNaN(parseFloat(req.body.tax))) {
      errors.push("Tax percentage must be a valid number");
    }
    if (req.body.tax_amount && req.body.tax_amount !== '' && isNaN(parseFloat(req.body.tax_amount))) {
      errors.push("Tax amount must be a valid number");
    }
    
    // Check if this is an actual new file upload or just existing image reference
    const isExistingImageReference = req.file && (
      req.file.originalname.includes('aws4_request') ||
      req.file.originalname.includes('amazonaws.com') ||
      req.file.originalname.startsWith('http') ||
      req.file.originalname.includes('grocery/') ||
      req.file.mimetype === 'image/*'
    );

    const isActualFileUpload = req.file && 
                              req.file.buffer && 
                              req.file.size > 0 && 
                              req.file.originalname && 
                              !isExistingImageReference;

    if (isActualFileUpload) {
      console.log("New file received for upload:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      const maxSize = 5 * 1024 * 1024; 

      if (!allowedTypes.includes(req.file.mimetype)) {
        errors.push("Invalid image type. Only jpg, jpeg, png are allowed");
      }

      if (req.file.size > maxSize) {
        errors.push("Image size exceeds 5MB limit");
      }
    } else {
      if (isExistingImageReference) {
        console.log("Detected existing image reference, skipping validation:");
        console.log("- Original name:", req.file.originalname.substring(0, 100) + "...");
        console.log("- Mimetype:", req.file.mimetype);
        console.log("- Size:", req.file.size);
      } else {
        console.log("No product image uploaded → keeping existing image");
      }
    }

    // if (errors.length > 0) {
    //   console.log("Validation Errors:", errors);
    //   return res.status(400).json({
    //     status: false,
    //     message: "Validation failed",
    //     errors,
    //   });
    // }
   
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "tax") {
          fields.push("tax_percentage = ?");
          values.push(req.body[field] || 0);
        } else if (field === "tax_amount") {
          fields.push("tax_price = ?");
          values.push(req.body[field] || 0);
        } else {
          fields.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }
    });
   
    // Only upload new image if it's an actual file upload (not existing URL)
    if (isActualFileUpload) {
      const fileContent = req.file.buffer;
      const fileName = req.file.originalname;
      const mimetype = req.file.mimetype;

      const productImageKey = await uploadToS3(fileContent, fileName, mimetype, "grocery/");
      fields.push("product_image = ?");
      values.push(productImageKey);
      console.log("New image uploaded successfully");
    }

    if (fields.length === 0) {
      return res.status(400).json({ status: false, message: "No fields to update" });
    }

    fields.push("modified_time = NOW()");
    const sql = `UPDATE hr_product SET ${fields.join(", ")} WHERE pid = ?`;
    values.push(pid);

    const [result] = await con.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


//=====vendor against product====
export const getProductsByVendor = async (req, res) => {
  let { vendor_id } = req.query;

  vendor_id = parseInt(vendor_id);
  if (!vendor_id || isNaN(vendor_id)) {
    return res
      .status(400)
      .json({ success: false, message: "vendor_id must be a valid number" });
  }

  try {
    const [results] = await con.query(
      "SELECT * FROM hr_product WHERE vendor_id = ?",
      [vendor_id]
    );

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No data available",
        data: [],
      });
    }

    const dataWithUrls = await Promise.all(
      results.map(async (product) => {
        const signedUrl = await getImageUrl(product.product_image);
        return {
          ...product,
          product_image: signedUrl,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: dataWithUrls,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

//===== get tax====
export const getTaxes = async (req, res) => {
  try {
    const [rows] = await con.query(
      "SELECT tid, tax_percentage FROM hr_tax"
    );

    return res.status(200).json({
      status: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching tax data:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch tax data",
      error: error.message,
    });
  }
};