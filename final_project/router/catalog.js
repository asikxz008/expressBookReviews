const fs = require('node:fs');
const path = require('node:path');
// Preserve the original IBM dataset; optionally load the teacher-supplied JSON.
const source = process.env.BOOKS_JSON
  ? JSON.parse(fs.readFileSync(path.resolve(process.env.BOOKS_JSON), 'utf8'))
  : require('./booksdb');
if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Books JSON must be an object keyed by ISBN');
const books = structuredClone(source);
for (const book of Object.values(books)) {
  if (!book || typeof book.author !== 'string' || typeof book.title !== 'string' ||
      (book.reviews !== undefined && (!book.reviews || typeof book.reviews !== 'object' || Array.isArray(book.reviews)))) {
    throw new Error('Each book needs author, title and an optional reviews object');
  }
  book.reviews ??= {};
}
module.exports = books;
