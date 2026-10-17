const express = require('express');
const axios = require('axios');
const books = require('./catalog');
const { registerUser } = require('./auth_users');
const public_users = express.Router();

public_users.post('/register', async (req, res, next) => {
  try {
    await registerUser(req.body.username, req.body.password);
    res.status(201).json({ message: 'User successfully registered. You can now log in.' });
  } catch (error) { next(error); }
});
public_users.get('/', (req, res) => res.json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found' });
  res.json(books[req.params.isbn]);
});
for (const field of ['author', 'title']) {
  public_users.get(`/${field}/:${field}`, (req, res) => {
    const query = req.params[field].trim().toLocaleLowerCase();
    const matches = Object.fromEntries(Object.entries(books).filter(([, book]) => book[field].toLocaleLowerCase() === query));
    if (!Object.keys(matches).length) return res.status(404).json({ message: 'No matching books found' });
    res.json(matches);
  });
}
public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found' });
  res.json(books[req.params.isbn].reviews);
});

// Tasks 11-14: Axios makes real HTTP requests to the public API above.
// The routes read the catalog directly, so requests never recurse.
function createBookClient(baseURL = process.env.BOOKSHOP_URL || 'http://127.0.0.1:5000') {
  const client = axios.create({ baseURL, timeout: 5000, proxy: false });
  return {
    // Async/await with optional Node-style callback.
    async getAllBooks(callback) {
      let data;
      try { ({ data } = await client.get('/')); }
      catch (error) {
        if (callback) { callback(error); return; }
        throw error;
      }
      if (callback) callback(null, data);
      return data;
    },
    // Promise callback for ISBN lookup.
    getBooksByISBN(isbn) {
      return client.get(`/isbn/${encodeURIComponent(isbn)}`).then(response => response.data);
    },
    async getBooksByAuthor(author) {
      const { data } = await client.get(`/author/${encodeURIComponent(author)}`);
      return data;
    },
    async getBooksByTitle(title) {
      const { data } = await client.get(`/title/${encodeURIComponent(title)}`);
      return data;
    }
  };
}
module.exports = { general: public_users, createBookClient };
