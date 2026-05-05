import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();

/* ======================
   DATABASE CONNECTION
====================== */

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "salon_db",
});

/* ======================
   MIDDLEWARE
====================== */

app.use(express.static("public"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/* ======================
   ROUTES
====================== */

app.get("/home", (req, res) => {
  res.send("You are on home page");
});


/* ======================
   GET ALL SERVICES
====================== */

app.get("/service/services", async (req, res) => {
  try {

    const [services] = await db.query(
      "SELECT * FROM services WHERE is_active = 1 ORDER BY created_at DESC"
    );

    if (!services || services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No services found",
      });
    }

    res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});


/* ======================
   GLOBAL ERROR HANDLER
====================== */

const errorHandler = (err, req, res, next) => {
  console.log(err);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

app.use(errorHandler);

/* ======================
   SERVER
====================== */

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});