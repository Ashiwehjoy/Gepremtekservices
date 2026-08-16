const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gepremtekservices.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThisPassword';
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-secret-change-me';
const dataDir = path.join(__dirname, 'data');
const inquiriesFile = path.join(dataDir, 'inquiries.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(inquiriesFile)) fs.writeFileSync(inquiriesFile, '[]');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const services = [
  { id: 1, title: 'Electrical Contracting', icon: '⚡', text: 'Professional electrical contracting for residential, commercial and industrial projects.' },
  { id: 2, title: 'Electrical Installation', icon: '🔧', text: 'Safe, dependable electrical installation, wiring, equipment connection and commissioning.' },
  { id: 3, title: 'Maintenance & Repairs', icon: '🛠️', text: 'Preventive maintenance, troubleshooting and repairs to keep electrical systems reliable.' },
  { id: 4, title: 'Sales of Electrical Materials', icon: '📦', text: 'Supply of quality electrical materials and equipment for projects and maintenance work.' },
  { id: 5, title: 'Solar & Power Solutions', icon: '☀️', text: 'Practical solar and backup-power solutions designed around your energy needs.' },
  { id: 6, title: 'General Engineering Services', icon: '🏗️', text: 'Engineering support and technical services delivered with attention to quality and safety.' }
];

const projects = [
  { title: 'Industrial Electrical Installation', category: 'Industrial', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Solar Power Solution', category: 'Solar', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80' },
  { title: 'Electrical Maintenance', category: 'Maintenance', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80' }
];

function readInquiries() {
  try { return JSON.parse(fs.readFileSync(inquiriesFile, 'utf8')); }
  catch { return []; }
}
function writeInquiries(items) {
  fs.writeFileSync(inquiriesFile, JSON.stringify(items, null, 2));
}
function makeToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.email === ADMIN_EMAIL && data.exp > Date.now();
  } catch { return false; }
}
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session;
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Gepremtek Services API' }));
app.get('/api/services', (req, res) => res.json(services));
app.get('/api/projects', (req, res) => res.json(projects));

app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, service, message } = req.body || {};
  if (!name || !phone || !service || !message) return res.status(400).json({ error: 'Please complete all required fields.' });
  if (String(message).length > 3000) return res.status(400).json({ error: 'Message is too long.' });
  const items = readInquiries();
  const inquiry = {
    id: crypto.randomUUID(),
    name: String(name).trim().slice(0, 100),
    email: String(email || '').trim().slice(0, 150),
    phone: String(phone).trim().slice(0, 40),
    service: String(service).trim().slice(0, 120),
    message: String(message).trim(),
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  items.unshift(inquiry);
  writeInquiries(items);
  res.status(201).json({ message: 'Thank you. Your request has been received.', inquiryId: inquiry.id });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin credentials.' });
  res.json({ token: makeToken(email), email });
});

app.get('/api/admin/inquiries', auth, (req, res) => res.json(readInquiries()));
app.patch('/api/admin/inquiries/:id', auth, (req, res) => {
  const items = readInquiries();
  const item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Inquiry not found.' });
  if (req.body.status) item.status = ['new', 'in-progress', 'closed'].includes(req.body.status) ? req.body.status : item.status;
  writeInquiries(items);
  res.json(item);
});
app.delete('/api/admin/inquiries/:id', auth, (req, res) => {
  const items = readInquiries();
  const next = items.filter(x => x.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ error: 'Inquiry not found.' });
  writeInquiries(next);
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Gepremtek website running on port ${PORT}`));
