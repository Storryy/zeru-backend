const express = require('express')
require('dotenv').config();
const cors = require('cors');

const priceRoutes = require('./routes/price');
const scheduleRoutes = require('./routes/schedule');

const app = express()
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/price', priceRoutes);
app.use('/schedule', scheduleRoutes);

const port = 3000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
