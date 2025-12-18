document.addEventListener('DOMContentLoaded', function () {
    const email = 'cliente@multipower.pt';
    localStorage.setItem('email', email);

    carregarPerfil(email);
    carregarGaragem(email);
    setupAddCarForm(email);
});

async function carregarPerfil(email) {
    try {
        const res = await fetch(`/api/perfil/${email}`);
        const user = await res.json();
        if (user.nome) {
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido || ''}`;
            document.querySelector('.profile-email').textContent = user.email;
            document.getElementById('co2-val').textContent = user.co2_saved ? user.co2_saved.toFixed(1) : 0;
            document.getElementById('points-val').textContent = user.points || 0;
        }
    } catch(e) { console.error("Erro ao carregar perfil:", e); }
}

async function carregarGaragem(email) {
    try {
        const res = await fetch(`/api/carros/${email}`);
        const carros = await res.json();
        const lista = document.getElementById('garage-list');
        lista.innerHTML = '';

        if (carros.length === 0) {
            lista.innerHTML = `<div style="background:#252525; padding:20px; border-radius:12px; text-align:center; color:#888;">Garagem vazia.</div>`;
            return;
        }

        carros.forEach(carro => {
            const div = document.createElement('div');
            div.className = 'car-card';
            div.innerHTML = `
                <div class="car-icon-box">🚗</div>
                <div class="car-info">
                    <span class="car-name">${carro.marca} ${carro.modelo}</span>
                    <div class="car-meta"><span class="car-tag">${carro.matricula}</span></div>
                </div>
                <button class="btn-delete" onclick="removerCarro(${carro.id})">✕</button>
            `;
            lista.appendChild(div);
        });
    } catch(e) { console.error("Erro ao carregar garagem:", e); }
}

function setupAddCarForm(email) {
    const form = document.getElementById('add-car-form');
    if(!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        data.email = email;

        try {
            const response = await fetch('/api/adicionar-carro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert("✅ Carro adicionado com sucesso!");
                form.reset();
                if (typeof closeAllSheets === 'function') closeAllSheets();
                carregarGaragem(email);
            } else {
                alert("❌ Erro ao adicionar o carro.");
            }
        } catch (err) {
            alert("⚠️ Erro de ligação ao servidor.");
        }
    });
}

window.removerCarro = async (id) => {
    if(confirm('Tem a certeza que deseja remover este veículo?')) {
        await fetch('/api/remover-carro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        carregarGaragem(localStorage.getItem('email'));
    }
};