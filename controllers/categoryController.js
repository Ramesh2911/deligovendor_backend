import con from '../db/db.js';

//===== Main Category======
export const mainCategories = async (req, res) => {
   try {
      const [rows] = await con.query(
         `SELECT cid, category_name, category_image FROM hr_category WHERE parent_id = 0 AND is_active = 1`
      );

      if (rows.length === 0) {
         return res.status(200).json({
            status: false,
            message: 'No active main categories found',
            data: [],
         });
      }

      return res.status(200).json({
         status: true,
         message: 'Main active categories fetched successfully',
         data: rows,
      });
   } catch (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({
         status: false,
         message: 'Internal server error',
      });
   }
};

//===== sub Category=====
export const subCategories = async (req, res) => {
   const { parent_id } = req.query;

   if (!parent_id || isNaN(parent_id)) {
      return res.status(400).json({
         status: false,
         message: 'Valid parent_id is required',
         data: [],
      });
   }

   try {
      const [rows] = await con.query(
         `SELECT cid, category_name, is_active FROM hr_category WHERE parent_id = ?`,
         [parent_id]
      );

      if (rows.length === 0) {
         return res.status(200).json({
            status: false,
            message: 'No subcategories found',
            data: [],
         });
      }

      return res.status(200).json({
         status: true,
         message: 'Subcategories fetched successfully',
         data: rows,
      });
   } catch (error) {
      console.error('Error fetching subcategories:', error);
      return res.status(500).json({
         status: false,
         message: 'Internal server error',
         data: [],
      });
   }
};