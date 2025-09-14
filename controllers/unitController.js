import con from '../db/db.js';

//==== unit Info====
export const getUnits = async (req, res) => {
   try {
      const [rows] = await con.query('SELECT unit_id, unit_name FROM deligo.hr_product_unit');

      if (rows.length === 0) {
         return res.status(404).json({
            status: false,
            message: 'No data found',
            data: []
         });
      }

      return res.status(200).json({
         status: true,
         message: 'Unit data fetched successfully',
         data: rows
      });

   } catch (error) {
      console.error('Error fetching units:', error);
      return res.status(500).json({
         status: false,
         message: 'Internal Server Error',
         error: error.message
      });
   }
};