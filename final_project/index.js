const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const app = express();
app.disable('x-powered-by');
app.set('json spaces', 2);
app.use(express.json({ limit: '16kb' }));
app.use('/customer', session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 3600000 }
}));
app.use('/customer/auth', (req, res, next) => {
  if (!req.session.username) return res.status(401).json({ message: 'User not logged in' });
  next();
});
app.use('/customer', require('./router/auth_users').authenticated);
app.use('/', require('./router/general').general);
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({ message: status >= 500 ? 'Internal server error' : error.message });
});
if (require.main === module) {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '127.0.0.1', () => console.log(`Bookshop listening on http://127.0.0.1:${port}`));
}
module.exports = app;
