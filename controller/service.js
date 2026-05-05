
import db from "../server.js"

// =======================
// TEST API
// =======================
const test = (req, res) => {
  res.send("service api is working");
};

// =======================
// CREATE SERVICE
// =======================
const createService = async (req, res, next) => {
  try {
    const { name, description, duration, price, isActive } = req.body;

    // 1️⃣ validation
    if (!name || !duration || !price) {
      throw new Error("Name, duration and price are required");
    }

    if (duration <= 0) {
      throw new Error("Duration must be greater than 0 minutes");
    }

    if (price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    // 2️⃣ check duplicate service
    const [existing] = await db.query(
      "SELECT id FROM services WHERE name = ?",
      [name]
    );

    if (existing.length > 0) {
      throw new Error("Service with this name already exists");
    }

    // 3️⃣ create service
    const [result] = await db.query(
      `INSERT INTO services (name, description, duration, price, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        description || null,
        duration,
        price,
        isActive !== undefined ? isActive : 1,
      ]
    );

    // 4️⃣ response
    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: {
        id: result.insertId,
        name,
        description,
        duration,
        price,
        isActive: isActive !== undefined ? isActive : 1,
      },
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// GET ALL SERVICES (only active)
// =======================
const getAllServices = async (req, res, next) => {
  try {
    const [services] = await db.query(
      "SELECT * FROM services WHERE is_active = 1 ORDER BY created_at DESC"
    );

    if (!services || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "no services found",
      });
    }

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// GET SERVICE BY ID
// =======================
export const getServiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Service id is required",
      });
    }

    const [rows] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0],
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// UPDATE SERVICE
// =======================
const updateService = async (req, res, next) => {
  try {
    const serviceId = req.params.id;
    const { name, description, duration, price, isActive } = req.body;

    // 1️⃣ check service exists
    const [rows] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [serviceId]
    );

    if (rows.length === 0) {
      throw new Error("Service not found");
    }

    const service = rows[0];

    // 2️⃣ validations
    if (duration !== undefined && duration <= 0) {
      throw new Error("Duration must be greater than 0 minutes");
    }

    if (price !== undefined && price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    // 3️⃣ prevent duplicate name
    if (name && name !== service.name) {
      const [existing] = await db.query(
        "SELECT id FROM services WHERE name = ?",
        [name]
      );

      if (existing.length > 0) {
        throw new Error("Service with this name already exists");
      }
    }

    // 4️⃣ dynamic update
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description);
    }

    if (duration !== undefined) {
      fields.push("duration = ?");
      values.push(duration);
    }

    if (price !== undefined) {
      fields.push("price = ?");
      values.push(price);
    }

    if (isActive !== undefined) {
      fields.push("is_active = ?");
      values.push(isActive);
    }

    values.push(serviceId);

    await db.query(
      `UPDATE services SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// SOFT DELETE SERVICE
// =======================
const deleteService = async (req, res, next) => {
  try {
    const id = req.params.id;

    const [result] = await db.query(
      "UPDATE services SET is_active = 0 WHERE id = ?",
      [id]
    );
   

    if (result.affectedRows === 0) {
      throw new Error("Service not found");
    }

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });

  } catch (error) {
    next(error);
  }
};

//add service to cart
export const addServiceToCart = async (req, res) => {
  try {
    const userId=req.user.userId;
    const { id } = req.params;

    if (!userId || !id) {
      return res.status(400).json({
        message: "Missing fields"
      });
    }

    // Check if already exists
    const [existing] = await db.query(
      `SELECT * FROM booking_cart 
       WHERE user_id = ? AND service_id = ?`,
      [userId, id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Service already added"
      });
    }

    await db.query(
      `INSERT INTO booking_cart (user_id, service_id)
       VALUES (?, ?)`,
      [userId, id]
    );

    res.status(200).json({
      message: "Service added to cart"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};


//get cart services
export const getCartServices = async (req, res) => {
  try {
    const userId=req.user.userId;

    const [services] = await db.query(
      `SELECT s.id, s.name, s.price, s.duration
       FROM booking_cart bc
       JOIN services s ON bc.service_id = s.id
       WHERE bc.user_id = ?`,
      [userId]
    );

console.log(services)



    res.status(200).json({
      services
    });

  } catch (error) {
    console.log(error);
  }
};

// remove services from cart
export const removeServiceFromCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!userId || !id) {
      return res.status(400).json({
        message: "Missing fields"
      });
    }

    // Check if service exists in cart
    const [existing] = await db.query(
      `SELECT * FROM booking_cart 
       WHERE user_id = ? AND service_id = ?`,
      [userId, id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Service not found in cart"
      });
    }

    // Delete service from cart
    await db.query(
      `DELETE FROM booking_cart 
       WHERE user_id = ? AND service_id = ?`,
      [userId, id]
    );

    res.status(200).json({
      message: "Service removed from cart"
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};


// =======================
export default {
  test,
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  addServiceToCart,
  getCartServices,
  removeServiceFromCart
};
