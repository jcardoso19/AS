const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho absoluto para a BD dentro da pasta backend/db/
const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Erro ao abrir BD nas rotas:", err.message);
});

// ROTA: Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err) return res.status(500).json({ error: "Erro interno" });
        if (!row) return res.status(401).json({ error: "Credenciais inválidas" });
        res.json(row);
    });
});

// ROTA: Saldo
router.get('/wallet/:email', (req, res) => {
    db.get("SELECT saldo FROM wallets JOIN users ON users.id = wallets.user_id WHERE users.email = ?", 
    [req.params.email], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json(row || { saldo: 0 });
    });
});

// ROTA: Carros
router.get('/carros/:email', (req, res) => {
    db.all("SELECT * FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", 
    [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

// ROTA: Transações
router.get('/transacoes/:email', (req, res) => {
    db.all("SELECT * FROM transactions JOIN users ON users.id = transactions.user_id WHERE users.email = ?", 
    [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

module.exports = router;