const express = require('express');
const axios = require('axios');

const { db } = require('../function/db');
const { calculateResource } = require('../function/calculateResource.js');
const { ensureAuthenticated } = require('../function/ensureAuthenticated.js');

const router = express.Router();

const skyport = {
  url: process.env.SKYPORT_URL,
  key: process.env.SKYPORT_KEY
};

// Existing resources (the ones in use on servers)
const existingResources = async (email) => {
  return {
    "cpu": await calculateResource(email, 'Cpu'),
    "ram": await calculateResource(email, 'Memory'),
    "disk": await calculateResource(email, 'Disk')
  };
};

// Max resources (the ones the user has purchased or been given)
const maxResources = async (email) => {
  return {
    "cpu": await db.get(`cpu-${email}`),
    "ram": await db.get(`ram-${email}`),
    "disk": await db.get(`disk-${email}`)
  };
};

// Delete server
router.get('/delete', ensureAuthenticated, async (req, res) => {
  if (!req.user || !req.user.email || !req.user.id) return res.redirect('/login/discord');
    if (!req.query.id) return res.redirect('../dashboard?err=MISSINGPARAMS');
    try {
        const userId = await db.get(`id-${req.user.email}`);
        const serverId = req.query.id;

        const server = await axios.post(`${skyport.url}/api/getInstance`, {
          id: serverId
        }, {
          headers: {
            'x-api-key': skyport.key
          }
        });
        console.log(server.data)

        if (server.data.User !== userId) return res.redirect('../dashboard?err=DONOTOWN');

        console.log("a")
        await axios.delete(`${skyport.url}/api/instance/delete`, {
          headers: {
            'x-api-key': skyport.key
          },
          data: {
            id: serverId
          }
        });
        
        console.log("b")

        res.redirect('/dashboard?success=DELETE');
    } catch (error) {
        if (error.response && error.response.status === 404) return res.redirect('../dashboard?err=NOTFOUND');
        
        console.error(error);
        res.redirect('../dashboard?err=INTERNALERROR');
    }
});

// Create server
router.get('/create', ensureAuthenticated, async (req, res) => {
  if (!req.user || !req.user.email || !req.user.id) return res.redirect('/login/discord');
  if (!req.query.name || !req.query.node || !req.query.image || !req.query.cpu || !req.query.ram || !req.query.disk) return res.redirect('../create-server?err=MISSINGPARAMS');
  
  // Check if user has enough resources to create a server

  const max = await maxResources(req.user.email);
  const existing = await existingResources(req.user.email);

  if (parseInt(req.query.cpu) > parseInt(max.cpu - existing.cpu)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');
  if (parseInt(req.query.ram) > parseInt(max.ram - existing.ram)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');
  if (parseInt(req.query.disk) > parseInt(max.disk - existing.disk)) return res.redirect('../create-server?err=NOTENOUGHRESOURCES');

  // Ensure resources are above 128MB / 10%

  if (parseInt(req.query.ram) < 128) return res.redirect('../create-server?err=INVALID');
  if (parseInt(req.query.cpu) < 10) return res.redirect('../create-server?err=INVALID');
  if (parseInt(req.query.disk) < 128) return res.redirect('../create-server?err=INVALID');

  // Name checks

  if (req.query.name.length > 100) return res.redirect('../create-server?err=INVALID');
  if (req.query.name.length < 3) return res.redirect('../create-server?err=INVALID');

  // Make sure node, image, resources are numbers

  if (isNaN(req.query.node) || isNaN(req.query.image) || isNaN(req.query.cpu) || isNaN(req.query.ram) || isNaN(req.query.disk)) return res.redirect('../create-server?err=INVALID');
  if (req.query.cpu < 1 || req.query.ram < 1 || req.query.disk < 1) return res.redirect('../create-server?err=INVALID');


  // need to remake that part
  try {
      const userId = await db.get(`id-${req.user.email}`);
      const name = req.query.name;
      const node = parseInt(req.query.node);
      const imageId = parseInt(req.query.image);
      const cpu = parseInt(req.query.cpu);
      const ram = parseInt(req.query.ram);
      const disk = parseInt(req.query.disk);

      const images = require('../storage/images.json');
      const image = images.find(e => e.id === imageId);
      if (!image) return res.redirect('../create-server?err=INVALID_IMAGE');

      const dockerImage = egg.docker_image;
      const startupCommand = egg.startup;
      const environment = egg.settings;

      await axios.post(`${skyport[0].url}/api/application/servers`, {
          name: name,
          user: userId,
          egg: eggId,
          docker_image: dockerImage,
          startup: startupCommand,
          environment: environment,
          limits: {
              memory: ram,
              swap: -1,
              disk: disk,
              io: 500,
              cpu: cpu
          },
          feature_limits: {
              databases: database,
              backups: backup,
              allocations: allocation
          },
          deploy: {
            locations: [location],
            dedicated_ip: false,
            port_range: []
          }
      }, {
          headers: {
              'Authorization': `Bearer ${skyport[0].key}`
          }
      });

      res.redirect('../dashboard?success=CREATED');
  } catch (error) {
      console.error(error);
      res.redirect('../create-server?err=ERRORONCREATE');
  }
});

router.get('/create-server', ensureAuthenticated, async (req, res) => {
  if (!req.user || !req.user.email || !req.user.id) return res.redirect('/login/discord');
    res.render('create', {
      req: req, // Requests (queries) 
      name: process.env.APP_NAME, // Dashboard name
      user: req.user, // User info (if logged in)
      admin: await db.get(`admin-${req.user.email}`), // Admin status
      coins: await db.get(`coins-${req.user.email}`), // Coins
      images: require('../storage/images.json'), // Images data
      nodes: require('../storage/nodes.json') // Nodes data
    });
});

module.exports = router;