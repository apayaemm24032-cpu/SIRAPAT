const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname)));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'db_sirapat'
});

db.connect((err) => {
    if (err) console.error('Gagal terhubung ke MySQL:', err);
    else console.log('Terhubung ke database MySQL!');
});

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// API Tambah Rapat
app.post('/api/meetings', (req, res) => {
    const { judul, kode_presensi, durasi_menit } = req.body;
    if (!judul || !kode_presensi) {
        return res.status(400).json({ status: 'error', message: 'Judul dan Kode Rapat wajib diisi!' });
    }

    let expired_at = null;
    if (durasi_menit && parseInt(durasi_menit) > 0) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + parseInt(durasi_menit));
        expired_at = now.toISOString().slice(0, 19).replace('T', ' ');
    }

    const query = 'INSERT INTO meetings (judul, kode_presensi, expired_at) VALUES (?, ?, ?)';
    db.query(query, [judul, kode_presensi.toUpperCase(), expired_at], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ status: 'error', message: 'Kode Rapat sudah digunakan!' });
            }
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.json({ status: 'success', message: 'Rapat berhasil dibuat!' });
    });
});

// API Submit Presensi
app.post('/api/attendances', (req, res) => {
    const { user_id, kode_presensi, status } = req.body;
    if (!user_id || !kode_presensi) {
        return res.status(400).json({ status: 'error', message: 'User ID dan Kode Rapat wajib diisi!' });
    }

    const findMeetingQuery = 'SELECT id, expired_at FROM meetings WHERE kode_presensi = ?';
    db.query(findMeetingQuery, [kode_presensi.toUpperCase()], (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        if (results.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Kode Rapat tidak ditemukan!' });
        }

        const meeting = results[0];

        if (meeting.expired_at && new Date() > new Date(meeting.expired_at)) {
            return res.status(400).json({ status: 'error', message: 'Sesi presensi untuk rapat ini telah BERAKHIR!' });
        }

        const statusKehadiran = status || 'Hadir';
        const insertQuery = 'INSERT INTO attendances (user_id, meeting_id, status) VALUES (?, ?, ?)';
        db.query(insertQuery, [user_id, meeting.id, statusKehadiran], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ status: 'error', message: 'Anda sudah mengisi presensi untuk rapat ini!' });
                }
                return res.status(500).json({ status: 'error', message: err.message });
            }
            res.json({ status: 'success', message: 'Presensi berhasil dicatat!' });
        });
    });
});

// API Get Rekap Presensi
app.get('/api/admin/rekap', (req, res) => {
    const query = `
        SELECT a.id as attendance_id, a.user_id, a.status, m.judul, m.kode_presensi, a.waktu_hadir 
        FROM attendances a
        JOIN meetings m ON a.meeting_id = m.id
        ORDER BY a.waktu_hadir DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: results });
    });
});

// API Get Statistik Dashboard
app.get('/api/admin/stats', (req, res) => {
    const statsQuery = `
        SELECT 
            (SELECT COUNT(*) FROM meetings) as total_rapat,
            (SELECT COUNT(*) FROM attendances) as total_kehadiran,
            (SELECT COUNT(*) FROM attendances WHERE DATE(waktu_hadir) = CURDATE()) as kehadiran_hari_ini
    `;
    db.query(statsQuery, (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: results[0] });
    });
});

// API Hapus Data Kehadiran
app.delete('/api/attendances/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM attendances WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Data kehadiran berhasil dihapus!' });
    });
});

app.listen(3000, () => console.log('Server berjalan di http://localhost:3000'));
