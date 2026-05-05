import express from 'express'
const router=express.Router()
import serviceController from '../controller/service.js'
import auth from '../utils/authentication.js'

import adminAuth from '../utils/adminAuth.js'

router.get("/test",serviceController.test)
router.post("/create",adminAuth,serviceController.createService)
router.get("/services",serviceController.getAllServices)
router.get("/serviceById/:id",serviceController.getServiceById)
router.put("/update/:id",adminAuth,serviceController.updateService)
router.delete("/delete/:id",adminAuth,serviceController.deleteService)
router.post("/add_cart/:id",auth,serviceController.addServiceToCart)
router.get("/getCartServices",auth,serviceController.getCartServices)
router.delete("/remove-from-cart/:id",auth,serviceController.removeServiceFromCart);

export default router;