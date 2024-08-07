const { db } = require('./db');

async function checkPassword(email) {
  try {
    const password = await db.get(`password-${email}`);

    if (!password) return null;

    return password;
  } catch (error) {
    console.error('Error retrieving password:', error);
    throw error;
  }
}

module.exports = { checkPassword };