const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Aponta para a mesma pasta 'db' na raiz
const dbPath = path.join(process.cwd(), 'db', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Erro ao abrir BD:", err.message);
});

// ROTA: Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err || !row) return res.status(401).json({ error: "Inválido" });
        res.json(row);
    });
});

// ROTA: Perfil
router.get('/perfil/:email', (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, row) => {
        res.json(row || {});
    });
});

// ROTA: Saldo
router.get('/wallet/:email', (req, res) => {
    db.get("SELECT saldo FROM wallets JOIN users ON users.id = wallets.user_id WHERE users.email = ?", [req.params.email], (err, row) => {
        res.json(row || { saldo: 0 });
    });
});

// ROTA: Adicionar Saldo
router.post('/adicionar-saldo', (req, res) => {
    const { email, valor } = req.body;
    db.run("UPDATE wallets SET saldo = saldo + ? WHERE user_id = (SELECT id FROM users WHERE email = ?)", [valor, email], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, valor_adicionado: valor });
    });
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    db.all("SELECT cars.* FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", [req.params.email], (err, rows) => {
        res.json(rows || []);
    });
});

// ROTA: Adicionar Carro
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    db.run("INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?)", 
    [email, marca, modelo, matricula, battery_size || 50, connection_type || 33], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ROTA: Remover Carro
router.post('/remover-carro', (req, res) => {
    db.run("DELETE FROM cars WHERE id = ?", [req.body.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ROTA: Transações
router.get('/transacoes/:email', (req, res) => {
    db.all("SELECT * FROM transactions JOIN users ON users.id = transactions.user_id WHERE users.email = ?", [req.params.email], (err, rows) => {
        res.json(rows || []);
    });
});

// ROTA: Confirmar Pagamento
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

// ROTA: Cancelar Transação
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    db.serialize(() => {
        db.run("UPDATE wallets SET saldo = saldo + 8.50 WHERE user_id = (SELECT id FROM users WHERE email = ?)", [user_email]);
        db.run("UPDATE transactions SET detalhes = '[CANCELADO]' WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true, reembolso: 8.50 });
        });
    });
});

module.exports = router;