const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho correto para a base de dados
const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao ligar à BD:", err.message);
});

// --- ROTAS DE CARROS ---
router.post('/adicionar-carro', (req, res) => {
    // Receber os novos dados do formulário moderno
    const { email, marca, modelo, ano, matricula, cor, battery_size, connection_type } = req.body;
    
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        // Query atualizada com os novos campos
        const sql = `INSERT INTO cars (user_id, marca, modelo, ano, matricula, cor, battery_size, connection_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        
        // Valores padrão caso venham vazios
        const bat = battery_size || 50; 
        const conn = connection_type || 33; 

        db.run(sql, [user.id, marca, modelo, ano, matricula, cor, bat, conn], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Erro ao guardar na BD" });
            }
            res.json({ success: true, id: this.lastID });
        });
    });
});

router.get('/carros/:email', (req, res) => {
    const { email } = req.params;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.json([]);
        
        db.all("SELECT * FROM cars WHERE user_id = ?", [user.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

router.post('/remover-carro', (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM cars WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- ROTA DE PERFIL (Para o Dashboard) ---
router.get('/perfil/:email', (req, res) => {
    db.get("SELECT * FROM users WHERE email = ?", [req.params.email], (err, row) => {
        res.json(row || {});
    });
});

// --- ROTA DE SALDO ---
router.get('/wallet/:email', (req, res) => {
    db.get(`SELECT u.id, w.saldo FROM users u 
            LEFT JOIN wallets w ON u.id = w.user_id 
            WHERE u.email = ?`, [req.params.email], (err, row) => {
        res.json({ saldo: row ? row.saldo : 0 });
    });
});

// --- ROTA DE ESTADO (Para o Mapa não dar erro) ---
router.get('/estado/:email', (req, res) => {
    res.json({ ativo: false });
});

// ... (mantenha os imports e setup da BD no topo) ...

// --- ROTA DE PAGAMENTO E RESERVA ---
router.post('/confirmar-pagamento', (req, res) => {
    const { email, estacao, valor, tempo_chegada, kwh_estimado } = req.body;

    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

        // 1. Verificar Saldo
        db.get("SELECT saldo FROM wallets WHERE user_id = ?", [user.id], (err, wallet) => {
            if (!wallet || wallet.saldo < valor) {
                return res.status(400).json({ error: "Saldo insuficiente na App." });
            }

            // 2. Deduzir Saldo
            db.run("UPDATE wallets SET saldo = saldo - ? WHERE user_id = ?", [valor, user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // 3. Guardar no Histórico
                const detalhes = `${kwh_estimado} kWh • Chegada em ${tempo_chegada}`;
                const sqlTrans = `INSERT INTO transactions (user_id, tipo, estacao, valor, detalhes) VALUES (?, ?, ?, ?, ?)`;
                
                db.run(sqlTrans, [user.id, 'Reserva', estacao, valor, detalhes], function(err) {
                    if (err) console.error("Erro ao gravar histórico:", err);
                    
                    // 4. Gamificação (Dar pontos)
                    db.run("UPDATE users SET points = points + 50, co2_saved = co2_saved + 2.5 WHERE id = ?", [user.id]);

                    res.json({ success: true, novo_saldo: wallet.saldo - valor });
                });
            });
        });
    });
});

// --- ROTA PARA LER HISTÓRICO (Para a página de Conta) ---
router.get('/transacoes/:email', (req, res) => {
    const { email } = req.params;
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
        if (!user) return res.json([]);
        
        db.all("SELECT * FROM transactions WHERE user_id = ? ORDER BY data DESC", [user.id], (err, rows) => {
            res.json(rows);
        });
    });
});

// ... (Mantenha as outras rotas de carros, perfil, etc.) ...

module.exports = router;