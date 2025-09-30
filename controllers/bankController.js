import con from '../db/db.js';

export const getBanks = async (req, res) => {
  try {
    const [rows] = await con.query(
      `SELECT id, name FROM hr_banks ORDER BY id ASC`
    );

    res.status(200).json({
      status: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching HR banks:", error);
    res.status(500).json({
      status: false,
      message: "Server Error",
    });
  }
};
