import jwt from "jsonwebtoken";
import db from "../server.js"

const adminAuth = async (req, res, next) => {
  try {
    // 1️⃣ get token from cookie
    const token = req.cookies.adminToken;
   
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Token missing",
      });
    }

    // 2️⃣ verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
   

    // 3️⃣ check admin in database
    const [rows] = await db.query(
      "SELECT id, name, phone, role FROM admins WHERE id = ? AND role = 'admin'",
      [decoded.id]
    );
    

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Admin not found",
      });
    }

    // 4️⃣ attach admin to request
    req.admin = rows[0];

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

export default adminAuth;
