const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// --- 1. CONFIGURAÇÃO INICIAL ---
const PORT = process.env.PORT || 3000;
app.use(express.static(process.cwd())); 
app.use(express.json());
app.use(cors());

// --- 2. OBRIGAR A DB A INICIAR ANTES DO SERVIDOR ---
const dbFolder = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

const dbPath = path.join(dbFolder, 'users.db');
const db = new sqlite3.Database(dbPath);

console.log("🔄 A inicializar Base de Dados...");

db.serialize(() => {
    // 1. Criar Tabelas (Se não existirem)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nome TEXT, apelido TEXT, email TEXT UNIQUE, 
        telefone TEXT, morada TEXT, password TEXT, 
        co2_saved REAL DEFAULT 0, points INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS wallets (
        user_id INTEGER PRIMARY KEY, 
        saldo REAL DEFAULT 0.00, 
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        marca TEXT, modelo TEXT, matricula TEXT, 
        battery_size REAL DEFAULT 50.0, connection_type INTEGER DEFAULT 33, 
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        tipo TEXT, estacao TEXT, valor REAL, 
        data DATETIME DEFAULT CURRENT_TIMESTAMP, 
        detalhes TEXT, 
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 2. Garantir que o Utilizador Padrão Existe (Reset à prova de falhas)
    const emailFixo = 'cliente@multipower.pt';
    db.get("SELECT id FROM users WHERE email = ?", [emailFixo], (err, row) => {
        if (!row) {
            console.log("⚠️ Utilizador não encontrado. A recriar...");
            db.run(`INSERT INTO users (nome, apelido, email, password, co2_saved, points) 
                    VALUES ('Cliente', 'Demo', ?, '1234', 12.5, 150)`, [emailFixo], function(err) {
                if (!err) {
                    const newId = this.lastID;
                    db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 50.00)`, [newId]);
                    console.log("✅ Utilizador e Carteira recriados com sucesso!");
                }
            });
        } else {
            // Garante que a carteira também existe mesmo que o user já exista
            db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 50.00)`, [row.id]);
            console.log("✅ Base de dados pronta e verificada.");
        }
    });
});

// --- 3. ROTAS ---
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// Rota de Fallback para o Frontend
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
    // Se pedir login.html (que não existe), manda para index ou conta
    if (req.path.includes('login.html')) return res.redirect('/index.html');
    
    const file = path.join(process.cwd(), req.path);
    if (fs.existsSync(file)) return res.sendFile(file);
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

// --- 4. INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor a correr na porta ${PORT}`);
});