const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Garante que a pasta 'db' existe (Crítico para o Render)
const dbFolder = path.resolve(__dirname, 'db');
if (!fs.existsSync(dbFolder)){
    fs.mkdirSync(dbFolder);
}

const dbPath = path.resolve(dbFolder, 'users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Limpeza (Descomenta estas linhas se quiseres apagar tudo sempre que correres o script)
  // db.run("DROP TABLE IF EXISTS transactions");
  // db.run("DROP TABLE IF EXISTS cars");
  // db.run("DROP TABLE IF EXISTS wallets");
  // db.run("DROP TABLE IF EXISTS users");

  // 1. Utilizadores
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT, apelido TEXT, email TEXT UNIQUE, telefone TEXT,
    morada TEXT, password TEXT, 
    co2_saved REAL DEFAULT 0, points INTEGER DEFAULT 0
  )`);

  // 2. Carteira
  db.run(`CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER PRIMARY KEY,
    saldo REAL DEFAULT 0.00,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 3. Carros
  db.run(`CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    marca TEXT, modelo TEXT, ano TEXT, matricula TEXT, cor TEXT,
    battery_size REAL DEFAULT 50.0, 
    connection_type INTEGER DEFAULT 33, 
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 4. Histórico
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tipo TEXT, 
    estacao TEXT,
    valor REAL,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    detalhes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // DADOS INICIAIS PARA A APRESENTAÇÃO
  // Criamos o user com 0 CO2 e 0 Pontos para a demo parecer real
  db.run(`INSERT OR IGNORE INTO users (nome, apelido, email, password, co2_saved, points) 
          VALUES ('Cliente', 'Demo', 'cliente@multipower.pt', '1234', 0.0, 0)`);
  
  db.get("SELECT id FROM users WHERE email = 'cliente@multipower.pt'", (err, user) => {
    if(user) {
      // Começamos com 10.00€ para poderes testar uma reserva imediata
      db.run(`INSERT OR IGNORE INTO wallets (user_id, saldo) VALUES (?, 10.00)`, [user.id]);
      
      // NOTA: Comentei a inserção do carro para que a garagem apareça vazia na demo
      /*
      db.run(`INSERT INTO cars (user_id, marca, modelo, ano, matricula, cor, battery_size, connection_type) 
              SELECT ?, 'Tesla', 'Model 3', '2023', 'AA-00-EV', 'Branco', 75.0, 33
              WHERE NOT EXISTS (SELECT 1 FROM cars WHERE user_id = ?)`, [user.id, user.id]);
      */
    }
  });

  console.log("✅ Base de dados preparada para o deploy!");
});