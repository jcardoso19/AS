function toggleProfileForm() {
    var form = document.getElementById('profile-form-card');
    if (form.style.display === 'none' || form.style.display === '') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}

function showReservations() {
    const email = localStorage.getItem('email');
    if (!email) return;
    const container = document.getElementById('reservations-container');
    const title = document.getElementById('reservations-title');
    const list = document.getElementById('reservations-list');
    title.textContent = "Transações";
    container.style.display = (container.style.display === 'block') ? 'none' : 'block';

    fetch(`http://localhost:3000/api/carregamentos/${email}`)
        .then(resp => resp.json())
        .then(carregamentos => {
            if (!Array.isArray(carregamentos) || carregamentos.length === 0) {
                list.innerHTML = "<div class='reservation-empty'>Sem carregamentos registados.</div>";
            } else {
                list.innerHTML = carregamentos.map(c =>
                    `<div class="reservation">
                        <div class="reservation-row">
                            <span class="reservation-icon">💶</span>
                            <span class="reservation-value">${parseFloat(c.valor).toFixed(2)}€</span>
                        </div>
                        <div class="reservation-row">
                            <span class="reservation-date">${new Date(c.data_hora).toLocaleDateString()}</span>
                            <span class="reservation-time">${new Date(c.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>`
                ).join('');
            }
        });
}

function setupReservationsButton() {
    const button = document.getElementById('show-reservations-button');
    if (button) button.addEventListener('click', showReservations);
}

document.addEventListener('DOMContentLoaded', setupReservationsButton);

document.addEventListener('DOMContentLoaded', async function () {
    // Definir cliente fixo
    const email = 'cliente@multipower.pt';
    // Preencher formulário com dados atuais
    try {
        const response = await fetch(`http://localhost:3000/api/user/${email}`);
        if (response.ok) {
            const user = await response.json();
            document.querySelector('.profile-name').textContent = `${user.nome} ${user.apelido}`;
            document.querySelector('.profile-email').textContent = user.email;
            document.querySelector('.profile-phone').textContent = user.telefone;
            document.querySelector('.profile-address').textContent = user.morada;
            document.querySelector('.profile-city').textContent = user.cidade;
            document.querySelector('.profile-country').textContent = user.pais;

            // Preenche formulário de edição
            const form = document.getElementById('edit-profile-form');
            if (form) {
                form.email.value = user.email;
                form.telefone.value = user.telefone;
                form.morada.value = user.morada;
                form.cidade.value = user.cidade;
                form.codigo_postal.value = user.codigo_postal;
                form.pais.value = user.pais;
            }
        }
    } catch (err) {
        document.querySelector('.profile-name').textContent = 'Erro ao carregar utilizador';
    }

    // Mostrar/ocultar formulário de edição
    window.toggleProfileForm = function () {
        const card = document.getElementById('profile-form-card');
        card.style.display = card.style.display === 'none' ? 'block' : 'none';
    };

    // Mostrar/ocultar formulário de password
    const showPassBtn = document.getElementById('show-password-form-btn');
    if (showPassBtn) {
        showPassBtn.onclick = function () {
            const pf = document.getElementById('password-form');
            pf.style.display = pf.style.display === 'none' ? 'block' : 'none';
        };
    }

    // Botão cancelar para fechar o formulário de edição
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.onclick = function () {
            document.getElementById('profile-form-card').style.display = 'none';
        };
    }

    // Submeter alterações de dados
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
        editProfileForm.onsubmit = async function (e) {
            e.preventDefault();
            const form = e.target;
            const data = {
                email: form.email.value,
                telefone: form.telefone.value,
                morada: form.morada.value,
                cidade: form.cidade.value,
                codigo_postal: form.codigo_postal.value,
                pais: form.pais.value,
                old_email: localStorage.getItem('email')
            };
            const resp = await fetch('http://localhost:3000/api/user/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                alert('Dados alterados com sucesso!');
                localStorage.setItem('email', data.email);
                location.reload();
            } else {
                alert('Erro ao alterar dados.');
            }
        };
    }

    // Submeter alteração de password
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.onsubmit = async function (e) {
            e.preventDefault();
            const nova_password = e.target.nova_password.value;
            if (!nova_password) return alert('Introduza a nova password.');
            const resp = await fetch('http://localhost:3000/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('email'), password: nova_password })
            });
            if (resp.ok) {
                alert('Password alterada com sucesso!');
                e.target.reset();
                e.target.style.display = 'none';
            } else {
                alert('Erro ao alterar password.');
            }
        };
    }

    // GARAGEM

    window.toggleGarage = function () {
        const card = document.getElementById('garage-card');
        card.style.display = card.style.display === 'none' ? 'block' : 'none';
        if (card.style.display === 'block') loadGarage();
    };

    async function loadGarage() {
        const email = localStorage.getItem('email');
        const list = document.getElementById('garage-list');
        const removeList = document.getElementById('remove-car-list');
        removeList.style.display = 'none';
        list.innerHTML = '<div style="color:#aaa;">A carregar...</div>';
        const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
        const carros = await resp.json();
        if (!Array.isArray(carros) || carros.length === 0) {
            list.innerHTML = "<div style='color:#aaa;'>Sem carros na garagem.</div>";
        } else {
            list.innerHTML = carros.map(c =>
                `<div class="carro-item">
                    <b>${c.marca} ${c.modelo} (${c.ano})</b>
                    <span>Matrícula: ${c.matricula}</span>
                    <span>Cor: ${c.cor}</span>
                </div>`
            ).join('');
        }
    }

    // Mostrar formulário para adicionar carro
    const addCarBtn = document.getElementById('add-car-btn');
    if (addCarBtn) {
        addCarBtn.onclick = function () {
            document.getElementById('add-car-form').style.display = 'block';
            document.getElementById('remove-car-list').style.display = 'none';
        };
    }

    // Submeter novo carro
    const addCarForm = document.getElementById('add-car-form');
    if (addCarForm) {
        addCarForm.onsubmit = async function (e) {
            e.preventDefault();
            const email = localStorage.getItem('email');
            const form = e.target;
            const data = {
                email,
                marca: form.marca.value.trim(),
                modelo: form.modelo.value.trim(),
                ano: form.ano.value.trim(),
                matricula: form.matricula.value.trim(),
                cor: form.cor.value.trim()
            };
            if (!data.marca || !data.modelo || !data.ano || !data.matricula || !data.cor) {
                alert('Preencha todos os campos obrigatórios!');
                return;
            }
            const resp = await fetch('http://localhost:3000/api/carros/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (resp.ok) {
                alert('Carro adicionado!');
                form.reset();
                form.style.display = 'none';
                loadGarage();
            } else {
                alert('Erro ao adicionar carro.');
            }
        };
    }

    // Mostrar lista de carros para remover
    const removeCarBtn = document.getElementById('remove-car-btn');
    if (removeCarBtn) {
        removeCarBtn.onclick = async function () {
            const email = localStorage.getItem('email');
            const removeList = document.getElementById('remove-car-list');
            const list = document.getElementById('garage-list');
            removeList.style.display = removeList.style.display === 'block' ? 'none' : 'block';
            if (removeList.style.display === 'block') {
                const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
                const carros = await resp.json();
                if (!Array.isArray(carros) || carros.length === 0) {
                    removeList.innerHTML = "<div style='color:#aaa;'>Sem carros para remover.</div>";
                } else {
                    removeList.innerHTML = carros.map(c =>
                        `<div class="carro-item" style="padding-left:60px;">
                            <button class="carro-remove-btn" data-id="${c.id}">
                                <img src="assets/images/remove.png" alt="Remover"/> Remover
                            </button>
                            <b>${c.marca} ${c.modelo} (${c.ano})</b>
                            <span>Matrícula: ${c.matricula}</span>
                            <span>Cor: ${c.cor}</span>
                        </div>`
                    ).join('');
                    // Adiciona eventos aos botões de remover
                    removeList.querySelectorAll('.carro-remove-btn').forEach(btn => {
                        btn.onclick = async function () {
                            if (confirm('Remover este carro da garagem?')) {
                                const carro_id = btn.getAttribute('data-id');
                                const resp = await fetch('http://localhost:3000/api/carros/remove', {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email, carro_id })
                                });
                                if (resp.ok) {
                                    alert('Carro removido!');
                                    loadGarage();
                                    removeList.style.display = 'none';
                                } else {
                                    alert('Erro ao remover carro.');
                                }
                            }
                        };
                    });
                }
            }
        };
    }
});