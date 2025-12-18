const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho exato para a base de dados
const dbPath = path.resolve(__dirname, '../db/users.db');
const db = new sqlite3.Database(dbPath);

// ... (outras rotas: login, perfil, wallet)

// ROTA: Adicionar Carro (Versão Robusta)
router.post('/adicionar-carro', (req, res) => {
    const { email, marca, modelo, matricula, battery_size, connection_type } = req.body;
    
    db.run(
        `INSERT INTO cars (user_id, marca, modelo, matricula, battery_size, connection_type) 
         VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?)`,
        [
            email, 
            marca, 
            modelo, 
            matricula, 
            battery_size || 50.0, 
            connection_type || 33
        ],
        function(err) {
            if (err) {
                console.error("Erro ao inserir carro:", err.message);
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
        }
    );
});

// ROTA: Listar Carros
router.get('/carros/:email', (req, res) => {
    db.all("SELECT cars.* FROM cars JOIN users ON users.id = cars.user_id WHERE users.email = ?", 
    [req.params.email], (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows || []);
    });
});

// ROTA: Remover Carro
router.post('/remover-carro', (req, res) => {
    db.run("DELETE FROM cars WHERE id = ?", [req.body.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

module.exports = router;