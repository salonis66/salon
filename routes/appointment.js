import express from 'express'
const router=express.Router()
import auth from '../utils/authentication.js';
import adminAuth from '../utils/adminAuth.js';
import appointmentController from '../controller/appointment.js';

router.get("/test",appointmentController.test)
router.post("/getSlots",auth,appointmentController.getServiceBasedSlots)
router.post("/booking-intent",auth,appointmentController.createBookingIntent);
// router.get("/getBooking-intent/:id",auth,appointmentController.getBookingIntent);
router.post("/create/:id",auth,appointmentController.createAppointment);
router.get("/appointments/:id", auth,appointmentController.getAppointmentById);
router.get("/getAllAppointments",adminAuth,appointmentController.getAllAppointments);
router.get("/myAppointments", auth,appointmentController.getMyAppointments);
router.put("/delete/:id",auth,appointmentController.cancelAppointment);
// router.put("/reschedule/:id",auth,appointmentController.rescheduleAppointment);

export default router;