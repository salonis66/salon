
import jwt from 'jsonwebtoken'
import db from "../server.js"

const  test =(req,res)=>{
   res.send("api is working")
   console.log("controller")
}

import bcrypt from "bcrypt";


const register = async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    // 1️⃣ validation
    if (!name || !phone || !password) {
      throw new Error("Name, phone and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // 2️⃣ check existing user
    const [existingUser] = await db.query(
      "SELECT id FROM users WHERE phone = ?",
      [phone]
    );

    if (existingUser.length > 0) {
      throw new Error("User already registered");
    }

    // 3️⃣ hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ insert user
    const [result] = await db.query(
      "INSERT INTO users (name, phone, password) VALUES (?, ?, ?)",
      [name, phone, hashedPassword]
    );

    const userId = result.insertId;

    // 5️⃣ create token
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 6️⃣ set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: "none", // allow cross-origin requests (e.g. live-server on localhost:5500)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 7️⃣ response
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: userId,
        name,
        phone,
      },
    });
  } catch (error) {
    next(error);
  }
};


//login

const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
   

    // 1️⃣ validation
    if (!phone || !password) {
      throw new Error("Phone and password are required");
    }

    // 2️⃣ check user exists (MySQL query)
    const [rows] = await db.query(
      "SELECT * FROM users WHERE phone = ?",
      [phone]
    );

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    const user = rows[0];

    // 3️⃣ compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Invalid phone or password");
    }

    // 4️⃣ create token
    const token = jwt.sign(
      {
        userId: user.id,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 5️⃣ set cookie
   res.cookie("token", token, {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000
});

    // 6️⃣ success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
      },
    });

  } catch (error) {
    next(error); // global error handler
  }
};

//update user

const updateUser = async (req, res, next) => {
  try {
    const userId = req.user.userId; // JWT middleware se aayega
    const { name, phone } = req.body;

    // 1️⃣ validation
    if (!name && !phone) {
      throw new Error("At least one field (name or phone) is required to update");
    }

    // 2️⃣ check user exists
    const [rows] = await db.query(
      "SELECT id, name, phone FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    // 3️⃣ build dynamic update query
    const fields = [];
    const values = [];

    if (name) {
      fields.push("name = ?");
      values.push(name);
    }

    if (phone) {
      fields.push("phone = ?");
      values.push(phone);
    }

    values.push(userId);

    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // 4️⃣ updated user fetch
    const [updatedUser] = await db.query(
      "SELECT id, name, phone FROM users WHERE id = ?",
      [userId]
    );

    // 5️⃣ response
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        id: updatedUser[0].id,
        name: updatedUser[0].name,
        phone: updatedUser[0].phone,
      },
    });

  } catch (error) {
    next(error);
  }
};

// to get all users 
const getAllUsers = async (req, res, next) => {
  try {
    // 1️⃣ get all users (exclude password)
    const [users] = await db.query(
      "SELECT id, name, phone FROM users"
    );

    // 2️⃣ check empty result
    if (!users || users.length === 0) {
      throw new Error("No users found");
    }

    // 3️⃣ response
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });

  } catch (error) {
    next(error);
  }
};


const deleteUser = async (req, res, next) => {
  try {
    const userId = req.user.userId; // admin ya token se aayega

    // 1️⃣ check user exists
    const [rows] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    // 2️⃣ delete user
    await db.query(
      "DELETE FROM users WHERE id = ?",
      [userId]
    );

    // 3️⃣ response
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};

// logout user

const logout = async (req, res, next) => {
  try {
    // clear auth cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: false, // production me true (https)
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

//get usr profile

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }
    console.log(userId)

    /* ---------------------------------------
       1️⃣ Get User Info
    --------------------------------------- */
    const [users] = await db.query(
      `SELECT id, name,  phone
       FROM users
       WHERE id = ?`,
      [userId]
    );
    console.log(users)

    if (!users.length) {
      return res.status(404).json({
        message: "User not found"
      });
    }
    

    const user = users[0];

    /* ---------------------------------------
       2️⃣ Get Upcoming Appointments
    --------------------------------------- */
    const [upcomingAppointments] = await db.query(
      `SELECT *
       FROM appointments
       WHERE customer_id = ?
       AND appointment_date >= CURDATE()
       AND status != 'cancelled'
       ORDER BY appointment_date ASC`,
      [userId]
    );

    /* ---------------------------------------
       3️⃣ Get Booking History (Past + Completed)
    --------------------------------------- */
    const [bookingHistory] = await db.query(
      `SELECT *
       FROM appointments
       WHERE customer_id = ?
       AND (appointment_date < CURDATE()
       OR status = 'completed')
       ORDER BY appointment_date DESC`,
      [userId]
    );

    /* ---------------------------------------
       4️⃣ Get Services For Each Appointment
    --------------------------------------- */
    const attachServices = async (appointments) => {
      for (let appt of appointments) {
        const [services] = await db.query(
          `SELECT s.id, s.name, s.price, s.duration
           FROM appointment_services aps
           JOIN services s ON aps.service_id = s.id
           WHERE aps.appointment_id = ?`,
          [appt.id]
        );

        appt.services = services;
      }
      return appointments;
    };

    const upcomingWithServices = await attachServices(upcomingAppointments);
    const historyWithServices = await attachServices(bookingHistory);

    /* ---------------------------------------
       5️⃣ Payment Summary
    --------------------------------------- */
    const [summaryData] = await db.query(
      `SELECT 
          COUNT(id) AS totalBookings,
          SUM(final_amount) AS totalSpent,
          SUM(paid_amount) AS totalPaid
       FROM appointments
       WHERE customer_id = ?`,
      [userId]
    );

    const summary = summaryData[0];

    /* ---------------------------------------
       6️⃣ Final Response
    --------------------------------------- */
    res.status(200).json({
      user,
      upcomingAppointments: upcomingWithServices,
      bookingHistory: historyWithServices,
      summary: {
        totalBookings: summary.totalBookings || 0,
        totalSpent: summary.totalSpent || 0,
        totalPaid: summary.totalPaid || 0
      }
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
export const check=async(req,res)=>{
   res.status(200).json({
    success: true,
    user: req.user
  });
}


export default {test,register,login,updateUser,getAllUsers,deleteUser,logout,getUserProfile,check}

