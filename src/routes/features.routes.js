// routes/features.routes.js

import express from 'express';
import {authModels} from '../models/user.models.js'

const router = express.Router();


router.get('/list-news', async (req, res) => {

})

router.get('/user/activity', async (req, res) => {
    const data = await authModels.getActiveUser();
    res.status(200).json({
        data: data
    })
})


export default router;