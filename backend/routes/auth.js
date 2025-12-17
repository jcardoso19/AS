const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// IMPORTANTE: O caminho tem de apontar exatamente para onde o init_db criou a BD
const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath);

// ROTA: Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Incorreto" });
        res.json(user);
    });
});

// ROTA: Saldo (Wallet)
router.get('/wallet/:email', (req, res) => {
    db.get("SELECT saldo FROM wallets JOIN users ON users.id = wallets.user_id WHERE users.email = ?", 
    [req.params.email], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json(row || { saldo: 0 });
    });
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    db.all("SELECT cars.* FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", 
    [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

// ROTA: Transações/Reservas
router.get('/transacoes/:email', (req, res) => {
    db.all("SELECT transactions.* FROM transactions JOIN users ON users.id = transactions.user_id WHERE users.email = ?", 
    [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

// ROTA: Confirmar Pagamento/Reserva
router.post('/confirmar-pagamento', (req, res) => {
    const { email, valor, estacao } = req.body;
    db.serialize(() => {
        db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = (SELECT id FROM users WHERE email = ?)", [valor, email]);
        db.run("INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES ((SELECT id FROM users WHERE email = ?), 'Reserva', ?, ?, 'Pagamento App')", 
        [email, estacao, valor], (err) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        });
    });
});

module.exports = router;