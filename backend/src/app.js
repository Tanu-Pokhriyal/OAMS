const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');
const { setIO } = require('./socket/notificationHelper');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Socket.IO setup
setIO(io);
socketHandler(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/campaigns', require('./routes/campaignRoutes'));
app.use('/api/site-surveys', require('./routes/siteSurveyRoutes'));
app.use('/api/creatives', require('./routes/creativeRoutes'));
app.use('/api/work-orders', require('./routes/workOrderRoutes'));
app.use('/api/installations', require('./routes/installationRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
const JWT_SECRET_DEFAULT = 'billboard_mgmt_jwt_secret_key_2026';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = JWT_SECRET_DEFAULT;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
