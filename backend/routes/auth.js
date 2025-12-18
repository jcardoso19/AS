const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho da Base de Dados
const dbPath = path.join(process.cwd(), 'db', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Erro ao abrir BD:", err.message);
    else console.log("✅ Base de dados ligada.");
});

// --- FUNÇÃO DE SEGURANÇA: GARANTIR QUE O USER EXISTE ---
// Se o user não existir (ex: após reset do Render), cria-o automaticamente.
function ensureUserExists(email, callback) {
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return callback(null);
        
        if (row) {
            callback(row.id); // Utilizador existe, devolve ID
        } else {
            // Utilizador não existe, vamos criar agora!
            console.log(`⚠️ User ${email} não encontrado. A criar automaticamente...`);
            const sql = "INSERT INTO users (nome, apelido, email, password, telefone, morada) VALUES (?, ?, ?, ?, ?, ?)";
            db.run(sql, ["Cliente", "MultiPower", email, "12345", "910000000", "Lisboa"], function(err) {
                if (err) return callback(null);
                
                // Cria também a carteira com 50€ de oferta
                const novoUserId = this.lastID;
                db.run("INSERT INTO wallets (user_id, saldo) VALUES (?, 50.00)", [novoUserId], () => {
                    callback(novoUserId);
                });
            });
        }
    });
}

// ROTA: Perfil (Auto-Recuperação)
router.get('/perfil/:email', (req, res) => {
    const email = req.params.email;
    
    ensureUserExists(email, (id) => {
        if (!id) return res.status(500).json({ error: "Erro ao criar/buscar user" });
        
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            res.json(row);
        });
    });
});

// ROTA: Saldo
router.get('/wallet/:email', (req, res) => {
    ensureUserExists(req.params.email, (id) => {
        db.get("SELECT saldo FROM wallets WHERE user_id = ?", [id], (err, row) => {
            res.json(row || { saldo: 0 });
        });
    });
});

// ROTA: Adicionar Carro (AGORA GUARDA SEMPRE)
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    
    ensureUserExists(email, (userId) => {
        if (!userId) return res.status(500).json({ error: "Erro crítico no servidor" });

        const sql = "INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?)";
        db.run(sql, [userId, marca, modelo, matricula, battery_size || 50, connection_type || 33], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            console.log(`✅ Carro adicionado para user ID ${userId}`);
            res.json({ success: true, id: this.lastID });
        });
    });
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    ensureUserExists(req.params.email, (userId) => {
        db.all("SELECT * FROM cars WHERE user_id = ?", [userId], (err, rows) => {
            res.json(rows || []);
        });
    });
});

// ROTA: Remover Carro
router.post('/remover-carro', (req, res) => {
    db.run("DELETE FROM cars WHERE id = ?", [req.body.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ROTA: Transações (Histórico)
router.get('/transacoes/:email', (req, res) => {
    ensureUserExists(req.params.email, (userId) => {
        db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC", [userId], (err, rows) => {
            res.json(rows || []);
        });
    });
});

// ROTA: Confirmar Pagamento (Reserva Mapa)
router.post('/confirmar-pagamento', (req, res) => {
    const { email, valor, estacao } = req.body;
    
    ensureUserExists(email, (userId) => {
        db.serialize(() => {
            db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, userId]);
            db.run("INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes, data) VALUES (?, 'Reserva', ?, ?, 'Pagamento App', datetime('now'))", 
            [userId, estacao, valor], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ success: true });
            });
        });
    });
});

// ROTA: Cancelar Transação
router.post('/cancelar-transacao', (req, res) => {
    const { id, user_email } = req.body;
    
    ensureUserExists(user_email, (userId) => {
        db.run("UPDATE wallets SET saldo = saldo + 8.50 WHERE user_id = ?", [userId]);
        db.run("UPDATE transactions SET detalhes = '[CANCELADO]' WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true, reembolso: 8.50 });
        });
    });
});

module.exports = router;