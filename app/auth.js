const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord');
const axios = require('axios');
const fs = require('fs');
const randomstring = require("randomstring");
const router = express.Router();

const { db } = require('../function/db');
const { logError } = require('../function/logError')

const skyport = {
  url: process.env.SKYPORT_URL,
  key: process.env.SKYPORT_KEY
};

// Configure passport to use Discord
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Skyport account system
async function checkAccount(email, username, id) {
  try {
    // Check if user already exists in Skyport
    let response;
    try {
      response = await axios.post(`${skyport.url}/api/getUser`, {
        type: 'email',
        value: email
      }, {
        headers: {
          'x-api-key': skyport.key,
          'Content-Type': 'application/json'
        }
      });

      // User already exists, log and return
      console.log('User already exists in Skyport. User ID:', response.data.userId);
      await db.set(`id-${email}`, response.data.userId);
      return;
    } catch (err) {
      if (err.response && err.response.status !== 404) {
        logError('Failed to check user existence in Skyport', err);
        throw err;
      }
    }

    // Generate a random password for new user
    const password = randomstring.generate({ length: process.env.PASSWORD_LENGTH });

    // Create user in Skyport
    try {
      response = await axios.post(`${skyport.url}/api/users/create`, {
        username,
        email,
        password,
        userId: id
      }, {
        headers: {
          'x-api-key': skyport.key,
          'Content-Type': 'application/json'
        }
      });

      // Log creation and set password in database
      await db.set(`password-${email}`, password);
      await db.set(`id-${email}`, response.data.userId);
      logError('User created in Skyport');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        console.log('User creation conflict: User already exists in Skyport.');
      } else {
        logError('Failed to create user in Skyport', err);
        throw err;
      }
    }
  } catch (error) {
    logError('Error during account check', error);
    throw error;
  }
}

// Discord login route
router.get('/login/discord', passport.authenticate('discord'));

// Discord callback route
router.get('/callback/discord', passport.authenticate('discord', {
  failureRedirect: '/login'
}), (req, res) => {
  checkAccount(req.user.email, req.user.username, req.user.id)
    .then(() => res.redirect(req.session.returnTo || '/dashboard'))
    .catch(error => {
      logError('Error during account check', error);
      res.redirect('/dashboard');
    });
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logError('Logout failed', err);
      return res.redirect('/');
    }
    res.redirect('/');
  });
});

module.exports = router;