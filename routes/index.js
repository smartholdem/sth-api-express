const express = require('express');
const router = express.Router();
const axios = require('axios');
const jsonFile = require('jsonfile');
const config = jsonFile.readFileSync('./config.json');


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'SmartHoldem API Wrapper' });
});

router.get('/blockchain', async function(req, res, next) {

  res.json(true)
});

module.exports = router;
