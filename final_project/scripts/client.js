const { createBookClient } = require('../router/general');
async function main() {
  const client = createBookClient();
  await client.getAllBooks((error, books) => {
    if (error) throw error;
    console.log('All books (async callback):', books);
  });
  console.log('ISBN (Promise):', await client.getBooksByISBN('1'));
  console.log('Author (async/await):', await client.getBooksByAuthor('Unknown'));
  console.log('Title (async/await):', await client.getBooksByTitle('Things Fall Apart'));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
