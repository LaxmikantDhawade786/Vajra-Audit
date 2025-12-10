// server.js — final version
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
// os removed: no MAC address logic required anymore

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const jwtSecret = process.env.JWT_SECRET || 'change_me_dev';
const DEFAULT_DB_NAME = process.env.DB_NAME || 'VajraAuth';
const SKIP_MAC_VALIDATION = process.env.SKIP_MAC_VALIDATION === 'true';

// State
let db = null;
let mongoClient = null;

// Build URI helper
function buildMongoUriFromParts() {
  const user = process.env.DB_USER;
  const passRaw = process.env.DB_PASS;
  const cluster = process.env.DB_CLUSTER;
  const dbName = process.env.DB_NAME || DEFAULT_DB_NAME;

  if (user && passRaw && cluster) {
    const pass = encodeURIComponent(passRaw);
    return `mongodb+srv://${user}:${pass}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=VajraAuth`;
  }
  return null;
}

// Connect to MongoDB (supports MONGO_URI or DB_* parts)
async function connectDB() {
  const rawUri = process.env.MONGO_URI;
  let uri = rawUri || buildMongoUriFromParts();

  if (!uri) {
    console.warn('⚠️  No MongoDB URI provided (set MONGO_URI or DB_USER/DB_PASS/DB_CLUSTER). Database features disabled.');
    return;
  }

  // Mask password in logs (show username and host only)
  const maskedPreview = uri.replace(/:\/\/(.*?):(.*?)@/, '://$1:*****@');
  console.log('Mongo URI preview:', maskedPreview);

  try {
    // Use ServerApiVersion.v1 to opt into stable API if desired (optional)
    // You can omit the serverApi option and just do new MongoClient(uri)
    mongoClient = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    await mongoClient.connect();
    db = mongoClient.db(process.env.DB_NAME || DEFAULT_DB_NAME);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    // Show a concise error message and keep the stack for debug
    console.error('❌ Failed to connect to MongoDB:', err.message || err);
    console.debug(err);
    console.warn('Continuing without DB connection; APIs requiring DB will return 503.');
    db = null;
  }
}

// Middleware & parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static pages (adjust filenames/paths as needed)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'home.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/pricing', (req, res) => res.sendFile(path.join(__dirname, 'pricing-standalone.html')));
app.get('/payment', (req, res) => res.sendFile(path.join(__dirname, 'payment.html')));
app.get('/download', (req, res) => res.sendFile(path.join(__dirname, 'download.html')));

// Health check 
app.get('/ping', (req, res) => res.json({ ok: true }));

// Registration endpoint
app.post('/api/register', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'Database not connected' });

  const { name, company, email, password, uniqueId } = req.body;
  if (!name || !company || !email || !password || !uniqueId) {
    return res.status(400).json({ message: 'Name, company, email, password and uniqueId are required' });
  }

  try {
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name,
      company,
      email,
      password: hashedPassword,
      tokens: 0,
      uniqueId,
      createdAt: new Date(),
    };

    await db.collection('users').insertOne(newUser);
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  if (!db) return res.status(503).json({ message: 'Database not connected' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '1h' });
    return res.json({ token, user: { name: user.name, email: user.email, tokens: user.tokens } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.userId;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
}

// Protected route: get user
app.get('/api/user', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ message: 'Database not connected' });

  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user) });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ name: user.name, email: user.email, tokens: user.tokens });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Protected route: update tokens
app.post('/api/update-tokens', authMiddleware, async (req, res) => {
  if (!db) return res.status(503).json({ message: 'Database not connected' });

  const { amount } = req.body;
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ message: 'Invalid token amount' });
  }

  try {
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user) },
      { $inc: { tokens: amount } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ message: 'Tokens updated successfully' });
  } catch (err) {
    console.error('Update tokens error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Start server (connect DB first, then start)
(async () => {
  await connectDB();
  app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
})();

// Graceful shutdown: close Mongo client if open
process.on('SIGINT', async () => {
  console.log('SIGINT received: closing Mongo client and exiting...');
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('Mongo client closed');
    } catch (e) {
      console.error('Error closing Mongo client:', e);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received: closing Mongo client and exiting...');
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('Mongo client closed');
    } catch (e) {
      console.error('Error closing Mongo client:', e);
    }
  }
  process.exit(0);
});
