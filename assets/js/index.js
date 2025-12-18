let map = null;
let control = null;
let carros = [];
let carroSelecionado = null;
let estacaoParaReserva = null;
let tempoViagemMinutos = 0; // Guarda o tempo calculado pela rota
let minhasReservas = []; 
let coordenadasReservaAtiva = null;

const MY_LAT = 40.6700; 
const MY_LNG = -73.9400;
const EMAIL_FIXO = 'cliente@multipower.pt'; 

window.onload = async function() {
    // Forçar email fixo para garantir que tudo funciona
    localStorage.setItem('email', EMAIL_FIXO);
    console.log("Mapa iniciado. Utilizador: " + EMAIL_FIXO);

    // 1. Inicializar Mapa
    map = L.map('map', { zoomControl: false }).setView([MY_LAT, MY_LNG], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap', subdomains: 'abcd', maxZoom: 19
    }).addTo(map);

    // 2. Marcador do Utilizador (Ponto Azul a piscar)
    const userIcon = L.divIcon({
        className: 'user-pin-marker', 
        html: `<div class="pulsing-dot"></div>`,
        iconSize: [20, 20]
    });
    L.marker([MY_LAT, MY_LNG], {icon: userIcon, zIndexOffset: 1000}).addTo(map);

    // 3. Carregar Dados do Backend
    await carregarCarros();
    await carregarSaldo();
    await carregarMinhasReservas();
    
    // 4. Adicionar Estações de Teste
    adicionarEstacoesTeste();
    
    // 5. Configurar Sistema de Rotas
    if (typeof L.Routing !== 'undefined') {
        control = L.Routing.control({
            waypoints: [], 
            routeWhileDragging: false, 
            show: false, 
            addWaypoints: false,
            lineOptions: { styles: [{ color: '#3498db', opacity: 0.9, weight: 6 }] },
            createMarker: function() { return null; } // Não cria marcadores extra
        }).addTo(map);
    }
};

async function carregarMinhasReservas() {
    try {
        const res = await fetch(`/api/transacoes/${EMAIL_FIXO}`);
        const transacoes = await res.json();
        // Filtra apenas as reservas ativas (que não foram canceladas)
        minhasReservas = transacoes.filter(t => t.tipo === 'Reserva' && (!t.detalhes || !t.detalhes.includes('[CANCELADO]')));
    } catch(e) { console.error("Erro ao carregar reservas:", e); }
}

function adicionarEstacoesTeste() {
    // Cria postos fictícios para teste
    const fakes = [
        { lat: 40.6720, lng: -73.9420, title: "Posto Rápido A", address: "Rua Principal, 10" },
        { lat: 40.6850, lng: -73.9500, title: "Supercharger B", address: "Avenida Central" }
    ];
    fakes.forEach(st => adicionarMarcador(st));
}

function adicionarMarcador(st) {
    const lat = st.lat;
    const lng = st.lng;
    
    // Verifica se este posto já está reservado por nós
    const jaReservado = minhasReservas.some(r => r.estacao === st.title);
    
    if (jaReservado) {
        coordenadasReservaAtiva = { lat: lat, lng: lng };
        setTimeout(() => desenharRota(lat, lng), 1500); // Desenha a rota automaticamente
    }
    
    const cor = jaReservado ? '#e74c3c' : '#2ecc71'; // Vermelho se reservado, Verde se livre
    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${cor}; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px ${cor};"></div>`,
        iconSize: [14, 14]
    });

    // Ao clicar no posto
    L.marker([lat, lng], { icon: icon }).addTo(map).on('click', () => {
        desenharRota(lat, lng);
        mostrarPopup(st, jaReservado);
    });
}

function desenharRota(lat, lng) {
    if(control) {
        control.setWaypoints([L.latLng(MY_LAT, MY_LNG), L.latLng(lat, lng)]);
        
        // Quando a rota é calculada, guardamos o tempo
        control.on('routesfound', function(e) {
            const routes = e.routes;
            const summary = routes[0].summary;
            tempoViagemMinutos = Math.round(summary.totalTime / 60);
            
            // Atualiza o texto no popup se estiver aberto
            const el = document.getElementById('popup-tempo');
            if(el) el.textContent = tempoViagemMinutos + " min";
        });
    }
}

function mostrarPopup(st, reservado) {
    let html = '';
    
    if (reservado) {
        // Se já está reservado, mostra botão de cancelar
        const reserva = minhasReservas.find(r => r.estacao === st.title);
        html = `
            <div style="text-align:center; min-width:200px; color:#333;">
                <h3>${st.title}</h3>
                <div style="background:#fff3cd; color:#856404; padding:5px; margin:10px 0; border-radius:4px;">⚠️ Reserva Ativa</div>
                <button onclick="cancelarReservaDoMapa(${reserva ? reserva.id : 0})" style="width:100%; background:#e74c3c; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">CANCELAR RESERVA</button>
            </div>`;
    } else {
        // Se está livre, mostra botão de reservar
        // Define os dados para o pagamento
        estacaoParaReserva = { 
            stationName: st.title, 
            total: "8.50", // Preço fixo para demo
            energy: "20", 
            kwhPrice: "0.45" 
        }; 
        
        html = `
            <div style="text-align:center; min-width:200px; color:#333;">
                <h3>${st.title}</h3>
                <p>Tempo estimado: <b id="popup-tempo">Calculando...</b></p>
                <div style="font-size:1.8em; color:#2ecc71; font-weight:bold; margin:10px 0;">8.50€</div>
                <button onclick="abrirPagamento()" style="width:100%; background:#2ecc71; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">RESERVAR AGORA</button>
            </div>`;
    }
    
    L.popup().setLatLng([st.lat, st.lng]).setContent(html).openOn(map);
}

async function carregarCarros() {
    try {
        const resp = await fetch(`/api/carros/${EMAIL_FIXO}`);
        carros = await resp.json();
        const select = document.getElementById('car-select');
        
        if(select) {
            select.innerHTML = '';
            if(carros.length > 0) {
                carros.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id; 
                    opt.text = c.marca + " " + c.modelo;
                    select.add(opt);
                });
                carroSelecionado = carros[0];
            } else { 
                select.innerHTML = '<option>Sem carros na garagem</option>'; 
            }
        }
    } catch(e) { console.error(e); }
}

async function carregarSaldo() {
    try {
        const resp = await fetch(`/api/wallet/${EMAIL_FIXO}`);
        const data = await resp.json();
        const el = document.getElementById('saldo-display');
        if(el) {
            el.textContent = `${(data.saldo || 0).toFixed(2)}€`;
        }
    } catch(e) { console.error(e); }
}

// --- Funções Globais (chamadas pelo HTML) ---

window.abrirPagamento = () => {
    // Preenche os dados no overlay de pagamento
    document.getElementById('pay-station-name').textContent = estacaoParaReserva.stationName;
    
    // Atualiza com o tempo real da rota
    const tempoDisplay = tempoViagemMinutos > 0 ? tempoViagemMinutos + " min" : "15 min";
    if(document.getElementById('pay-time')) document.getElementById('pay-time').textContent = tempoDisplay;
    
    document.getElementById('payment-overlay').classList.add('active');
    map.closePopup();
};

window.fecharPagamento = () => {
    document.getElementById('payment-overlay').classList.remove('active');
};

window.confirmarTransacao = async function() {
    const btn = document.getElementById('confirm-pay-btn');
    const txtOriginal = btn.textContent;
    btn.textContent = "A Processar...";
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/confirmar-pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: EMAIL_FIXO,
                estacao: estacaoParaReserva.stationName,
                valor: parseFloat(estacaoParaReserva.total),
                tempo_chegada: tempoViagemMinutos + ' min',
                kwh_estimado: estacaoParaReserva.energy
            })
        });
        
        const res = await response.json();
        
        if (response.ok) {
            alert("✅ Pagamento efetuado com sucesso!\nA sua reserva foi confirmada.");
            location.reload(); // Recarrega para atualizar o mapa e histórico
        } else {
            alert("❌ Erro: " + (res.error || "Saldo insuficiente ou erro técnico."));
            btn.textContent = txtOriginal;
            btn.disabled = false;
        }
    } catch (err) {
        alert("Erro de comunicação com o servidor.");
        btn.textContent = txtOriginal;
        btn.disabled = false;
    }
};

window.cancelarReservaDoMapa = async function(id) {
    if(!confirm("Tem a certeza que deseja cancelar a reserva?\nO valor será reembolsado.")) return;
    
    try {
        await fetch('/api/cancelar-transacao', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, user_email: EMAIL_FIXO })
        });
        alert("Reserva cancelada.");
        location.reload();
    } catch(e) {
        alert("Erro ao cancelar.");
    }
};