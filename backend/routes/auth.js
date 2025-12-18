const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'db', 'users.db');
const db = new sqlite3.Database(dbPath);

// --- FUNÇÃO "SALVA-VIDAS": Garante que o user existe antes de gravar ---
function ensureUser(email, callback) {
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (row) return callback(row.id);

        // Se não existe, cria AGORA
        db.run("INSERT INTO users (nome, apelido, email, password) VALUES ('Cliente', 'Auto', ?, '1234')", [email], function(err) {
            if (err) { console.error(err); return callback(null); }
            const newId = this.lastID;
            db.run("INSERT INTO wallets (user_id, saldo) VALUES (?, 20.00)", [newId]);
            callback(newId);
        });
    });
}

// 1. CARREGAR SALDO
router.post('/adicionar-saldo', (req, res) => {
    const { email, valor } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro de user" });
        
        db.run("UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?", [valor, userId], (err) => {
            if (err) return res.status(500).json(err);
            
            // Regista movimento no histórico
            db.run("INSERT INTO transactions (user_id, tipo, valor, detalhes) VALUES (?, 'Carregamento', ?, 'Carregamento Multibanco')", 
            [userId, valor]);
            
            res.json({ success: true });
        });
    });
});

// 2. ADICIONAR CARRO
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro User" });

        db.run("INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?)", 
        [userId, marca, modelo, matricula, battery_size || 50, connection_type || 33], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
    });
});

// 3. CONFIRMAR RESERVA (ROTA E PAGAMENTO)
router.post('/confirmar-pagamento', (req, res) => {
    const { email, valor, estacao, tempo_chegada, kwh_estimado } = req.body;
    ensureUser(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro User" });

        // Verifica saldo primeiro
        db.get("SELECT saldo FROM wallets WHERE user_id = ?", [userId], (err, row) => {
            if (!row || row.saldo < valor) return res.status(400).json({ error: "Saldo Insuficiente" });

            db.serialize(() => {
                db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, userId]);
                
                // Grava a ROTA e DETALHES na transação
                const detalhes = `Viagem: ${tempo_chegada} • Carga: ${kwh_estimado} kWh`;
                
                db.run("INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, 'Reserva', ?, ?, ?)", 
                [userId, estacao, valor, detalhes], (err) => {
                    if (err) return res.status(500).json(err);
                    res.json({ success: true });
                });
            });
        });
    });
});

// --- RESTO DAS ROTAS DE LEITURA (NECESSÁRIAS) ---
router.get('/perfil/:email', (req, res) => {
    ensureUser(req.params.email, (id) => {
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => res.json(row || {}));
    });
});
router.get('/wallet/:email', (req, res) => {
    ensureUser(req.params.email, (id) => {
        db.get("SELECT saldo FROM wallets WHERE user_id = ?", [id], (err, row) => res.json(row || {saldo:0}));
    });
});
router.get('/carros/:email', (req, res) => {
    ensureUser(req.params.email, (id) => {
        db.all("SELECT * FROM cars WHERE user_id = ?", [id], (err, rows) => res.json(rows || []));
    });
});
router.get('/transacoes/:email', (req, res) => {
    ensureUser(req.params.email, (id) => {
        db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", [id], (err, rows) => res.json(rows || []));
    });
});
router.post('/remover-carro', (req, res) => {
    db.run("DELETE FROM cars WHERE id = ?", [req.body.id], (err) => res.json({success:true}));
});
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    ensureUser(user_email, (userId) => {
        db.run("UPDATE wallets SET saldo = saldo + 8.50 WHERE user_id = ?", [userId]);
        db.run("UPDATE transactions SET detalhes = '[CANCELADO]' WHERE id = ?", [id], () => res.json({success:true, reembolso:8.50}));
    });
});

module.exports = router;