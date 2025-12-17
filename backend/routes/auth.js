const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para a base de dados na raiz do projeto
const dbPath = path.resolve(__dirname, '../../db/users.db');
const db = new sqlite3.Database(dbPath);

// ROTA: Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err || !row) return res.status(401).json({ error: "Credenciais inválidas" });
        res.json(row);
    });
});

// ROTA: Perfil
router.get('/perfil/:email', (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json(row || {});
    });
});

// ROTA: Saldo/Wallet
router.get('/wallet/:email', (req, res) => {
    db.get("SELECT saldo FROM wallets JOIN users ON users.id = wallets.user_id WHERE users.email = ?", [req.params.email], (err, row) => {
        if (err) return res.status(500).json(err);
        res.json(row || { saldo: 0 });
    });
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    db.all("SELECT cars.* FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

// ROTA: Adicionar Carro
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size } = req.body;
    db.run("INSERT INTO cars (user_id, marca, modelo, matricula, battery_size) VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?)", 
    [email, marca, modelo, matricula, battery_size], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ROTA: Transações
router.get('/transacoes/:email', (req, res) => {
    db.all("SELECT * FROM transactions JOIN users ON users.id = transactions.user_id WHERE users.email = ?", [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

module.exports = router;