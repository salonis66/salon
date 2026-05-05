import express from 'express'

import dotenv from 'dotenv'
import cors from "cors";
dotenv.config()
import userRoutes from './routes/user.js'
import serviceRoutes from './routes/service.js'
import errorHandler from "./utils/errorHandler.js"
import offerRoutes from './routes/offer.js'
import appointmentRouter from "./routes/appointment.js"
import adminRouter from "./routes/admin.js"


const app=express()
import cookieParser from 'cookie-parser';

import mysql from "mysql2/promise"

const db=mysql.createPool({
  host:"localhost",
  user:"root",
  password:"",
  database:"salon_db"
})


app.use(express.static("public"))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({extends:true}))


// In dev, frontend may be served from Live Server (localhost:5500) or from this backend (localhost:3000).
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://localhost:3000",
      null,  // Allow file:// protocol (origin is null)
    ];

    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));


app.use("/admin",adminRouter)
// app.use("/auth", userRoutes);
app.use("/user",userRoutes)
app.use("/service",serviceRoutes)
app.use("/offer",offerRoutes)
app.use("/appointment",appointmentRouter)

app.get("/home",(req,res)=>{
  res.send("you are on home page")
})


app.use(errorHandler)
export default db;

// app.listen(3000,"0.0.0.0",()=>{
//     console.log("listening on 3000")
// })
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
