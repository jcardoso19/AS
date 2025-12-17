const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Caminho absoluto para a pasta backend/db
const dbFolder = path.resolve(__dirname, 'db');
if (!fs.existsSync(dbFolder)){
    fs.mkdirSync(dbFolder, { recursive: true });
}

const dbPath = path.resolve(dbFolder, 'users.db');
const db = new sqlite3.Database(dbPath);

// ... (resto do código de criação de tabelas igual ao que já tens)
db.serialize(() => {
  // Tabelas
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, apelido TEXT, email TEXT UNIQUE, telefone TEXT,
    morada TEXT, password TEXT, 
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
    marca TEXT, modelo TEXT, ano TEXT, matricula TEXT, cor TEXT,
    battery_size REAL DEFAULT 50.0, 
    connection_type INTEGER DEFAULT 33, 
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, tipo TEXT, estacao TEXT, valor REAL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP, detalhes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Inserir Utilizador de Teste
  db.run(`INSERT OR IGNORE INTO users (nome, apelido, email, password, co2_saved, points) 
          VALUES ('Cliente', 'Demo', 'cliente@multipower.pt', '1234', 0.0, 0)`);
  
  db.get("SELECT id FROM users WHERE email = 'cliente@multipower.pt'", (err, user) => {
    if(user) {
      db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 10.00)`, [user.id]);
    }
  });

  console.log("✅ Base de dados preparada!");
});