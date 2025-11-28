import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');
}
ensureData();

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://localhost:3000',
    'https://skylinkwebchat.com',
    'https://skylinkwebchat.loca.lt',
  ],
  credentials: true,
}));

function sign(user) {
  return jwt.sign({ email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) { res.status(400).json({ error: 'missing_fields' }); return; }
  const users = readUsers();
  if (users.find(u => u.email === email)) { res.status(409).json({ error: 'account_exists' }); return; }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    name,
    email,
    passwordHash,
    skypeId: `live:${name.replace(/\s/g, '').toLowerCase()}`,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    contacts: [],
    favorites: [],
    incomingRequests: [],
  };
  users.push(user);
  writeUsers(users);
  const token = sign(user);
  res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ name: user.name, email: user.email, skypeId: user.skypeId, avatar: user.avatar, contacts: [], favorites: [], incomingRequests: [] });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) { res.status(400).json({ error: 'missing_fields' }); return; }
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) { res.status(401).json({ error: 'invalid_credentials' }); return; }
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: 'invalid_credentials' }); return; }
  const token = sign(user);
  res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ name: user.name, email: user.email, skypeId: user.skypeId, avatar: user.avatar, contacts: user.contacts || [], favorites: user.favorites || [], incomingRequests: user.incomingRequests || [] });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.cookies.session || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'no_session' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => u.email === payload.email);
    if (!user) { res.status(401).json({ error: 'invalid_session' }); return; }
    res.json({ name: user.name, email: user.email, skypeId: user.skypeId, avatar: user.avatar, contacts: user.contacts || [] });
  } catch {
    res.status(401).json({ error: 'invalid_session' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth API on http://localhost:${PORT}/`);
});
