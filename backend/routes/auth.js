const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ALTERAÇÃO: Apontar para o mesmo ficheiro temporário que o server.js
const dbPath = path.join('/tmp', 'users.db');
const db = new sqlite3.Database(dbPath);

// --- FUNÇÃO DE SEGURANÇA ---
// O resto do código continua exatamente igual...
// --- FUNÇÃO DE SEGURANÇA ---
// Impede o erro "sucesso mas não grava"
function ensureUser(email, callback) {
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        // Se o utilizador existe, devolve o ID
        if (row) return callback(row.id);
        
        // Se NÃO existe (o Render apagou), CRIA DE NOVO na hora
        console.log("⚠️ A recuperar utilizador perdido...");
        db.run("INSERT INTO users (nome, apelido, email, password) VALUES ('Cliente', 'Auto', ?, '1234')", [email], function(err) {
            if (err) return callback(null);
            const newId = this.lastID;
            // Cria a carteira para não dar erro no saldo
            db.run("INSERT INTO wallets (user_id, saldo) VALUES (?, 20.00)", [newId], () => callback(newId));
        });
    });
}

// ROTA: Carregar Saldo
router.post('/adicionar-saldo', (req, res) => {
    const { email, valor } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro crítico DB" });
        db.run("UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?", [valor, userId], () => {
            db.run("INSERT INTO transactions (user_id, tipo, valor, detalhes) VALUES (?, 'Carregamento', ?, 'Multibanco')", [userId, valor, valor]);
            res.json({ success: true });
        });
    });
});

// ROTA: Adicionar Carro
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro crítico DB" });
        db.run("INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?)", 
        [userId, marca, modelo, matricula, battery_size || 50, connection_type || 33], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
    });
});

// ROTA: Confirmar Reserva
router.post('/confirmar-pagamento', (req, res) => {
    const { email, valor, estacao, tempo_chegada, kwh_estimado } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro crítico DB" });
        
        db.get("SELECT saldo FROM wallets WHERE user_id = ?", [userId], (err, row) => {
            if (!row || row.saldo < valor) return res.status(400).json({ error: "Saldo Insuficiente" });
            
            db.serialize(() => {
                db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, userId]);
                const detalhes = `Viagem: ${tempo_chegada || '15 min'} • ${kwh_estimado || '20'} kWh`;
                db.run("INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, 'Reserva', ?, ?, ?)", 
                [userId, estacao, valor, detalhes], () => res.json({ success: true }));
            });
        });
    });
});

// Rotas de Leitura (Perfil, Carteira, Carros, Transações)
router.get('/perfil/:email', (req, res) => ensureUser(req.params.email, (id) => db.get("SELECT * FROM users WHERE id = ?", [id], (e,r) => res.json(r||{}))));
router.get('/wallet/:email', (req, res) => ensureUser(req.params.email, (id) => db.get("SELECT saldo FROM wallets WHERE user_id = ?", [id], (e,r) => res.json(r||{saldo:0}))));
router.get('/carros/:email', (req, res) => ensureUser(req.params.email, (id) => db.all("SELECT * FROM cars WHERE user_id = ?", [id], (e,r) => res.json(r||[]))));
router.get('/transacoes/:email', (req, res) => ensureUser(req.params.email, (id) => db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", [id], (e,r) => res.json(r||[]))));

// Rotas de Remoção/Cancelamento
router.post('/remover-carro', (req, res) => db.run("DELETE FROM cars WHERE id = ?", [req.body.id], () => res.json({success:true})));
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    ensureUser(user_email, (userId) => {
        db.run("UPDATE wallets SET saldo = saldo + 8.50 WHERE user_id = ?", [userId]);
        db.run("UPDATE transactions SET detalhes = '[CANCELADO]' WHERE id = ?", [id], () => res.json({success:true, reembolso:8.50}));
    });
});

module.exports = router;