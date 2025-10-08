import con from '../db/db.js';

//===== order list====
export const orderDetails = async (req, res) => {
   const { vendor_id } = req.query;

   if (!vendor_id) {
      return res.status(400).json({ status: false, message: "vendor_id is required" });
   }

   try {
      const [orders] = await con.query(
         `SELECT
            o.oid AS order_id,
            o.user_id,
            u.first_name,
            u.last_name,
            o.total_amount,
            o.status,
            o.shipping_address,
            o.billing_address,
            o.payment_method,
            o.delivery_amount,
            o.discount,
            o.tax_amount,
            o.created_time
         FROM hr_order o
         JOIN hr_users u ON o.user_id = u.id
         WHERE o.vendor_id = ?
           AND o.payment_status = 'completed'`,   
         [vendor_id]
      );

      for (let order of orders) {
         const [items] = await con.query(
            `SELECT
               oiid,
               product_name,
               quantity,
               total_amount,
               status,
               vendor_notes
             FROM hr_order_item
             WHERE order_id = ?`,
            [order.order_id]
         );
         order.items = items;
      }

      return res.status(200).json({ status: true, data: orders });
   } catch (error) {
      console.error("Error fetching order details:", error);
      return res.status(500).json({ status: false, message: "Internal server error" });
   }
};

//==== status update=====
// export const updateOrderStatus = async (req, res) => {
//    const { order_id, item_id } = req.query;
//    const { action, reason } = req.body;

//    if (!order_id || !item_id || !['accept', 'reject'].includes(action)) {
//       return res.status(400).json({ status: false, message: "Invalid parameters" });
//    }

//    try {
//       let itemStatus;
//       let orderStatus = null;

//       if (action === 'accept') {
//          itemStatus = 1;
//       } else {
//          itemStatus = 2;
//       }

//       await con.query(
//          "UPDATE hr_order_item SET status = ?, vendor_notes = ? WHERE order_id = ? AND oiid = ?",
//          [itemStatus, action === 'reject' ? reason : null, order_id, item_id]
//       );

//       const [items] = await con.query(
//          "SELECT status FROM hr_order_item WHERE order_id = ?",
//          [order_id]
//       );

//       const totalItems = items.length;
//       const acceptedCount = items.filter(it => it.status === 1).length;
//       const rejectedCount = items.filter(it => it.status === 2).length;
//       const pendingCount = items.filter(it => it.status === 0).length;

//       if (totalItems === 1) {
//          orderStatus = (action === 'accept') ? 2 : 6;
//          await con.query("UPDATE hr_order SET status = ? WHERE oid = ?", [orderStatus, order_id]);
//       } else {
//          if (pendingCount === 0) {
//             if (acceptedCount > 0 && rejectedCount > 0) {
//                orderStatus = 2;
//             } else if (acceptedCount === 0 && rejectedCount > 0) {
//                orderStatus = 6;
//             } else if (acceptedCount > 0 && rejectedCount === 0) {
//                orderStatus = 2;
//             }
//             if (orderStatus !== null) {
//                await con.query("UPDATE hr_order SET status = ? WHERE oid = ?", [orderStatus, order_id]);
//             }
//          }
//       }

//       // ✅ Run delivery selection query only when status is updated to 2
//       if (orderStatus === 2) {
//          const [nearestDeliveryBoys] = await con.query(
//             `
//             SELECT
//                 u.id AS delivery_id,
//                 u.latitude AS delivery_lat,
//                 u.longitude AS delivery_lng,
//                 o.oid,
//                 o.latitude AS customer_lat,
//                 o.longitude AS customer_lng,
//                 v.id AS vendor_id,
//                 v.latitude AS vendor_lat,
//                 v.longitude AS vendor_lng,
//                 (6371 * ACOS(
//                     COS(RADIANS(o.latitude))
//                     * COS(RADIANS(v.latitude))
//                     * COS(RADIANS(v.longitude) - RADIANS(o.longitude))
//                     + SIN(RADIANS(o.latitude))
//                     * SIN(RADIANS(v.latitude))
//                 )) AS venor_customer_distance_km,
//                 (6371 * ACOS(
//                     COS(RADIANS(o.latitude))
//                     * COS(RADIANS(u.latitude))
//                     * COS(RADIANS(u.longitude) - RADIANS(o.longitude))
//                     + SIN(RADIANS(o.latitude))
//                     * SIN(RADIANS(u.latitude))
//                 )) AS venor_rider_distance_km
//             FROM deligo.hr_users u
//             JOIN deligo.hr_order o
//                 ON o.oid = ?
//             JOIN deligo.hr_users v
//                 ON v.id = o.vendor_id
//             WHERE u.role_id = 6
//               AND u.id NOT IN (
//                   SELECT delivery_id
//                   FROM deligo.hr_order
//                   WHERE delivery_id > 0
//                     AND status < 5
//               )
//             ORDER BY venor_rider_distance_km ASC
//             LIMIT 5
//             `,
//             [order_id]
//          );

//          // ✅ Insert the results into hr_delivery_boy
//          for (const row of nearestDeliveryBoys) {
//             await con.query(
//                `INSERT INTO hr_delivery_boy
//                   (orderid, userid, delivery_to_vendor, vendor_to_customer, create_time)
//                 VALUES (?, ?, ?, ?, NOW())`,
//                [row.oid, row.delivery_id, row.venor_rider_distance_km, row.venor_customer_distance_km]
//             );
//          }

//          return res.status(200).json({
//             status: true,
//             message: "Order item updated successfully & delivery boys assigned",
//             nearestDeliveryBoys
//          });
//       }

//       return res.status(200).json({
//          status: true,
//          message: "Order item updated successfully",
//       });

//    } catch (error) {
//       console.error("Update error:", error);
//       return res.status(500).json({
//          status: false,
//          message: "Server error while updating order item status",
//       });
//    }
// };


export const updateOrderStatus = async (req, res) => {
   const { order_id, item_id } = req.query;
   const { action, reason } = req.body;

   if (!order_id || !item_id || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ status: false, message: "Invalid parameters" });
   }

   try {
      let itemStatus;
      let orderStatus = null;

      if (action === 'accept') {
         itemStatus = 1;
      } else {
         itemStatus = 2;
      }

      // Update order item status
      await con.query(
         "UPDATE hr_order_item SET status = ?, vendor_notes = ? WHERE order_id = ? AND oiid = ?",
         [itemStatus, action === 'reject' ? reason : null, order_id, item_id]
      );

      // Get all items of this order
      const [items] = await con.query(
         "SELECT status FROM hr_order_item WHERE order_id = ?",
         [order_id]
      );

      const totalItems = items.length;
      const acceptedCount = items.filter(it => it.status === 1).length;
      const rejectedCount = items.filter(it => it.status === 2).length;
      const pendingCount = items.filter(it => it.status === 0).length;

      // Determine final order status
      if (totalItems === 1) {
         orderStatus = (action === 'accept') ? 2 : 6;
         await con.query("UPDATE hr_order SET status = ? WHERE oid = ?", [orderStatus, order_id]);
      } else {
         if (pendingCount === 0) {
            if (acceptedCount > 0 && rejectedCount > 0) {
               orderStatus = 2;
            } else if (acceptedCount === 0 && rejectedCount > 0) {
               orderStatus = 6;
            } else if (acceptedCount > 0 && rejectedCount === 0) {
               orderStatus = 2;
            }
            if (orderStatus !== null) {
               await con.query("UPDATE hr_order SET status = ? WHERE oid = ?", [orderStatus, order_id]);
            }
         }
      }

      // Add notification based on order status
      if (orderStatus === 2 || orderStatus === 6) {
         const title = orderStatus === 2 ? "Vendor accepted your order" : "Vendor rejected your order";

         // Get user_id of this order
         const [orderData] = await con.query(
            "SELECT user_id FROM hr_order WHERE oid = ?",
            [order_id]
         );

         if (orderData.length > 0) {
            const userId = orderData[0].user_id;

            // Insert notification
            await con.query(
               "INSERT INTO hr_notification (user_id, title, readwrite, create_time) VALUES (?, ?, 0, NOW())",
               [userId, title]
            );
         }
      }

      // Delivery assignment logic only if status = 2
      if (orderStatus === 2) {
         const [nearestDeliveryBoys] = await con.query(
            `
            SELECT
                u.id AS delivery_id,
                u.latitude AS delivery_lat,
                u.longitude AS delivery_lng,
                o.oid,
                o.latitude AS customer_lat,
                o.longitude AS customer_lng,
                v.id AS vendor_id,
                v.latitude AS vendor_lat,
                v.longitude AS vendor_lng,
                (6371 * ACOS(
                    COS(RADIANS(o.latitude))
                    * COS(RADIANS(v.latitude))
                    * COS(RADIANS(v.longitude) - RADIANS(o.longitude))
                    + SIN(RADIANS(o.latitude))
                    * SIN(RADIANS(v.latitude))
                )) AS venor_customer_distance_km,
                (6371 * ACOS(
                    COS(RADIANS(o.latitude))
                    * COS(RADIANS(u.latitude))
                    * COS(RADIANS(u.longitude) - RADIANS(o.longitude))
                    + SIN(RADIANS(o.latitude))
                    * SIN(RADIANS(u.latitude))
                )) AS venor_rider_distance_km
            FROM deligo.hr_users u
            JOIN deligo.hr_order o
                ON o.oid = ?
            JOIN deligo.hr_users v
                ON v.id = o.vendor_id
            WHERE u.role_id = 6
              AND u.id NOT IN (
                  SELECT delivery_id
                  FROM deligo.hr_order
                  WHERE delivery_id > 0
                    AND status < 5
              )
            ORDER BY venor_rider_distance_km ASC
            LIMIT 5
            `,
            [order_id]
         );

         // Insert nearest delivery boys
         for (const row of nearestDeliveryBoys) {
            await con.query(
               `INSERT INTO hr_delivery_boy
                  (orderid, userid, delivery_to_vendor, vendor_to_customer, create_time)
                VALUES (?, ?, ?, ?, NOW())`,
               [row.oid, row.delivery_id, row.venor_rider_distance_km, row.venor_customer_distance_km]
            );
         }

         return res.status(200).json({
            status: true,
            message: "Order item updated successfully & delivery boys assigned",
            nearestDeliveryBoys
         });
      }

      return res.status(200).json({
         status: true,
         message: "Order item updated successfully",
      });

   } catch (error) {
      console.error("Update error:", error);
      return res.status(500).json({
         status: false,
         message: "Server error while updating order item status",
      });
   }
};


//==== Delivery boy otp verify =====
// export const verifyDeliveryOtp = async (req, res) => {
//    const { oid, vendor_id } = req.query;
//    const { otp } = req.body;

//    if (!oid || !vendor_id || !otp) {
//       return res.status(400).json({
//          status: false,
//          message: "Invalid parameters. oid, vendor_id and otp are required",
//       });
//    }

//    try {
//       const [orders] = await con.query(
//          "SELECT delivery_otp FROM hr_order WHERE oid = ? AND vendor_id = ?",
//          [oid, vendor_id]
//       );

//       if (orders.length === 0) {
//          return res.status(404).json({
//             status: false,
//             message: "Order not found",
//          });
//       }

//       const dbOtp = orders[0].delivery_otp;

//       // Ensure both are compared as numbers (or as strings, but consistently)
//       if (parseInt(dbOtp) !== parseInt(otp)) {
//          return res.status(400).json({
//             status: false,
//             message: "Invalid OTP",
//          });
//       }

//       await con.query(
//          "UPDATE hr_order SET status = 3 WHERE oid = ? AND vendor_id = ?",
//          [oid, vendor_id]
//       );

//       return res.status(200).json({
//          status: true,
//          message: "OTP verified successfully.",
//       });

//    } catch (error) {
//       console.error("Verify OTP error:", error);
//       return res.status(500).json({
//          status: false,
//          message: "Server error while verifying OTP",
//       });
//    }
// };


export const verifyDeliveryOtp = async (req, res) => {
  const { oid, vendor_id } = req.query;
  const { otp } = req.body;

  if (!oid || !vendor_id || !otp) {
    return res.status(400).json({
      status: false,
      message: "Invalid parameters. oid, vendor_id, and otp are required",
    });
  }

  try {
    const [orders] = await con.query(
      "SELECT delivery_otp, user_id FROM hr_order WHERE oid = ? AND vendor_id = ?",
      [oid, vendor_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    const { delivery_otp, user_id } = orders[0];

    // Compare OTPs safely
    if (parseInt(delivery_otp) !== parseInt(otp)) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    // Update order status to 3 (Delivered)
    await con.query(
      "UPDATE hr_order SET status = 3 WHERE oid = ? AND vendor_id = ?",
      [oid, vendor_id]
    );

    // ✅ Insert notification when status becomes 3
    const title = "Delivery person received your item";
    await con.query(
      "INSERT INTO hr_notification (user_id, title, readwrite, create_time) VALUES (?, ?, 0, NOW())",
      [user_id, title]
    );

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully. Notification sent.",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error while verifying OTP",
    });
  }
};

//===== All status update=====
// export const itemUpdateStatus = async (req, res) => {
//    const { order_id } = req.query;
//    const { action, reason, oiid } = req.body; // oiid should be array

//    if (!order_id || !Array.isArray(oiid) || oiid.length === 0 || !['accept', 'reject'].includes(action)) {
//       return res.status(400).json({ status: false, message: "Invalid parameters" });
//    }

//    try {
//       let itemStatus = (action === 'accept') ? 1 : 2;
//       let orderStatus = null;

//       // ✅ Update only selected oiid items
//       const placeholders = oiid.map(() => '?').join(',');
//       await con.query(
//          `UPDATE hr_order_item SET status = ?, vendor_notes = ?
//           WHERE order_id = ? AND oiid IN (${placeholders})`,
//          [itemStatus, action === 'reject' ? reason : null, order_id, ...oiid]
//       );

//       // ✅ Fetch all items for this order
//       const [items] = await con.query(
//          "SELECT status FROM hr_order_item WHERE order_id = ?",
//          [order_id]
//       );

//       const totalItems = items.length;
//       const acceptedCount = items.filter(it => it.status === 1).length;
//       const rejectedCount = items.filter(it => it.status === 2).length;
//       const pendingCount = items.filter(it => it.status === 0).length;

//       // ✅ Decide order status
//       if (totalItems === 1) {
//          orderStatus = (action === 'accept') ? 2 : 6;
//       } else {
//          if (pendingCount === 0) {
//             if (acceptedCount > 0 && rejectedCount > 0) {
//                orderStatus = 2; // mixed accept + reject → still process
//             } else if (acceptedCount === 0 && rejectedCount > 0) {
//                orderStatus = 6; // all rejected
//             } else if (acceptedCount > 0 && rejectedCount === 0) {
//                orderStatus = 2; // all accepted
//             }
//          }
//       }

//       if (orderStatus !== null) {
//          await con.query(
//             "UPDATE hr_order SET status = ? WHERE oid = ?",
//             [orderStatus, order_id]
//          );
//       }

//       return res.status(200).json({
//          status: true,
//          message: "Selected order items updated successfully",
//       });

//    } catch (error) {
//       console.error("Multi update error:", error);
//       return res.status(500).json({
//          status: false,
//          message: "Server error while updating multiple items",
//       });
//    }
// };


// export const itemUpdateStatus = async (req, res) => {
//    const { order_id } = req.query;
//    const { action, reason, oiid } = req.body; // oiid should be array

//    if (!order_id || !Array.isArray(oiid) || oiid.length === 0 || !['accept', 'reject'].includes(action)) {
//       return res.status(400).json({ status: false, message: "Invalid parameters" });
//    }

//    try {
//       let itemStatus = (action === 'accept') ? 1 : 2;
//       let orderStatus = null;

//       // ✅ Update only selected oiid items
//       const placeholders = oiid.map(() => '?').join(',');
//       await con.query(
//          `UPDATE hr_order_item SET status = ?, vendor_notes = ?
//           WHERE order_id = ? AND oiid IN (${placeholders})`,
//          [itemStatus, action === 'reject' ? reason : null, order_id, ...oiid]
//       );

//       // ✅ Fetch all items for this order
//       const [items] = await con.query(
//          "SELECT status FROM hr_order_item WHERE order_id = ?",
//          [order_id]
//       );

//       const totalItems = items.length;
//       const acceptedCount = items.filter(it => it.status === 1).length;
//       const rejectedCount = items.filter(it => it.status === 2).length;
//       const pendingCount = items.filter(it => it.status === 0).length;

//       // ✅ Decide order status
//       if (totalItems === 1) {
//          orderStatus = (action === 'accept') ? 2 : 6;
//       } else {
//          if (pendingCount === 0) {
//             if (acceptedCount > 0 && rejectedCount > 0) {
//                orderStatus = 2; // mixed accept + reject → still process
//             } else if (acceptedCount === 0 && rejectedCount > 0) {
//                orderStatus = 6; // all rejected
//             } else if (acceptedCount > 0 && rejectedCount === 0) {
//                orderStatus = 2; // all accepted
//             }
//          }
//       }

//       if (orderStatus !== null) {
//          await con.query(
//             "UPDATE hr_order SET status = ? WHERE oid = ?",
//             [orderStatus, order_id]
//          );

//          // ✅ If order is ready for processing → assign nearest delivery boys
//          if (orderStatus === 2) {
//             const [nearestDeliveryBoys] = await con.query(
//                `
//                SELECT
//                    u.id AS delivery_id,
//                    u.latitude AS delivery_lat,
//                    u.longitude AS delivery_lng,
//                    o.oid,
//                    o.latitude AS customer_lat,
//                    o.longitude AS customer_lng,
//                    v.id AS vendor_id,
//                    v.latitude AS vendor_lat,
//                    v.longitude AS vendor_lng,
//                    (6371 * ACOS(
//                        COS(RADIANS(o.latitude))
//                        * COS(RADIANS(v.latitude))
//                        * COS(RADIANS(v.longitude) - RADIANS(o.longitude))
//                        + SIN(RADIANS(o.latitude))
//                        * SIN(RADIANS(v.latitude))
//                    )) AS venor_customer_distance_km,
//                    (6371 * ACOS(
//                        COS(RADIANS(o.latitude))
//                        * COS(RADIANS(u.latitude))
//                        * COS(RADIANS(u.longitude) - RADIANS(o.longitude))
//                        + SIN(RADIANS(o.latitude))
//                        * SIN(RADIANS(u.latitude))
//                    )) AS venor_rider_distance_km
//                FROM deligo.hr_users u
//                JOIN deligo.hr_order o
//                    ON o.oid = ?
//                JOIN deligo.hr_users v
//                    ON v.id = o.vendor_id
//                WHERE u.role_id = 6
//                  AND u.id NOT IN (
//                      SELECT delivery_id
//                      FROM deligo.hr_order
//                      WHERE delivery_id > 0
//                        AND status < 5
//                  )
//                ORDER BY venor_rider_distance_km ASC
//                LIMIT 5
//                `,
//                [order_id]
//             );

//             for (const row of nearestDeliveryBoys) {
//                await con.query(
//                   `INSERT INTO hr_delivery_boy
//                      (orderid, userid, delivery_to_vendor, vendor_to_customer, create_time)
//                    VALUES (?, ?, ?, ?, NOW())`,
//                   [row.oid, row.delivery_id, row.venor_rider_distance_km, row.venor_customer_distance_km]
//                );
//             }

//             return res.status(200).json({
//                status: true,
//                message: "Selected order items updated & delivery boys assigned",
//                nearestDeliveryBoys
//             });
//          }
//       }

//       return res.status(200).json({
//          status: true,
//          message: "Selected order items updated successfully"
//       });

//    } catch (error) {
//       console.error("Multi update error:", error);
//       return res.status(500).json({
//          status: false,
//          message: "Server error while updating multiple items",
//       });
//    }
// };


export const itemUpdateStatus = async (req, res) => {
   const { order_id } = req.query;
   const { action, reason, oiid } = req.body; // oiid should be array

   if (!order_id || !Array.isArray(oiid) || oiid.length === 0 || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ status: false, message: "Invalid parameters" });
   }

   try {
      let itemStatus = (action === 'accept') ? 1 : 2;
      let orderStatus = null;

      // ✅ Update only selected oiid items
      const placeholders = oiid.map(() => '?').join(',');
      await con.query(
         `UPDATE hr_order_item SET status = ?, vendor_notes = ?
          WHERE order_id = ? AND oiid IN (${placeholders})`,
         [itemStatus, action === 'reject' ? reason : null, order_id, ...oiid]
      );

      // ✅ Fetch all items for this order
      const [items] = await con.query(
         "SELECT status FROM hr_order_item WHERE order_id = ?",
         [order_id]
      );

      const totalItems = items.length;
      const acceptedCount = items.filter(it => it.status === 1).length;
      const rejectedCount = items.filter(it => it.status === 2).length;
      const pendingCount = items.filter(it => it.status === 0).length;

      // ✅ Decide final order status
      if (totalItems === 1) {
         orderStatus = (action === 'accept') ? 2 : 6;
      } else {
         if (pendingCount === 0) {
            if (acceptedCount > 0 && rejectedCount > 0) {
               orderStatus = 2; // mixed accept + reject → still process
            } else if (acceptedCount === 0 && rejectedCount > 0) {
               orderStatus = 6; // all rejected
            } else if (acceptedCount > 0 && rejectedCount === 0) {
               orderStatus = 2; // all accepted
            }
         }
      }

      // ✅ Update hr_order if orderStatus determined
      if (orderStatus !== null) {
         await con.query(
            "UPDATE hr_order SET status = ? WHERE oid = ?",
            [orderStatus, order_id]
         );

         // ✅ Insert notification logic
         if (orderStatus === 2 || orderStatus === 6) {
            const title = orderStatus === 2 ? "Vendor accepted your order" : "Vendor rejected your order";

            // Fetch user_id of this order
            const [orderData] = await con.query(
               "SELECT user_id FROM hr_order WHERE oid = ?",
               [order_id]
            );

            if (orderData.length > 0) {
               const userId = orderData[0].user_id;

               // ✅ Try to insert notification safely (handle both cases: auto_increment or manual nid)
               try {
                  await con.query(
                     "INSERT INTO hr_notification (user_id, title, readwrite, create_time, modified_time) VALUES (?, ?, 0, NOW(), NOW())",
                     [userId, title]
                  );
               } catch (err) {
                  // if nid not auto-incremented, generate manually
                  if (err.code === 'ER_NO_DEFAULT_FOR_FIELD') {
                     const [maxIdResult] = await con.query("SELECT IFNULL(MAX(nid), 0) + 1 AS newId FROM hr_notification");
                     const newId = maxIdResult[0].newId;
                     await con.query(
                        "INSERT INTO hr_notification (nid, user_id, title, readwrite, create_time, modified_time) VALUES (?, ?, ?, 0, NOW(), NOW())",
                        [newId, userId, title]
                     );
                  } else {
                     console.error("Notification insert error:", err);
                  }
               }
            }
         }

         // ✅ If order accepted → assign delivery boys
         if (orderStatus === 2) {
            const [nearestDeliveryBoys] = await con.query(
               `
               SELECT
                   u.id AS delivery_id,
                   u.latitude AS delivery_lat,
                   u.longitude AS delivery_lng,
                   o.oid,
                   o.latitude AS customer_lat,
                   o.longitude AS customer_lng,
                   v.id AS vendor_id,
                   v.latitude AS vendor_lat,
                   v.longitude AS vendor_lng,
                   (6371 * ACOS(
                       COS(RADIANS(o.latitude))
                       * COS(RADIANS(v.latitude))
                       * COS(RADIANS(v.longitude) - RADIANS(o.longitude))
                       + SIN(RADIANS(o.latitude))
                       * SIN(RADIANS(v.latitude))
                   )) AS venor_customer_distance_km,
                   (6371 * ACOS(
                       COS(RADIANS(o.latitude))
                       * COS(RADIANS(u.latitude))
                       * COS(RADIANS(u.longitude) - RADIANS(o.longitude))
                       + SIN(RADIANS(o.latitude))
                       * SIN(RADIANS(u.latitude))
                   )) AS venor_rider_distance_km
               FROM deligo.hr_users u
               JOIN deligo.hr_order o
                   ON o.oid = ?
               JOIN deligo.hr_users v
                   ON v.id = o.vendor_id
               WHERE u.role_id = 6
                 AND u.id NOT IN (
                     SELECT delivery_id
                     FROM deligo.hr_order
                     WHERE delivery_id > 0
                       AND status < 5
                 )
               ORDER BY venor_rider_distance_km ASC
               LIMIT 5
               `,
               [order_id]
            );

            for (const row of nearestDeliveryBoys) {
               await con.query(
                  `INSERT INTO hr_delivery_boy
                     (orderid, userid, delivery_to_vendor, vendor_to_customer, create_time)
                   VALUES (?, ?, ?, ?, NOW())`,
                  [row.oid, row.delivery_id, row.venor_rider_distance_km, row.venor_customer_distance_km]
               );
            }

            return res.status(200).json({
               status: true,
               message: "Selected order items updated & delivery boys assigned",
               nearestDeliveryBoys
            });
         }
      }

      return res.status(200).json({
         status: true,
         message: "Selected order items updated successfully"
      });

   } catch (error) {
      console.error("Multi update error:", error);
      return res.status(500).json({
         status: false,
         message: "Server error while updating multiple items",
      });
   }
};

