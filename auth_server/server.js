require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const bulkMessageRoutes = require('./routes/bulkMessage.routes');
const reportsRoutes = require('./routes/reports.routes');
const { verifyToken } = require('./middlewares/auth.middleware');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../'), { index: 'main.html' }));

// Hem /auth hem /api prefixlerini destekle
app.use('/auth', authRoutes);
app.use('/api', authRoutes);

app.use('/api', bulkMessageRoutes);
app.use('/auth', bulkMessageRoutes);

app.use('/api', reportsRoutes);
app.use('/auth', reportsRoutes);


// Basit test endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../main.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});