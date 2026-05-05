import express from 'express'
const router=express.Router()
import userController from '../controller/user.js'
import auth from '../utils/authentication.js'

import adminAuth from '../utils/adminAuth.js'

//user
router.get("/auth/check",auth,userController.check)
router.get("/test",userController.test)
router.post("/register",userController.register)
router.post("/login",userController.login)
router.put("/update",auth,userController.updateUser)
router.get("/getUserProfile",auth,userController.getUserProfile)
router.get("/getUsers",adminAuth,userController.getAllUsers)
router.delete("/delete",auth,userController.deleteUser)
router.get("/logout",userController.logout)

console.log("routes")
export default router;