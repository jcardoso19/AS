document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.register-button').addEventListener('click', async function(event) {
        event.preventDefault();

        const nome = document.querySelector('input[placeholder="Nome"]').value;
        const apelido = document.querySelector('input[placeholder="Apelido"]').value;
        const data_nascimento = document.querySelector('input[placeholder="Data Nascimento"]').value;
        const genero = document.querySelector('select').value;
        const cartao_cidadao = document.querySelector('input[placeholder="Numero Cartão Cidadão"]').value;
        const email = document.querySelector('input[placeholder="Email"]').value;
        const telefone = document.querySelector('input[placeholder="Telefone"]').value;
        const morada = document.querySelector('input[placeholder="Morada"]').value;
        const pais = document.querySelector('input[placeholder="País"]').value;
        const cidade = document.querySelector('input[placeholder="Cidade"]').value;
        const codigo_postal = document.querySelector('input[placeholder="Código Postal"]').value;
        const password = document.querySelector('input[placeholder="Password"]').value;

        if (!nome || !apelido || !data_nascimento || !genero || !cartao_cidadao ||
            !email || !telefone || !morada || !pais || !cidade || !codigo_postal || !password) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome, apelido, data_nascimento, genero, cartao_cidadao,
                    email, telefone, morada, pais, cidade, codigo_postal, password
                })
            });

            if (response.ok) {
                alert('Conta criada com sucesso! Faça login.');
                window.location.href = 'login.html';
            } else {
                const error = await response.json();
                alert(error.error || 'Erro ao registar');
            }
        } catch (err) {
            alert('Erro de ligação ao servidor');
        }
    });
});