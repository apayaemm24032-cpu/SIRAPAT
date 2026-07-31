const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = 'rahasia_super_aman_123'; // Bebas ganti teks ini

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Konfigurasi Koneksi Database (Otomatis menyesuaikan Laptop / Railway)
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'sirapat',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) console.error('Gagal terhubung ke MySQL:', err);
    else console.log('Terhubung ke database MySQL!');
});

// ==================== ENDPOINT AUTENTIKASI ====================

// 1. REGISTER USER
app.post('/api/register', async (req, res) => {
    const { nama, email, password, role } = req.body;

    if (!nama || !email || !password) {
        return res.status(400).json({ message: 'Semua field harus diisi!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)';
        
        db.query(query, [nama, email, hashedPassword, role || 'user'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'Email sudah terdaftar!' });
                }
                return res.status(500).json({ message: 'Gagal mendaftar user' });
            }
            res.status(201).json({ message: 'Registrasi berhasil!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
});

// 2. LOGIN USER
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login berhasil!',
            token,
            user: { id: user.id, nama: user.nama, email: user.email, role: user.role }
        });
    });
});

// RUN SERVER
app.listen(3000, () => {
    console.log('Server berjalan di port 3000');
    // Middleware Cek Role Admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Akses ditolak! Khusus untuk Admin.' });
    }
};

// Contoh Endpoint Tambah Rapat (Harus Login & Harus Admin)
app.post('/api/rapat', authenticateToken, isAdmin, (req, res) => {
    const { judul, tanggal, lokasi } = req.body;
    db.query('INSERT INTO rapat (judul, tanggal, lokasi) VALUES (?, ?, ?)', 
    [judul, tanggal, lokasi], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Rapat berhasil ditambahkan!' });
    });
});
});