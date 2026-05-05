import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    discountType: {
      type: String,
      enum: ["FLAT", "PERCENT"],
      required: true
    },

    discountValue: {
      type: Number,
      required: true
    },

    minBillAmount: {
      type: Number,
      default: 0
    },

    applicableServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
      }
    ],

    expiryDate: {
      type: Date,
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);
const Offer =mongoose.model("Offer",offerSchema)
export default Offer;
