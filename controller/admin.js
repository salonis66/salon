
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../server.js"

export const adminRegister = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // 1️⃣ validation
    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

     // 🔐 STEP 1: Check if admin already exists
    const [existingAdmins] = await db.query(
      "SELECT * FROM admins"
    );
    

    if (existingAdmins.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Admin registration is disabled"
      });
    }

    // 3️⃣ hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ create admin
    const [result] = await db.query(
      "INSERT INTO admins (name, phone, password) VALUES (?, ?, ?)",
      [name, phone, hashedPassword]
    );

    const adminId = result.insertId;

    // 5️⃣ create token
    const token = jwt.sign(
      { id: adminId, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    // 6️⃣ set cookie
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // 7️⃣ response
    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
//login 

export const adminLogin = async (req, res) => {
  console.log(req.body)
  try {
    const { phone, password } = req.body;

    // validation
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "phone and password are required",
      });
    }

     const [existingAdmins] = await db.query(
      "SELECT * FROM admins"
    );
   
   

    // check admin
    const [rows] = await db.query(
      "SELECT * FROM admins WHERE phone = ? ",
      [phone]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }
    

    const admin = rows[0];
    console.log(admin)

    // compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // generate token
    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "2d"}
    );

    // set cookie
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful"
       });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//logout
export const adminLogout = async (req, res) => {
  try {
    // Clear the cookie
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: false,     // true if using HTTPS
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//get profile

export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const [rows] = await db.query(
      "SELECT id, name, phone, email, role FROM admins WHERE id = ? AND role = 'admin'",
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      admin: rows[0],
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//update admin


export const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { name, email, password } = req.body;

    // check admin exists
    const [rows] = await db.query(
      "SELECT * FROM admins WHERE id = ? AND role = 'admin'",
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const fields = [];
    const values = [];

    if (name) {
      fields.push("name = ?");
      values.push(name);
    }

    if (email) {
      fields.push("email = ?");
      values.push(email);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    values.push(adminId);

    await db.query(
      `UPDATE admins SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//delete admin account

export const deleteAdmin = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const [result] = await db.query(
      "DELETE FROM admins WHERE id = ? AND role = 'admin'",
      [adminId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // clear cookie
    res.clearCookie("adminToken");

    res.status(200).json({
      success: true,
      message: "Admin account deleted successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




export default{adminRegister,adminLogin,adminLogout,getAdminProfile,updateAdminProfile,deleteAdmin}
