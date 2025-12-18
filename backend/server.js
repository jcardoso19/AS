const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// --- CONFIGURAÇÃO ---
const PORT = process.env.PORT || 3000;
app.use(express.static(process.cwd())); 
app.use(express.json());
app.use(cors());

// --- INICIAR BASE DE DADOS (Cria sempre que arranca) ---
const dbFolder = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbFolder)) {
    try { fs.mkdirSync(dbFolder, { recursive: true }); } catch (e) {}
}

const dbPath = path.join(dbFolder, 'users.db');
const db = new sqlite3.Database(dbPath);

console.log("🔄 Sistema a iniciar...");

db.serialize(() => {
    // Tabelas
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, apelido TEXT, email TEXT UNIQUE, password TEXT, co2_saved REAL DEFAULT 0, points INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS wallets (user_id INTEGER PRIMARY KEY, saldo REAL DEFAULT 0.00, FOREIGN KEY(user_id) REFERENCES users(id))`);
    db.run(`CREATE TABLE IF NOT EXISTS cars (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, marca TEXT, modelo TEXT, matricula TEXT, battery_size REAL DEFAULT 50.0, connection_type INTEGER DEFAULT 33, FOREIGN KEY(user_id) REFERENCES users(id))`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, tipo TEXT, estacao TEXT, valor REAL, data DATETIME DEFAULT CURRENT_TIMESTAMP, detalhes TEXT, FOREIGN KEY(user_id) REFERENCES users(id))`);

    // --- UTILIZADOR INVISÍVEL (ID INTERNO) ---
    // Usamos este ID para guardar as coisas, mas o utilizador nunca o vê.
    const internalID = 'id_unico_sistema'; 
    
    db.run(`INSERT OR IGNORE INTO users (nome, apelido, email, password, co2_saved, points) VALUES ('Utilizador', 'Principal', ?, 'xxxxx', 12.5, 150)`, [internalID], function(err) {
        // Garante que a carteira existe
        db.get("SELECT id FROM users WHERE email = ?", [internalID], (err, row) => {
            if (row) db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 50.00)`, [row.id]);
        });
    });
});

// --- ROTAS API ---
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// --- ROTA DE ARRANQUE (CORRIGIDA PARA NÃO CRASHAR) ---
// O erro "Missing parameter name" acontecia aqui. Esta é a correção:
app.get('/*splat', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
    
    const file = path.join(process.cwd(), req.path);
    if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
        return res.sendFile(file);
    }
    
    // Se não encontrar ficheiro, mostra o site
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor pronto na porta ${PORT}`);
});