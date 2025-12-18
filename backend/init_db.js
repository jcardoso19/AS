const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// No Render, usamos /tmp ou a raiz se tiver permissão, mas a melhor aposta é garantir a pasta db
const dbFolder = path.join(process.cwd(), 'db');
if (!fs.existsSync(dbFolder)){
    try {
        fs.mkdirSync(dbFolder, { recursive: true });
    } catch (e) {
        console.error("Erro ao criar pasta db:", e);
    }
}

const dbPath = path.join(dbFolder, 'users.db');
const db = new sqlite3.Database(dbPath);

console.log("A inicializar Base de Dados em:", dbPath);

db.serialize(() => {
  // 1. Criar Tabelas
  db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      nome TEXT, apelido TEXT, email TEXT UNIQUE, 
      telefone TEXT, morada TEXT, password TEXT, 
      co2_saved REAL DEFAULT 0, points INTEGER DEFAULT 0
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS wallets (
      user_id INTEGER PRIMARY KEY, 
      saldo REAL DEFAULT 0.00, 
      FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      user_id INTEGER, 
      marca TEXT, modelo TEXT, matricula TEXT, 
      battery_size REAL DEFAULT 50.0, connection_type INTEGER DEFAULT 33, 
      FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      user_id INTEGER, 
      tipo TEXT, estacao TEXT, valor REAL, 
      data DATETIME DEFAULT CURRENT_TIMESTAMP, 
      detalhes TEXT, 
      FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 2. Criar Utilizador Padrão (ESSENCIAL PARA FUNCIONAR SEM LOGIN)
  const email = 'cliente@multipower.pt';
  db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
      if (!row) {
          console.log("⚠️ Utilizador padrão não encontrado. A criar...");
          db.run(`INSERT INTO users (nome, apelido, email, password, co2_saved, points) 
                  VALUES ('Cliente', 'Demo', ?, '1234', 12.5, 150)`, [email], function(err) {
              if (!err) {
                  const userId = this.lastID;
                  db.run(`INSERT INTO wallets (user_id, saldo) VALUES (?, 50.00)`, [userId]);
                  console.log("✅ Utilizador criado com ID:", userId);
              }
          });
      } else {
          console.log("✅ Utilizador padrão já existe. ID:", row.id);
      }
  });
});