// Variáveis Globais
let map = null;
let control = null;
let carros = [];
let carroSelecionado = null;
let saldo = 0;
let estacaoParaReserva = null;
let tempoViagemMinutos = 0;
let chartInstance = null;
let metodoPagamentoSelecionado = 'app';
let minhasReservas = []; 
let coordenadasReservaAtiva = null;

// --- A TUA LOCALIZAÇÃO FIXA (GPS FALSO) ---
const MY_LAT = 40.6700; 
const MY_LNG = -73.9400;

window.onload = async function() {
    console.log("A iniciar aplicação MultiPower...");
    
    // 1. Limpeza de segurança para o Leaflet
    var container = L.DomUtil.get('map');
    if(container != null){
        container._leaflet_id = null;
    }

    // 2. Inicializar Mapa (Tema Dark)
    map = L.map('map', { zoomControl: false }).setView([MY_LAT, MY_LNG], 14);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // --- CARREGAR AO MOVER ---
    map.on('moveend', function() {
        const centro = map.getCenter();
        carregarEstacoes({ lat: centro.lat, lng: centro.lng });
    });

    // --- LIMPAR ROTA AO FECHAR POPUP ---
    map.on('popupclose', function(e) {
        if (coordenadasReservaAtiva) {
            desenharRota(coordenadasReservaAtiva.lat, coordenadasReservaAtiva.lng);
        } else {
            if(control) control.setWaypoints([]);
        }
    });

    // --- PONTO DO UTILIZADOR ---
    const userIcon = L.divIcon({
        className: 'user-pin-marker', 
        html: `<div class="pulsing-dot"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10] 
    });

    L.marker([MY_LAT, MY_LNG], {icon: userIcon, zIndexOffset: 1000})
     .addTo(map)
     .bindPopup("<b>📍 Você está aqui</b>");

    // 3. Inicializar Routing (Leaflet Routing Machine)
    if (typeof L.Routing !== 'undefined') {
        control = L.Routing.control({
            waypoints: [],
            routeWhileDragging: false,
            lineOptions: { styles: [{ color: '#3498db', opacity: 0.9, weight: 6 }] },
            createMarker: function() { return null; },
            show: false, 
            addWaypoints: false
        }).addTo(map);
    }

    // 4. Carregar Dados Iniciais (Caminhos Relativos para o Render)
    localStorage.setItem('email', 'cliente@multipower.pt');
    
    await carregarCarros();
    await carregarSaldo();
    await carregarMinhasReservas();
    
    adicionarEstacoesTeste(); 
    carregarEstacoes({ lat: MY_LAT, lng: MY_LNG });
    
    // Listeners do seletor de carros
    const carSelect = document.getElementById('car-select');
    if(carSelect) {
        carSelect.addEventListener('change', (e) => {
            carroSelecionado = carros.find(c => c.id == e.target.value);
        });
    }
};

// --- FUNÇÃO DE ROTA ---
function desenharRota(destLat, destLng) {
    if (control) {
        control.setWaypoints([
            L.latLng(MY_LAT, MY_LNG),
            L.latLng(destLat, destLng)
        ]);
        
        control.on('routesfound', function(e) {
            if(e.routes && e.routes[0]) {
                tempoViagemMinutos = Math.round(e.routes[0].summary.totalTime / 60);
                const el = document.getElementById('popup-tempo');
                if(el) el.textContent = tempoViagemMinutos + " min";
                const elPay = document.getElementById('pay-time');
                if(elPay) elPay.textContent = tempoViagemMinutos + " min";
            }
        });
    }
}

async function carregarMinhasReservas() {
    try {
        const email = localStorage.getItem('email');
        // CORREÇÃO: Caminho relativo para o Render
        const res = await fetch(`/api/transacoes/${email}`);
        const transacoes = await res.json();
        minhasReservas = transacoes.filter(t => t.tipo === 'Reserva' && !t.detalhes.includes('[CANCELADO]'));
    } catch(e) { console.error("Erro reservas:", e); }
}

function adicionarEstacoesTeste() {
    const fakes = [
        { lat: 40.6720, lng: -73.9420, title: "Posto Rápido (Perto)", address: "Rua Vizinha 5", id: 999 },
        { lat: 40.6850, lng: -73.9500, title: "Supercharger Norte", address: "Av. Longa 200", id: 998 },
        { lat: 40.6600, lng: -73.9300, title: "Ponto Sul", address: "Jardim Sul", id: 997 }
    ];
    fakes.forEach(st => {
        const poi = { 
            ID: st.id, 
            AddressInfo: { Latitude: st.lat, Longitude: st.lng, Title: st.title, AddressLine1: st.address }
        };
        adicionarMarcador(poi);
    });
}

async function carregarCarros() {
    try {
        // CORREÇÃO: Caminho relativo para o Render
        const resp = await fetch(`/api/carros/${localStorage.getItem('email')}`);
        carros = await resp.json();
        const select = document.getElementById('car-select');
        if(select) {
            select.innerHTML = '';
            if(carros.length > 0) {
                carros.forEach((c, index) => {
                    const opt = document.createElement('option');
                    opt.value = c.id; opt.text = `${c.marca} ${c.modelo}`;
                    select.add(opt);
                    if(index === 0) carroSelecionado = c;
                });
            } else { select.innerHTML = '<option>Sem carros</option>'; }
        }
    } catch(e) { console.error("Erro carros:", e); }
}

async function carregarSaldo() {
    try {
        // CORREÇÃO: Caminho relativo para o Render
        const resp = await fetch(`/api/wallet/${localStorage.getItem('email')}`);
        const data = await resp.json();
        saldo = data.saldo || 0;
        document.getElementById('saldo-display').textContent = `${saldo.toFixed(2)}€`;
    } catch(e) {}
}

async function carregarEstacoes(centro) {
    try {
        const response = await fetch(`https://api.openchargemap.io/v3/poi/?output=json&countrycode=US&latitude=${centro.lat}&longitude=${centro.lng}&maxresults=50&distance=10&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`);
        const data = await response.json();
        data.forEach(poi => adicionarMarcador(poi));
    } catch (e) { console.log("Erro API:", e); }
}

function adicionarMarcador(poi) {
    if(!map) return;
    const lat = poi.AddressInfo.Latitude;
    const lon = poi.AddressInfo.Longitude;
    
    const jaReservado = minhasReservas.some(r => r.estacao === poi.AddressInfo.Title);
    
    if (jaReservado) {
        coordenadasReservaAtiva = { lat: lat, lng: lon };
        setTimeout(() => desenharRota(lat, lon), 1000); 
    }
    
    let cor = jaReservado ? '#e74c3c' : '#2ecc71'; 
    
    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${cor}; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px ${cor};"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const marker = L.marker([lat, lon], { icon: icon }).addTo(map);

    marker.on('click', () => {
        desenharRota(lat, lon);
        mostrarPopup(poi);
    });
}

function mostrarPopup(poi) {
    const lat = poi.AddressInfo.Latitude;
    const lng = poi.AddressInfo.Longitude;
    const nomeEstacao = poi.AddressInfo.Title;
    
    const reservaAtiva = minhasReservas.find(r => r.estacao === nomeEstacao);
    let html = '';

    if (reservaAtiva) {
        html = `
            <div style="font-family:'Oswald',sans-serif; text-align:center; min-width:200px;">
                <h3 style="margin:0; color:#333;">${nomeEstacao}</h3>
                <div style="background:#fff3cd; color:#856404; padding:5px; border-radius:5px; margin:10px 0; font-size:0.9em;">⚠️ Reserva Ativa</div>
                <p style="font-size:0.8em; color:#666;">Tempo: <b>${tempoViagemMinutos} min</b></p>
                <button onclick="cancelarReservaDoMapa(${reservaAtiva.id})" 
                    style="width:100%; background:#e74c3c; color:white; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer;">
                    CANCELAR
                </button>
            </div>
        `;
    } else {
        const precoKwh = 0.45;
        const bateria = carroSelecionado ? (carroSelecionado.battery_size || 50) : 50;
        const energia = (bateria * 0.60).toFixed(1);
        const custo = (energia * precoKwh).toFixed(2);
        const tempoCarga = Math.round((energia / 150) * 60);

        estacaoParaReserva = {
            stationName: nomeEstacao,
            address: poi.AddressInfo.AddressLine1,
            total: custo,
            energy: energia,
            timeCharge: tempoCarga,
            kwhPrice: precoKwh
        };

        html = `
            <div style="font-family:'Oswald',sans-serif; text-align:center; min-width:200px;">
                <h3 style="margin:0; color:#333;">${nomeEstacao}</h3>
                <p style="margin:5px 0; color:#666; font-size:0.8em;">Viagem: <b id="popup-tempo">...</b></p>
                <div style="margin:10px 0; font-size:1.4em; color:#2ecc71; font-weight:bold;">${custo}€</div>
                <button onclick="abrirPagamento()" 
                    style="width:100%; background:#2ecc71; color:white; border:none; padding:10px; border-radius:5px; font-weight:bold; cursor:pointer;">
                    RESERVAR
                </button>
            </div>
        `;
    }

    L.popup({ offset: [0, -10] }).setLatLng([lat, lng]).setContent(html).openOn(map);
}

// --- FUNÇÕES GLOBAIS ---

window.cancelarReservaDoMapa = async function(id) {
    if(!confirm("Cancelar reserva? Taxa: 1.50€")) return;

    try {
        // CORREÇÃO: Caminho relativo para o Render
        const response = await fetch('/api/cancelar-transacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, user_email: localStorage.getItem('email') })
        });
        const res = await response.json();
        if (response.ok) {
            alert(`✅ Cancelado. Reembolso: ${res.reembolso.toFixed(2)}€`);
            location.reload(); 
        } else {
            alert("Erro: " + res.error);
        }
    } catch(e) { alert("Erro de ligação."); }
}

window.abrirPagamento = function() {
    if (!estacaoParaReserva) return;
    document.getElementById('pay-station-name').textContent = estacaoParaReserva.stationName;
    document.getElementById('pay-address').textContent = estacaoParaReserva.address || 'Endereço n/d';
    document.getElementById('pay-total').textContent = estacaoParaReserva.total + '€';
    document.getElementById('pay-energy').textContent = estacaoParaReserva.energy + ' kWh';
    document.getElementById('pay-kwh-price').textContent = estacaoParaReserva.kwhPrice + '€';
    document.getElementById('pay-time').textContent = tempoViagemMinutos + ' min';
    document.getElementById('payment-overlay').classList.add('active');
    map.closePopup();
    if (typeof Chart !== 'undefined') renderChart();
}

window.fecharPagamento = function() {
    document.getElementById('payment-overlay').classList.remove('active');
    if(!coordenadasReservaAtiva) {
        control.setWaypoints([]);
    }
}

window.selectPayment = function(el, method) {
    document.querySelectorAll('.pm-option').forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    metodoPagamentoSelecionado = method;
}

window.confirmarTransacao = async function() {
    const btn = document.getElementById('confirm-pay-btn');
    btn.textContent = "A Processar...";
    btn.disabled = true;

    try {
        // CORREÇÃO: Caminho relativo para o Render
        const response = await fetch('/api/confirmar-pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: localStorage.getItem('email'),
                estacao: estacaoParaReserva.stationName,
                valor: parseFloat(estacaoParaReserva.total),
                tempo_chegada: tempoViagemMinutos + ' min',
                kwh_estimado: estacaoParaReserva.energy,
                metodo: metodoPagamentoSelecionado
            })
        });

        const res = await response.json();

        if (response.ok) {
            alert(`✅ Confirmado!`);
            location.reload(); 
        } else {
            alert("❌ Erro: " + res.error);
        }
    } catch (err) {
        alert("Erro de ligação.");
    } finally {
        btn.textContent = "RESERVAR ➔";
        btn.disabled = false;
    }
}

function renderChart() {
    const ctx = document.getElementById('energyChart');
    if(!ctx) return;
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: ['00h','06h','12h','18h','23h'],
            datasets: [{
                label: 'Preço', data: [0.15, 0.20, 0.45, 0.55, 0.30],
                borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)',
                fill: true, tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales:{y:{display:false}, x:{ticks:{color:'#666'}, grid:{display:false}}} }
    });
}