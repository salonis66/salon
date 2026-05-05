import express from 'express'
const router=express.Router()
import offerController from '../controller/offer.js'
import adminAuth from '../utils/adminAuth.js'

router.post("/create",adminAuth,offerController.createOffer)
router.put("/update/:id",adminAuth,offerController.updateOffer)
router.get("/getOffers",offerController.getAllOffers)
router.get("/getOffersById/:id",offerController.getOfferById)
router.get("/getHomePageOffers",offerController.getHomepageOffers)
router.delete("/delete/:id",adminAuth,offerController.deleteOffer)


export default router;