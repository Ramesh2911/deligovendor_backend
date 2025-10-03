import con from '../db/db.js';

//===== vendor Status=====
export const vendorStats = async (req, res) => {
  const { vendor_id } = req.query;

  if (!vendor_id) {
    return res.status(400).json({ status: false, message: 'vendor_id is required' });
  }

  try {
    const [isActiveCounts] = await con.query(`
      SELECT
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_count
      FROM hr_product
      WHERE vendor_id = ?
    `, [vendor_id]);
   
    const [statusCounts] = await con.query(`
      SELECT status, COUNT(*) as count
      FROM hr_order
      WHERE vendor_id = ?
      GROUP BY status
    `, [vendor_id]);
   
    const [todayAmount] = await con.query(`
      SELECT IFNULL(SUM(total_sale_amount - total_admin_revinue), 0) AS today_total
      FROM hr_vendor_commission
      WHERE vendor_id = ?
        AND DATE(created_time) = CURDATE()
    `, [vendor_id]);
    
    const [lastWeekAmount] = await con.query(`
      SELECT IFNULL(SUM(total_sale_amount - total_admin_revinue), 0) AS last_week_total
      FROM hr_vendor_commission
      WHERE vendor_id = ?
        AND YEARWEEK(created_time, 1) = YEARWEEK(CURDATE(), 1) - 1
    `, [vendor_id]);
    
    const statusData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    statusCounts.forEach(row => {
      statusData[row.status] = row.count;
    });

    res.status(200).json({
      status: true,
      message: 'Vendor data fetched successfully',
      data: {
        product_counts: {
          active: isActiveCounts[0].active_count,
          inactive: isActiveCounts[0].inactive_count
        },
        order_status: statusData,
        total_amount: {
          today: parseFloat(todayAmount[0].today_total).toFixed(2),
          last_week: parseFloat(lastWeekAmount[0].last_week_total).toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ status: false, message: 'Server Error', error: error.message });
  }
};

//===== shop Status====
export const updateShopStatus = async (req, res) => {
   const { id } = req.query;
   const { is_online } = req.body;

   if (!id || is_online === undefined) {
      return res.status(400).json({
         status: false,
         message: 'Missing id or is_online',
      });
   }

   try {
      const [result] = await con.query(
         'UPDATE hr_users SET is_online = ? WHERE id = ?',
         [is_online, id]
      );

      if (result.affectedRows === 0) {
         return res.status(404).json({ status: false, message: 'User not found' });
      }

      return res.status(200).json({ status: true, message: 'Shop status updated' });
   } catch (error) {
      console.error('Update error:', error);
      return res.status(500).json({ status: false, message: 'Server error' });
   }
};

//===== notification status update ======
export const getOrders = async (req, res) => {
   try {
      const { vendor_id } = req.query;

      if (!vendor_id) {
         return res.status(400).json({
            status: false,
            message: 'vendor_id is required'
         });
      }

      const [results] = await con.query(`
            SELECT *
            FROM hr_order
            WHERE vendor_id = ?
              AND status = 1
              AND payment_status = 'completed'
              AND read_notification = 0
        `, [vendor_id]);

      res.status(200).json({
         status: true,
         data: results
      });

   } catch (error) {
      console.error('Error fetching hr_order data:', error);
      res.status(500).json({
         status: false,
         message: 'Internal Server Error'
      });
   }
};

//====== update notification======
export const updateNotification = async (req, res) => {
   try {
      const { vendor_id } = req.body;
      if (!vendor_id) {
         return res.status(400).json({ status: false, message: 'vendor_id is required' });
      }

      const [result] = await con.query(
         `UPDATE hr_order
       SET read_notification = 1
       WHERE vendor_id = ? AND status = 1 AND read_notification = 0`,
         [vendor_id]
      );

      return res.json({
         status: true,
         message: 'All unread notifications marked as read',
         affectedRows: result.affectedRows ?? 0
      });
   } catch (error) {
      console.error('markOrdersRead error:', error);
      return res.status(500).json({ status: false, message: 'Server error', error: error.message });
   }
};
