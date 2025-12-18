const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Aponta para a mesma pasta 'db' na raiz
const dbPath = path.join(process.cwd(), 'db', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Erro ao abrir BD:", err.message);
});

// --- FUNÇÃO AUXILIAR PARA OBTER ID DO UTILIZADOR ---
// Isto resolve o problema de gravar dados "no vazio"
function getUserID(email, callback) {
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
            console.error("Erro SQL:", err);
            return callback(null);
        }
        if (!row) {
            console.warn("Utilizador não encontrado para o email:", email);
            return callback(null);
        }
        callback(row.id);
    });
}

// ROTA: Registar (Para garantir que o utilizador existe se for preciso recriar)
router.post('/register', (req, res) => {
    const { nome, apelido, email, password, telefone, morada } = req.body;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
        if (row) return res.status(400).json({ error: "Email já existe" });
        
        const sql = "INSERT INTO users (nome, apelido, email, password, telefone, morada) VALUES (?, ?, ?, ?, ?, ?)";
        db.run(sql, [nome, apelido, email, password, telefone, morada], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run("INSERT INTO wallets (user_id, saldo) VALUES (?, 0.00)", [this.lastID]);
            res.json({ success: true, id: this.lastID });
        });
    });
});

// ROTA: Perfil
router.get('/perfil/:email', (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, row) => {
        if (!row) return res.json({ nome: "Cliente", apelido: "Demo", email: req.params.email }); // Fallback visual
        res.json(row);
    });
});

// ROTA: Saldo
router.get('/wallet/:email', (req, res) => {
    db.get("SELECT saldo FROM wallets JOIN users ON users.id = wallets.user_id WHERE users.email = ?", [req.params.email], (err, row) => {
        res.json(row || { saldo: 0 });
    });
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    // Garante que só devolve carros associados ao email correto
    db.all("SELECT cars.* FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", [req.params.email], (err, rows) => {
        res.json(rows || []);
    });
});

// ROTA: Adicionar Carro (CORRIGIDA)
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    
    // 1. Primeiro encontramos o dono
    getUserID(email, (userId) => {
        if (!userId) return res.status(404).json({ error: "Utilizador não encontrado na BD" });

        // 2. Depois inserimos o carro com o ID certo
        const sql = "INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?)";
        db.run(sql, [userId, marca, modelo, matricula, battery_size || 50, connection_type || 33], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
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
    db.all(`
        SELECT transactions.*, transactions.rowid 
        FROM transactions 
        JOIN users ON users.id = transactions.user_id 
        WHERE users.email = ? 
        ORDER BY transactions.id DESC`, 
    [req.params.email], (err, rows) => {
        res.json(rows || []);
    });
});

// ROTA: Confirmar Pagamento (Reserva no Mapa)
router.post('/confirmar-pagamento', (req, res) => {
    const { email, valor, estacao } = req.body;
    
    getUserID(email, (userId) => {
        if (!userId) return res.status(404).json({ error: "Utilizador desconhecido" });

        db.serialize(() => {
            // Atualiza Saldo
            db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, userId]);
            
            // Cria Transação
            db.run("INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, 'Reserva', ?, ?, 'Pagamento App')", 
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
    
    getUserID(user_email, (userId) => {
        if (!userId) return res.status(404).json({ error: "Erro User" });

        db.serialize(() => {
            db.run("UPDATE wallets SET saldo = saldo + 8.50 WHERE user_id = ?", [userId]);
            db.run("UPDATE transactions SET detalhes = '[CANCELADO]' WHERE id = ?", [id], (err) => {
                if (err) return res.status(500).json(err);
                res.json({ success: true, reembolso: 8.50 });
            });
        });
    });
});

module.exports = router;