import express from 'express'
const router=express.Router()
import auth from '../utils/authentication.js'

import  adminAuth  from '../utils/adminAuth.js'

import adminController from '../controller/admin.js'

router.post("/register",adminController.adminRegister)
router.post("/login",adminController.adminLogin)
router.post("/logout", adminController.adminLogout);
router.get("/profile",adminAuth,adminController.getAdminProfile)
router.post("/update",adminAuth,adminController.updateAdminProfile)
router.delete("/delete",adminAuth,adminController.deleteAdmin)

export default router;