// Configuração Mapa
var map = L.map('map').setView([40.6782, -73.9442], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

var control = L.Routing.control({
    waypoints: [],
    routeWhileDragging: false,
    lineOptions: { styles: [{ color: '#4bc0c0', opacity: 0.8, weight: 6 }] },
    createMarker: function() { return null; },
    show: false
}).addTo(map);

let carros = [];
let carroSelecionado = null;
let saldo = 0;
let dadosTransacaoTemp = {}; // Guarda dados temporários para o pagamento

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    localStorage.setItem('email', 'cliente@multipower.pt');
    await carregarCarros();
    await carregarSaldo();
    
    // Carregar Estações
    const centro = { lat: 40.6782, lng: -73.9442 }; 
    carregarEstacoes(centro);
    
    // Listener troca de carro
    document.getElementById('car-select').addEventListener('change', (e) => {
        carroSelecionado = carros.find(c => c.id == e.target.value);
        carregarEstacoes(centro); // Recarregar cores
    });
});

async function carregarCarros() {
    try {
        const email = localStorage.getItem('email');
        const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
        carros = await resp.json();
        
        const select = document.getElementById('car-select');
        select.innerHTML = '';
        
        if(carros.length > 0) {
            carros.forEach((c, index) => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.text = `${c.marca} ${c.modelo}`;
                select.add(opt);
                if(index === 0) carroSelecionado = c;
            });
        } else {
            select.innerHTML = '<option>Sem carros</option>';
        }
    } catch(e) { console.error(e); }
}

async function carregarSaldo() {
    try {
        const resp = await fetch(`http://localhost:3000/api/wallet/${localStorage.getItem('email')}`);
        const data = await resp.json();
        saldo = data.saldo;
        document.getElementById('saldo-display').textContent = `${saldo.toFixed(2)}€`;
    } catch(e) {}
}

async function carregarEstacoes(centro) {
    try {
        const response = await fetch(
            `https://api.openchargemap.io/v3/poi/?output=json&countrycode=US&latitude=${centro.lat}&longitude=${centro.lng}&maxresults=30&distance=5&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`
        );
        const data = await response.json();
        data.forEach(poi => adicionarMarcador(poi));
    } catch (error) { console.error(error); }
}

function adicionarMarcador(poi) {
    const lat = poi.AddressInfo.Latitude;
    const lon = poi.AddressInfo.Longitude;
    
    // Lógica de compatibilidade visual
    let cor = '#4bc0c0'; // Verde
    const estacaoTipo = (poi.ID % 2 === 0) ? 33 : 25; // Simulação
    
    if (carroSelecionado && carroSelecionado.connection_type !== estacaoTipo) {
        cor = '#7f8c8d'; // Cinza (Incompatível)
    }

    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${cor};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px ${cor};"></div>`,
        iconSize: [14, 14]
    });

    const marker = L.marker([lat, lon], { icon: icon }).addTo(map);

    marker.on('click', () => {
        // Calcular rota para obter tempo estimado
        if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition(pos => {
                 control.setWaypoints([
                     L.latLng(pos.coords.latitude, pos.coords.longitude),
                     L.latLng(lat, lon)
                 ]);
                 
                 // Ouvir o evento de rota encontrada para pegar o tempo real
                 control.on('routesfound', function(e) {
                    const routes = e.routes;
                    const summary = routes[0].summary;
                    // Guardar tempo em minutos globalmente ou passar para o popup
                    window.tempoEstimadoViagem = Math.round(summary.totalTime / 60);
                 });
             });
        }
        mostrarPopup(poi, estacaoTipo);
    });
}

function mostrarPopup(poi, tipoEstacao) {
    const lat = poi.AddressInfo.Latitude;
    const lng = poi.AddressInfo.Longitude;
    const precoKwh = 0.45;
    
    // Dados para cálculo
    const bateria = carroSelecionado ? (carroSelecionado.battery_size || 50) : 50;
    const energiaNecessaria = bateria * 0.60; // Simula 60% carga
    const tempoCarga = Math.round((energiaNecessaria / 150) * 60);
    const custoEstimado = (energiaNecessaria * precoKwh).toFixed(2);
    
    // Preparar Objeto de Transação para usar no Pagamento
    const dadosPagamento = {
        stationName: poi.AddressInfo.Title,
        address: poi.AddressInfo.AddressLine1,
        total: custoEstimado,
        energy: energiaNecessaria.toFixed(1),
        timeCharge: tempoCarga
    };

    // Converter objeto para string para passar no onclick (truque simples)
    const dadosJson = JSON.stringify(dadosPagamento).replace(/"/g, '&quot;');

    let html = `
        <div style="font-family:'Oswald',sans-serif; min-width:220px;">
            <h3 style="margin:0; color:#232323;">${poi.AddressInfo.Title}</h3>
            <p style="color:#666; font-size:0.9em;">${poi.AddressInfo.AddressLine1 || ''}</p>
            
            <div style="margin:10px 0; border-top:1px solid #ccc; padding-top:5px;">
                 <div style="display:flex; justify-content:space-between;">
                    <span>Carregamento (~${dadosPagamento.energy} kWh):</span>
                    <b>${tempoCarga} min</b>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:5px;">
                    <span>Custo Estimado:</span>
                    <b style="color:#4bc0c0; font-size:1.2em;">${custoEstimado}€</b>
                </div>
            </div>

            <button onclick="abrirPagamento(${dadosJson})" 
                style="width:100%; background:#4bc0c0; color:white; border:none; padding:12px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:5px;">
                RESERVAR AGORA
            </button>
        </div>
    `;

    L.popup({ offset: [0, -10] })
        .setLatLng([lat, lng])
        .setContent(html)
        .openOn(map);
}

// --- FUNÇÕES DE PAGAMENTO (NOVO) ---

window.abrirPagamento = function(dados) {
    dadosTransacaoTemp = dados; // Guardar em memória
    
    // Tentar obter tempo de viagem da rota (se calculado), senão usa padrão
    const tempoViagem = window.tempoEstimadoViagem ? window.tempoEstimadoViagem + ' min' : 'Calculando...';

    // Preencher Modal
    document.getElementById('pay-station-name').textContent = dados.stationName;
    document.getElementById('pay-total').textContent = dados.total + '€';
    document.getElementById('pay-energy').textContent = dados.energy + ' kWh';
    document.getElementById('pay-time').textContent = tempoViagem;
    
    // Mostrar Modal
    document.getElementById('payment-overlay').style.display = 'flex';
    map.closePopup(); // Fechar o popup pequeno
}

window.fecharPagamento = function() {
    document.getElementById('payment-overlay').style.display = 'none';
}

window.confirmarTransacao = async function() {
    const btn = document.getElementById('confirm-pay-btn');
    btn.textContent = "A Processar...";
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:3000/api/confirmar-pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: localStorage.getItem('email'),
                estacao: dadosTransacaoTemp.stationName,
                valor: parseFloat(dadosTransacaoTemp.total),
                tempo_chegada: window.tempoEstimadoViagem ? window.tempoEstimadoViagem + ' min' : 'n/d',
                kwh_estimado: dadosTransacaoTemp.energy
            })
        });

        const res = await response.json();

        if (response.ok) {
            alert(`✅ Reserva Confirmada!\nSaldo restante: ${res.novo_saldo.toFixed(2)}€\nGanhaste 50 Pontos!`);
            fecharPagamento();
            await carregarSaldo(); // Atualiza saldo na barra
        } else {
            alert("❌ Erro: " + res.error);
        }
    } catch (err) {
        alert("Erro de ligação ao servidor.");
    } finally {
        btn.textContent = "PAGAR E RESERVAR";
        btn.disabled = false;
    }
}