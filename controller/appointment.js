
import db from "../server.js";

import Time from "../utils/time.js";
const { timeToMinutes, minutesToTime } = Time;

const test=(req,res)=>{
    res.send("appointment controller is working")
}

export const getServiceBasedSlots = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date } = req.body;

    if (!date || !userId) {
      return res.status(400).json({
        message: "Date and userId required"
      });
    }

    // 🔹 Convert dates properly
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    // ❌ 1️⃣ Block past dates
    if (selectedDate < today) {
      return res.status(400).json({
        message: "Cannot book slots for past dates"
      });
    }

    // 🔹 2️⃣ Fetch services from booking_cart
    const [serviceDocs] = await db.query(
      `SELECT s.id, s.name, s.duration
       FROM booking_cart bc
       JOIN services s ON bc.service_id = s.id
       WHERE bc.user_id = ?`,
      [userId]
    );

    if (serviceDocs.length === 0) {
      return res.status(400).json({
        message: "Cart is empty"
      });
    }

    // 🔹 3️⃣ Calculate total duration
    const totalDuration = serviceDocs.reduce(
      (sum, s) => sum + s.duration,
      0
    );

    // 🔹 4️⃣ Salon timings (10 AM – 8 PM)
    const salonStart = timeToMinutes("10:00");
    const salonEnd = timeToMinutes("20:00");

    // 🔹 5️⃣ Fetch booked appointments
    const [booked] = await db.query(
      `SELECT start_time, end_time 
       FROM appointments 
       WHERE appointment_date = ?
       AND status != 'cancelled'`,
      [date]
    );

    const bookedRanges = booked.map(a => ({
      start: timeToMinutes(a.start_time),
      end: timeToMinutes(a.end_time)
    }));

    // 🔹 6️⃣ If selected date is today → block past time slots
    let currentMinutes = 0;
    const now = new Date();

    if (selectedDate.getTime() === today.getTime()) {
      currentMinutes = now.getHours() * 60 + now.getMinutes();
    }

    // 🔹 7️⃣ Generate slots
    let availableSlots = [];

    for (
      let start = salonStart;
      start + totalDuration <= salonEnd;
      start += 15
    ) {
      // ❌ Skip past slots for today
      if (
        selectedDate.getTime() === today.getTime() &&
        start < currentMinutes
      ) {
        continue;
      }

      const end = start + totalDuration;

      // ❌ Check overlapping
      const isOverlapping = bookedRanges.some(
        b => start < b.end && end > b.start
      );

      if (!isOverlapping) {
        availableSlots.push({
          startTime: minutesToTime(start),
          endTime: minutesToTime(end)
        });
      }
    }

    return res.status(200).json({
      success: true,
      date,
      totalDuration,
      services: serviceDocs,
      availableSlots
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


//get payment 

export const createBookingIntent = async (req, res) => {
  try {
    console.log(req.body)
    const userId=req.user.userId;
    console.log(userId)
    const { date, startTime, endTime } = req.body;

    // 1️⃣ Validation
    if (!userId || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    // 2️⃣ Fetch services from booking_cart
    const [serviceDocs] = await db.query(
      `SELECT s.id, s.name, s.price, s.duration
       FROM booking_cart bc
       JOIN services s ON bc.service_id = s.id
       WHERE bc.user_id = ?`,
      [userId]
    );

    if (serviceDocs.length === 0) {
      return res.status(400).json({
        message: "Cart is empty"
      });
    }

    // 3️⃣ Calculate total duration
    const totalDuration = serviceDocs.reduce(
      (sum, s) => sum + Number(s.duration),
      0
    );

    const selectedDuration =
      timeToMinutes(endTime) - timeToMinutes(startTime);

    if (selectedDuration !== totalDuration) {
      return res.status(400).json({
        message: "Slot duration does not match service duration"
      });
    }

    // 4️⃣ Calculate total price
    const totalAmount = serviceDocs.reduce(
      (sum, s) => sum + Number(s.price),
      0
    );

    // 5️⃣ Fetch offers
    const today = new Date().toISOString().split("T")[0];

    const [offers] = await db.query(
  `SELECT *
   FROM offers
   WHERE is_active = 1
   AND expiry_date >= ?
   AND (min_bill_amount IS NULL OR min_bill_amount <= ?)`,
  [today, totalAmount]
);

    console.log(offers)

    let appliedOffer = null;
    let discountAmount = 0;

    for (let offer of offers) {
      const [offerServices] = await db.query(
        `SELECT service_id
         FROM offer_services
         WHERE offer_id = ?`,
        [offer.id]
      );

      const applicable = offerServices.some(os =>
        serviceDocs.some(s => s.id === os.service_id)
      );

      if (!applicable) continue;

      const discount =
        offer.discount_type === "PERCENT"
          ? (totalAmount * Number(offer.discount_value || 0)) / 100
          : Number(offer.discount_value || 0);
          console.log("discount"+discount);

      if (discount > discountAmount) {
        discountAmount = discount;
        appliedOffer = offer;
      }
    }

    if (discountAmount > totalAmount) {
      discountAmount = totalAmount;
    }

    const finalAmount = totalAmount - discountAmount;

    /* ---------------------------------------
   🔐  Check slot already locked
--------------------------------------- */

// 1️⃣ Check confirmed appointments
const [existingAppointments] = await db.query(
  `SELECT id
   FROM appointments
   WHERE appointment_date = ?
   AND status != 'cancelled'
   AND (start_time < ? AND end_time > ?)`,
  [date, endTime, startTime]
);

if (existingAppointments.length > 0) {
  return res.status(409).json({
    message: "Time slot already booked"
  });
}

// 2️⃣ Check active booking intents (not expired)
const [existingIntents] = await db.query(
  `SELECT id
   FROM booking_intents
   WHERE appointment_date = ?
   AND expires_at > NOW()
   AND (start_time < ? AND end_time > ?)`,
  [date, endTime, startTime]
);

if (existingIntents.length > 0) {
  return res.status(409).json({
    message: "Time slot temporarily locked. Please try another slot."
  });
}

    // 6️⃣ Create booking intent
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const [result] = await db.query(
      `INSERT INTO booking_intents
       (appointment_date, start_time, end_time,
        total_amount, discount_amount, final_amount,
        applied_offer_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        date,
        startTime,
        endTime,
        totalAmount,
        discountAmount,
        finalAmount,
        appliedOffer ? appliedOffer.id : null,
        expiresAt
      ]
    );

    const intentId = result.insertId;

    // 7️⃣ Insert mapping from cart services
    for (let service of serviceDocs) {
      await db.query(
        `INSERT INTO booking_intent_services
         (booking_intent_id, service_id)
         VALUES (?, ?)`,
        [intentId, service.id]
      );
    }

    // 8️⃣ OPTIONAL (Recommended) → Clear cart after intent created
    await db.query(
      `DELETE FROM booking_cart WHERE user_id = ?`,
      [userId]
    );

    // 9️⃣ Response
    res.status(201).json({
      id: intentId,
      date,
      startTime,
      endTime,
      services: serviceDocs,
      totalAmount,
      discountAmount,
      finalAmount,
      minimumPayable: 10,
      appliedOffer: appliedOffer
        ? {
            id: appliedOffer.id,
            title: appliedOffer.title
          }
        : null
    });
 

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
 



//appointment creation

export const createAppointment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;
    const { paid_amount } = req.body;

    if (!id || paid_amount == null) {
      return res.status(400).json({
        message: "Booking intent id and paid_amount are required"
      });
    }

      // ❌ Minimum payment condition
    if ( paid_amount < 10) {
      return res.status(400).json({
        message: "Minimum payable amount should be ₹10"
      });
    }

    await connection.beginTransaction();

    /* ---------------------------------------
       1️⃣ Fetch booking intent
    --------------------------------------- */
    const [intentRows] = await connection.query(
      `SELECT *
       FROM booking_intents
       WHERE id = ?`,
      [id]
    );

    if (!intentRows.length) {
      await connection.rollback();
      return res.status(404).json({
        message: "Booking intent not found"
      });
    }

    const intent = intentRows[0];

    /* ---------------------------------------
       2️⃣ Expiry check
    --------------------------------------- */
    if (intent.expires_at && new Date(intent.expires_at) < new Date()) {
      await connection.rollback();
      return res.status(410).json({
        message: "Booking intent expired"
      });
    }

    /* ---------------------------------------
       3️⃣ Prevent double booking
    --------------------------------------- */
    const [existing] = await connection.query(
      `SELECT id
       FROM appointments
       WHERE appointment_date = ?
       AND status != 'cancelled'
       AND (start_time < ? AND end_time > ?)`,
      [
        intent.appointment_date,
        intent.end_time,
        intent.start_time
      ]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Time slot already booked"
      });
    }

    /* ---------------------------------------
       4️⃣ Fetch services
    --------------------------------------- */
    const [serviceRows] = await connection.query(
      `SELECT service_id
       FROM booking_intent_services
       WHERE booking_intent_id = ?`,
      [id]
    );

    if (!serviceRows.length) {
      await connection.rollback();
      return res.status(400).json({
        message: "No services found"
      });
    }

    const serviceIds = serviceRows.map(s => s.service_id);

    /* ---------------------------------------
       5️⃣ Payment logic
    --------------------------------------- */
  const paidAmount = Number(paid_amount);
const finalAmount = Number(intent.final_amount);

// 50% calculation
const minimumRequired = finalAmount * 0.5;

const isConfirmed = paidAmount >= minimumRequired;

const appointmentStatus = isConfirmed
  ? "confirmed"
  : "pending";

const paymentStatus = paidAmount >= finalAmount
  ? "paid"
  : isConfirmed
  ? "partial"
  : "pending";

  // full payment flag
  const isFullPayment = paidAmount >= finalAmount;

    /* ---------------------------------------
       6️⃣ Create appointment
    --------------------------------------- */
    const primaryServiceId = serviceIds[0];

    const [result] = await connection.query(
      `INSERT INTO appointments
       (
         customer_id,
         appointment_date,
         time_slot,
         start_time,
         end_time,
         total_amount,
         discount_amount,
         final_amount,
         paid_amount,
         status,
         payment_status,
         offer_id,
         service_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.userId,
        intent.appointment_date,
        `${intent.start_time} - ${intent.end_time}`,
        intent.start_time,
        intent.end_time,
        intent.total_amount,
        intent.discount_amount,
        intent.final_amount,
        paid_amount,
        appointmentStatus,
        paymentStatus,
        intent.applied_offer_id || null,
        primaryServiceId
      ]
    );

    const appointmentId = result.insertId;

    /* ---------------------------------------
       7️⃣ Insert appointment services
    --------------------------------------- */
    for (let serviceId of serviceIds) {
      await connection.query(
        `INSERT INTO appointment_services
         (appointment_id, service_id)
         VALUES (?, ?)`,
        [appointmentId, serviceId]
      );
    }

    /* ---------------------------------------
       8️⃣ Update booking intent
    --------------------------------------- */
    await connection.query(
      `UPDATE booking_intents
       SET status = ?
       WHERE id = ?`,
      [isFullPayment ? "completed" : "partial", id]
    );

    await connection.commit();

    /* ---------------------------------------
       9️⃣ Fetch FULL BILL DATA
    --------------------------------------- */
    const [appointmentData] = await connection.query(
      `SELECT 
          a.id,
          a.appointment_date,
          a.start_time,
          a.end_time,
          a.total_amount,
          a.discount_amount,
          a.final_amount,
          a.paid_amount,
          a.payment_status,
          a.status,
          u.name AS customer_name,
          u.phone AS customer_phone,
          o.title AS offer_title
       FROM appointments a
       JOIN users u ON a.customer_id = u.id
       LEFT JOIN offers o ON a.offer_id = o.id
       WHERE a.id = ?`,
      [appointmentId]
    );

    const [servicesData] = await connection.query(
      `SELECT s.id, s.name, s.price, s.duration
       FROM appointment_services aps
       JOIN services s ON aps.service_id = s.id
       WHERE aps.appointment_id = ?`,
      [appointmentId]
    );

    const appointment = appointmentData[0];

    const remainingAmount =
      Number(appointment.final_amount) -
      Number(appointment.paid_amount);

    /* ---------------------------------------
       🔟 Final Response (Invoice Ready)
    --------------------------------------- */
    res.status(201).json({
      message: "Appointment created successfully",
      paymentType: isFullPayment ? "FULL" : "ADVANCE",

      bill: {
        appointmentId: appointment.id,
        date: appointment.appointment_date,
        timeSlot: `${appointment.start_time} - ${appointment.end_time}`,

        customer: {
          name: appointment.customer_name,
          phone: appointment.customer_phone
        },

        services: servicesData,

        pricing: {
          totalAmount: appointment.total_amount,
          discountAmount: appointment.discount_amount,
          finalAmount: appointment.final_amount,
          paidAmount: appointment.paid_amount,
          remainingAmount: remainingAmount
        },

        offer: appointment.offer_title
          ? { title: appointment.offer_title }
          : null,

        appointmentStatus: appointment.status,
        paymentStatus: appointment.payment_status
      }
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      message: error.message
    });
  } finally {
    connection.release();
  }
};



//get all appointments

export const getAllAppointments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        a.id AS appointment_id,
        a.appointment_date,
        a.time_slot,
        a.start_time,
        a.end_time,
        a.total_amount,
        a.discount_amount,
        a.final_amount,
        a.status,
        a.payment_status,
        a.created_at,

        u.id AS customer_id,
        u.name AS customer_name,
        u.phone AS customer_phone,

        o.id AS offer_id,
        o.title AS offer_title,

        s.id AS service_id,
        s.name AS service_name,
        s.duration,
        s.price

      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      LEFT JOIN offers o ON o.id = a.offer_id
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services s ON s.id = aps.service_id

      ORDER BY a.created_at DESC
      `
    );

    /* -----------------------------
       Group services per appointment
    ----------------------------- */
    const appointmentsMap = {};

    for (let row of rows) {
      if (!appointmentsMap[row.appointment_id]) {
        appointmentsMap[row.appointment_id] = {
          appointmentId: row.appointment_id,
          appointmentDate: row.appointment_date,
          timeSlot: row.time_slot,
          startTime: row.start_time,
          endTime: row.end_time,

          customer: {
            id: row.customer_id,
            name: row.customer_name,
            phone: row.customer_phone
          },

          services: [],
          offer: row.offer_id
            ? {
                id: row.offer_id,
                title: row.offer_title
              }
            : null,

          totalAmount: row.total_amount,
          discountAmount: row.discount_amount,
          finalAmount: row.final_amount,

          status: row.status,
          paymentStatus: row.payment_status,
          createdAt: row.created_at
        };
      }

      appointmentsMap[row.appointment_id].services.push({
        id: row.service_id,
        name: row.service_name,
        duration: row.duration,
        price: row.price
      });
    }

    res.json({
      count: Object.keys(appointmentsMap).length,
      appointments: Object.values(appointmentsMap)
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

//get appointment by id
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Appointment id is required"
      });
    }

    /* ---------------------------------------
       1️⃣ Fetch appointment + customer + offer
    --------------------------------------- */
    const [appointmentRows] = await db.query(
      `
      SELECT 
        a.id AS appointment_id,
        a.appointment_date,
        a.time_slot,
        a.start_time,
        a.end_time,
        a.total_amount,
        a.discount_amount,
        a.final_amount,
        a.status,
        a.payment_status,
        a.created_at,

        u.id AS customer_id,
        u.name AS customer_name,
        u.phone AS customer_phone,

        o.id AS offer_id,
        o.title AS offer_title

      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      LEFT JOIN offers o ON o.id = a.offer_id
      WHERE a.id = ?
      `,
      [id]
    );

    if (!appointmentRows.length) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    const appointment = appointmentRows[0];

    /* ---------------------------------------
       2️⃣ Fetch services
    --------------------------------------- */
    const [serviceRows] = await db.query(
      `
      SELECT 
        s.id,
        s.name,
        s.price,
        s.duration
      FROM appointment_services aps
      JOIN services s ON s.id = aps.service_id
      WHERE aps.appointment_id = ?
      `,
      [id]
    );
    // services fetched for appointment

    /* ---------------------------------------
       3️⃣ Final structured response
    --------------------------------------- */
    res.json({
      appointmentId: appointment.appointment_id,
      appointmentDate: appointment.appointment_date,
      timeSlot: appointment.time_slot,
      startTime: appointment.start_time,
      endTime: appointment.end_time,

      customer: {
        id: appointment.customer_id,
        name: appointment.customer_name,
        phone: appointment.customer_phone
      },

      services: serviceRows,

      offer: appointment.offer_id
        ? {
            id: appointment.offer_id,
            title: appointment.offer_title
          }
        : null,

      totalAmount: appointment.total_amount,
      discountAmount: appointment.discount_amount,
      finalAmount: appointment.final_amount,

      status: appointment.status,
      paymentStatus: appointment.payment_status,
      createdAt: appointment.created_at
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};



//get my appointments

export const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user.userId; // MySQL user id

    const [rows] = await db.query(
      `
      SELECT 
        a.id AS appointment_id,
        a.appointment_date,
        a.time_slot,
        a.start_time,
        a.end_time,
        a.status,
        a.payment_status,

        s.id AS service_id,
        s.name AS service_name,
        s.price

      FROM appointments a
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services s ON s.id = aps.service_id

      WHERE a.customer_id = ?
      ORDER BY a.appointment_date DESC
      `,
      [userId]
    );

    const map = {};

    for (let row of rows) {
      if (!map[row.appointment_id]) {
        map[row.appointment_id] = {
          appointmentId: row.appointment_id,
          appointmentDate: row.appointment_date,
          timeSlot: row.time_slot,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          paymentStatus: row.payment_status,
          services: []
        };
      }

      map[row.appointment_id].services.push({
        id: row.service_id,
        name: row.service_name,
        price: row.price
      });
    }

    res.json({
      appointments: Object.values(map)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params; // appointment id
    const { appointmentDate, startTime, endTime } = req.body;

    if (!id || !appointmentDate || !startTime || !endTime) {
      return res.status(400).json({
        message: "appointmentDate, startTime and endTime are required"
      });
    }

    /* ---------------------------------------
       1️⃣ Fetch appointment
    --------------------------------------- */
    const [rows] = await db.query(
      `SELECT 
         id,
         status
       FROM appointments
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    const appointment = rows[0];

    if (appointment.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled appointment cannot be rescheduled"
      });
    }

    /* ---------------------------------------
       2️⃣ Check slot availability
       (ignore current appointment id)
    --------------------------------------- */
    const [conflicts] = await db.query(
      `
      SELECT id
      FROM appointments
      WHERE appointment_date = ?
        AND status != 'cancelled'
        AND id != ?
        AND (
          start_time < ?
          AND end_time > ?
        )
      `,
      [appointmentDate, id, endTime, startTime]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({
        message: "Selected slot is not available"
      });
    }

    /* ---------------------------------------
       3️⃣ Update appointment
    --------------------------------------- */
    await db.query(
      `
      UPDATE appointments
      SET
        appointment_date = ?,
        start_time = ?,
        end_time = ?,
        time_slot = ?
      WHERE id = ?
      `,
      [
        appointmentDate,
        startTime,
        endTime,
        `${startTime} - ${endTime}`,
        id
      ]
    );

    /* ---------------------------------------
       4️⃣ Response
    --------------------------------------- */
    res.json({
      message: "Appointment rescheduled successfully",
      appointmentId: id,
      newDate: appointmentDate,
      newSlot: `${startTime} - ${endTime}`
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};



export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Appointment id is required"
      });
    }

    /* ---------------------------------------
       1️⃣ Fetch appointment
    --------------------------------------- */
    const [rows] = await db.query(
      `SELECT 
         id,
         status,
         appointment_date,
         start_time,
         final_amount,
         payment_status
       FROM appointments
       WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    const appointment = rows[0];

    if (appointment.status === "cancelled") {
      return res.status(400).json({
        message: "Appointment already cancelled"
      });
    }

    /* ---------------------------------------
       2️⃣ Calculate time difference
    --------------------------------------- */
const appointmentDateObj = new Date(appointment.appointment_date);
let startHour = 0;
let startMinute = 0;

if (typeof appointment.start_time === "string") {
  const parts = appointment.start_time.split(":");
  startHour = Number(parts[0]) || 0;
  startMinute = Number(parts[1]) || 0;
} else if (appointment.start_time instanceof Date) {
  startHour = appointment.start_time.getHours();
  startMinute = appointment.start_time.getMinutes();
}

appointmentDateObj.setHours(startHour, startMinute, 0, 0);
const diffHours = (appointmentDateObj - new Date()) / (1000 * 60 * 60);
const isRefundable = diffHours >= 3;
    /* ---------------------------------------
       4️⃣ Cancel appointment
    --------------------------------------- */
    await db.query(
      `UPDATE appointments
       SET status = 'cancelled'
       WHERE id = ?`,
      [id]
    );

    /* ---------------------------------------
       5️⃣ (Optional) Handle refund later
    --------------------------------------- */
    // if (isRefundable && appointment.payment_status === "paid") {
    //   triggerRefund(appointment.final_amount);
    // }

    /* ---------------------------------------
       6️⃣ Response
    --------------------------------------- */
    res.json({
      message: "Appointment cancelled successfully",
      appointmentId: id,
      refundable: isRefundable,
      refundAmount: isRefundable ? appointment.final_amount : 0
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};



export default {test,getServiceBasedSlots,createBookingIntent,createAppointment,getAllAppointments,getAppointmentById,getMyAppointments,rescheduleAppointment,cancelAppointment}