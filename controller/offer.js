import db from "../server.js";

// =======================
// CREATE OFFER
// =======================
const createOffer = async (req, res, next) => {
  console.log(req.body)
  try {
    const {
      title,
      discountType,
      discountValue,
      minBillAmount,
      applicableServices,
      expiryDate,
      isActive
    } = req.body;
    console.log(req.body)

    // 1️⃣ validation
    if (!title || !discountType || !discountValue || !expiryDate || !applicableServices) {
      throw new Error("Required fields are missing");
    }

    // 3️⃣ create offer
    const [result] = await db.query(
      `INSERT INTO offers
       (title,  discount_type, discount_value, min_bill_amount, expiry_date, is_active)
       VALUES (?, ?, ?,  ?, ?, ?)`,
      [
        title,
        discountType,
        discountValue,
        minBillAmount || null,
        expiryDate,
        isActive !== undefined ? isActive : 1
      ]
    );

    const offerId = result.insertId;

    // 4️⃣ insert applicable services
    if (Array.isArray(applicableServices)) {
      for (const serviceId of applicableServices) {
        await db.query(
          "INSERT INTO offer_services (offer_id, service_id) VALUES (?, ?)",
          [offerId, serviceId]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: { id: offerId }
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// UPDATE OFFER
// =======================
const updateOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;
    const {
      title,
      discountType,
      discountValue,
      minBillAmount,
      applicableServices,
      expiryDate,
      isActive
    } = req.body;

    // check offer exists
    const [rows] = await db.query(
      "SELECT * FROM offers WHERE id = ?",
      [offerId]
    );

    if (rows.length === 0) {
      throw new Error("Offer not found");
    }

    // validation
    if (discountType === "PERCENT" && discountValue > 100) {
      throw new Error("Percentage discount cannot be more than 100");
    }

   

    // dynamic update
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push("title=?"); values.push(title); }
    if (discountType !== undefined) { fields.push("discount_type=?"); values.push(discountType); }
    if (discountValue !== undefined) { fields.push("discount_value=?"); values.push(discountValue); }
    if (minBillAmount !== undefined) { fields.push("min_bill_amount=?"); values.push(minBillAmount); }
    if (expiryDate !== undefined) { fields.push("expiry_date=?"); values.push(expiryDate); }
    if (isActive !== undefined) { fields.push("is_active=?"); values.push(isActive); }

    values.push(offerId);

    await db.query(
      `UPDATE offers SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    // update applicable services
    if (Array.isArray(applicableServices)) {
      await db.query(
        "DELETE FROM offer_services WHERE offer_id = ?",
        [offerId]
      );

      for (const serviceId of applicableServices) {
        await db.query(
          "INSERT INTO offer_services (offer_id, service_id) VALUES (?, ?)",
          [offerId, serviceId]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Offer updated successfully"
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// GET ALL OFFERS (ADMIN)
// =======================
const getAllOffers = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        o.*,
        s.id AS service_id,
        s.name AS service_name,
        s.price AS service_price
      FROM offers o
      LEFT JOIN offer_services os ON o.id = os.offer_id
      LEFT JOIN services s ON os.service_id = s.id
      ORDER BY o.created_at DESC
    `);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    // 🔥 Group services under each offer
    const offersMap = {};

    rows.forEach(row => {
      if (!offersMap[row.id]) {
        offersMap[row.id] = {
          id: row.id,
          title: row.title,
          discount_type: row.discount_type,
          discount_value: row.discount_value,
          min_bill_amount: row.min_bill_amount,
          expiry_date: row.expiry_date,
          is_active: row.is_active,
          created_at: row.created_at,
          applicableServices: []
        };
      }

      if (row.service_id) {
        offersMap[row.id].applicableServices.push({
          id: row.service_id,
          name: row.service_name,
          price: row.service_price
        });
      }
    });

    const offers = Object.values(offersMap);

    res.status(200).json({
      success: true,
      count: offers.length,
      data: offers
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// GET OFFER BY ID
// =======================
const getOfferById = async (req, res, next) => {
  try {
    const offerId = req.params.id;

    const [rows] = await db.query(
      "SELECT * FROM offers WHERE id = ?",
      [offerId]
    );

    if (rows.length === 0) {
      res.status(404).json({
      success: false,
      message: "Offer not found"
    });
    }

    const [services] = await db.query(
      `SELECT s.id, s.name
       FROM services s
       JOIN offer_services os ON os.service_id = s.id
       WHERE os.offer_id = ?`,
      [offerId]
    );

    res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        applicableServices: services
      }
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// SOFT DELETE OFFER
// =======================
const deleteOffer = async (req, res, next) => {
  try {
    const offerId = req.params.id;
     console.log(offerId)
    const [result] = await db.query(
      "UPDATE offers SET is_active = 0 WHERE id = ?",
      [offerId]
    );

    if (result.affectedRows === 0) {
      throw new Error("Offer not found");
    }

    res.status(200).json({
      success: true,
      message: "Offer deleted successfully"
    });

  } catch (error) {
    next(error);
  }
};

// =======================
// HOMEPAGE OFFERS
// =======================
const getHomepageOffers = async (req, res, next) => {
  try {
    const [offers] = await db.query(
      `SELECT id,title, code, discount_type, discount_value, expiry_date
       FROM offers
       WHERE is_active = 1 AND expiry_date >= CURDATE()
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      data: offers
    });

  } catch (error) {
    next(error);
  }
};

export default {
  createOffer,
  updateOffer,
  getAllOffers,
  getOfferById,
  deleteOffer,
  getHomepageOffers
};
