const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

initDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/homes',     require('./routes/homes'));
app.use('/api/rooms',     require('./routes/rooms'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/tasks',     require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/presets',   require('./routes/presets').router);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HomeSKED running on http://0.0.0.0:${PORT}`);
});
