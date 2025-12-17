document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.login-button').addEventListener('click', async function(event) {
        event.preventDefault();

        const email = document.querySelector('.login-input[type="text"]').value;
        const password = document.querySelector('.login-input[type="password"]').value;

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                const user = await response.json();
                localStorage.setItem('email', user.email);
                localStorage.setItem('hasAccount', 'true');
                localStorage.setItem('is_admin', user.is_admin ? '1' : '0');
                window.location.href = 'index.html';
            } else {
                const error = await response.json();
                showAlert(error.error || 'Erro ao autenticar');
            }
        } catch (err) {
            showAlert('Erro de ligação ao servidor');
        }
    });

    function showAlert(message) {
        if (message) {
            alert(message);
        }
    }

    localStorage.clear();
});