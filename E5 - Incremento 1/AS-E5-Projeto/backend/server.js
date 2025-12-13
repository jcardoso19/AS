const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

app.listen(port, () => {
  console.log('Servidor a correr na porta 3000');
});