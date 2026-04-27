'use strict';

const { Router } = require('express');

const router = Router();

router.use('/auth',            require('./auth'));
router.use('/warehouses',      require('./warehouses'));
router.use('/trucks',          require('./trucks'));
router.use('/users',           require('./users'));
router.use('/supply-houses',   require('./supplyHouses'));
router.use('/materials',       require('./materials'));
router.use('/stock',           require('./stock'));
router.use('/restock-batches', require('./restockBatches'));
router.use('/tech-bins',       require('./techBins'));
router.use('/purchase-orders', require('./purchaseOrders'));
router.use('/tools',           require('./tools'));
router.use('/equipment',       require('./equipment'));
router.use('/it-assets',       require('./itAssets'));
router.use('/jobs',            require('./jobs'));
router.use('/vendors',         require('./vendors'));
router.use('/notifications',   require('./notifications'));
router.use('/settings',        require('./settings'));
router.use('/st',              require('./servicetitan'));
router.use('/admin',           require('./admin'));

module.exports = router;
