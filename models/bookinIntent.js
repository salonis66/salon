import mongoose from "mongoose";

const bookingIntentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null
    },

    services: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service"
    }],

    appointmentDate: Date,
    startTime: String,
    endTime: String,

    totalAmount: Number,
    discountAmount: Number,
    finalAmount: Number,

    appliedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      default: null
    },

    status: {
      type: String,
      enum: ["pending", "expired", "completed"],
      default: "pending"
    },

    expiresAt: {
      type: Date
    }
  },
  { timestamps: true }
);

export default mongoose.model("BookingIntent", bookingIntentSchema);
