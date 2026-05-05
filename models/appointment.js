import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },

    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
      }
    ],

    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null
    },


    appointmentDate: {
      type: Date,
      required: true
    },

    timeSlot: {
      type: String, // "10:00 AM - 11:00 AM"
      required: true
    },

    totalAmount: {
      type: Number, // total of services
      required: true
    },

    discountAmount: {
      type: Number,
      default: 0
    },

    finalAmount: {
      type: Number, // totalAmount - discount
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending"
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    },
      startTime: {
  type: String, // "10:00"
  required: true
},
endTime: {
  type: String, // "11:30"
  required: true
},
  },


  { timestamps: true }
);

export default mongoose.model("Appointment", appointmentSchema);
