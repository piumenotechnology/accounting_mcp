// routes/features.routes.js

import express from 'express';
import {authModels} from '../models/user.models.js'

const router = express.Router();


router.get('/list-news', async (req, res) => {

})

router.post("/active-user", async (req, res) => {
  let { startDate, endDate } = req.body;

  // --- Auto default: last 7 days ---
  if (!startDate && !endDate) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    startDate = sevenDaysAgo.toISOString().split("T")[0];
    endDate = today.toISOString().split("T")[0];
  }

  // If only one is provided → reject
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return res.status(400).json({
      error: "Both startDate and endDate must be provided"
    });
  }

  // Validate date format
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      error: "Invalid date format, use YYYY-MM-DD"
    });
  }

  try {
    const data = await authModels.getActiveUser(startDate, endDate);
    return res.status(200).json({ 
      range: { startDate, endDate },
      data 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});



export default router;