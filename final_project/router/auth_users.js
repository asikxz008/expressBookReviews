const express = require('express');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const books = require('./catalog');
const deriveKey = promisify(scrypt);
const regd_users = express.Router();
const users = new Map();
const fail = (status, message) => Object.assign(new Error(message), { status });
const isValid = username => users.has(username);

async function registerUser(username, password) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,40}$/.test(username) ||
      typeof password !== 'string' || password.length < 6 || password.length > 200) {
    throw fail(400, 'Use a username of 3-40 letters, digits or underscores and a password of 6-200 characters.');
  }
  if (isValid(username)) throw fail(409, 'User already exists');
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64);
  // Recheck after async hashing to prevent duplicate concurrent registration.
  if (isValid(username)) throw fail(409, 'User already exists');
  users.set(username, { salt, hash });
}
async function authenticatedUser(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) return false;
  const user = users.get(username);
  if (!user) return false;
  const candidate = await deriveKey(password, user.salt, 64);
  return timingSafeEqual(candidate, user.hash);
}
regd_users.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!await authenticatedUser(username, password)) return res.status(401).json({ message: 'Invalid username or password' });
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.username = username;
      req.session.save(error => {
        if (error) return next(error);
        res.json({ message: 'Customer successfully logged in', username });
      });
    });
  } catch (error) { next(error); }
});
regd_users.put('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found' });
  const review = req.body.review ?? req.query.review;
  if (typeof review !== 'string' || !review.trim() || review.length > 5000) return res.status(400).json({ message: 'Provide a nonempty review up to 5000 characters' });
  const reviews = books[req.params.isbn].reviews;
  const updated = Object.hasOwn(reviews, req.session.username);
  Object.defineProperty(reviews, req.session.username, { value: review.trim(), enumerable: true, configurable: true, writable: true });
  res.json({ message: updated ? 'Review successfully updated' : 'Review successfully added', reviews });
});
regd_users.delete('/auth/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found' });
  const reviews = books[req.params.isbn].reviews;
  if (!Object.hasOwn(reviews, req.session.username)) return res.status(404).json({ message: 'No review by this user for this book' });
  delete reviews[req.session.username];
  res.json({ message: 'Review successfully deleted', reviews });
});
module.exports = { authenticated: regd_users, registerUser, isValid, authenticatedUser, users };
