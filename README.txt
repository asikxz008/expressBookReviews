EXPRESS BOOK REVIEWS — FINAL PROJECT

GitHub: https://github.com/asikxz008/expressBookReviews
Original: https://github.com/ibm-developer-skills-network/expressBookReviews

RUN (Node.js 18+)
  cd final_project
  npm install
  npm start

The API listens at http://127.0.0.1:5000. PORT overrides the port.
Alternatively, pnpm install --frozen-lockfile uses the committed pnpm-lock.yaml.

CHECK
  npm test
  npm run client       (start the server first)
  npm run evidence     (starts its own clean server on an available port)

SUBMISSION
Open evidence/submission.txt for the actual curl commands and their outputs.
Each answer is also saved separately under its required assignment name.
Task 11 URL:
https://github.com/asikxz008/expressBookReviews/blob/main/final_project/router/general.js

The prompt names expressBookReview (singular); the working IBM upstream is
expressBookReviews (plural). The fork metadata in evidence/githubrepo.txt
identifies the actual parent repository.

The 8-point code criterion covers four Axios methods in general.js:
getAllBooks: async/await with a callback
getBooksByISBN: Promise callback
getBooksByAuthor: async/await
getBooksByTitle: async/await
scripts/client.js demonstrates all four; automated tests use real HTTP requests.

ENDPOINTS
GET    /                         All books, keyed by ISBN
GET    /isbn/:isbn               One book
GET    /author/:author           All books by author (exact, case-insensitive)
GET    /title/:title             All matching titles (exact, case-insensitive)
GET    /review/:isbn             Public book reviews
POST   /register                JSON: username, password
POST   /customer/login          JSON: username, password; saves session cookie
PUT    /customer/auth/review/:isbn  JSON: review (or ?review=...)
DELETE /customer/auth/review/:isbn  Delete only the logged-in user's review

Use curl -c cookies.txt during login and -b cookies.txt for review changes.
The evidence script generates evidence/credentials.json locally with fictional
demo credentials for --data-binary "@credentials.json". This file is ignored by
Git and is not published. Do not use those credentials for a real account.
The initial reviews are genuinely empty: {}. reviewadded.txt and
reviewupdated.txt show both creation and replacement of the user's review.
Evidence uses the available port assigned during its recorded run; use port
5000 for manual requests against npm start, or regenerate the evidence.

DATA AND CONCURRENCY
router/booksdb.js is the original IBM dataset, unchanged (10 books, keys 1-10).
To use another supplied JSON file, set BOOKS_JSON to its absolute path before
starting the server. It must be an object keyed by ISBN with author, title and
an optional reviews object. Data is cloned so source fixtures remain unchanged.

Passwords use salted asynchronous scrypt hashes. Duplicate registrations are
checked again after hashing. Each session owns one review per book. Review
writes are synchronous and do not overwrite another user's review. Tests cover
parallel registrations, parallel users and parallel reads, bad credentials,
missing books, forged cookies, Axios error handling and an external JSON fixture.

This educational app stores users, sessions and review changes in memory for
one Node process. They reset on restart. For a deployed multi-process service,
use shared persistent stores, HTTPS secure cookies and a stable SESSION_SECRET.
