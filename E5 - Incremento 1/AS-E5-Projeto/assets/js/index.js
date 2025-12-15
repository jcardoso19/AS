var map = L.map('map').setView([40.6782, -73.9442], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.Control.geocoder().addTo(map);

let carros = [];
let carroSelecionado = null;
let saldo = 0;
let estacoes = [];
let markers = [];
let estadoAtual = null;
let estacaoAssociada = null;

async function inicializar() {
  localStorage.setItem('email', 'cliente@multipower.pt');
  localStorage.setItem('is_admin', '0'); 

  await carregarCarros();
  await carregarSaldo();
  await verificarEstadoAtual();
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const centro = { lat: 40.6782, lng: -73.9442 }; 
      carregarEstacoes(centro);
    }, () => {
      const centro = { lat: 40.6782, lng: -73.9442 };
      carregarEstacoes(centro);
    });
  } else {
    const centro = { lat: 40.6782, lng: -73.9442 };
    carregarEstacoes(centro);
  }
  
  const select = document.getElementById('car-select');
  select.addEventListener('change', (e) => {
    carroSelecionado = carros.find(c => c.id == e.target.value);
  });
}

async function carregarCarros() {
  const email = localStorage.getItem('email');
  try {
    const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
    carros = await resp.json();
    atualizarSelectCarro();
  } catch (error) {
    console.error(error);
  }
}

function atualizarSelectCarro() {
  const select = document.getElementById('car-select');
  select.innerHTML = '';
  
  if (carros.length === 0) {
    const option = document.createElement('option');
    option.text = "Sem carros";
    select.add(option);
    return;
  }

  carros.forEach((carro, index) => {
    const option = document.createElement('option');
    option.value = carro.id;
    option.text = `${carro.marca} ${carro.modelo}`;
    select.add(option);
    if (index === 0) carroSelecionado = carro;
  });
}

async function carregarSaldo() {
  const email = localStorage.getItem('email');
  try {
    const resp = await fetch(`http://localhost:3000/api/wallet/${email}`);
    const data = await resp.json();
    saldo = parseFloat(data.saldo);
    document.getElementById('saldo-display').textContent = `${saldo.toFixed(2)}€`;
  } catch (error) {
    console.error(error);
  }
}

async function carregarEstacoes(centro) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  const raio = 10; 

  try {
    const response = await fetch(
      `https://api.openchargemap.io/v3/poi/?output=json&countrycode=US&latitude=${centro.lat}&longitude=${centro.lng}&maxresults=50&distance=${raio}&distanceunit=KM&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`
    );
    const data = await response.json();
    
    data.forEach(poi => {
      adicionarMarcador(poi);
    });

  } catch (error) {
    console.error(error);
  }
}

function adicionarMarcador(poi) {
  const lat = poi.AddressInfo.Latitude;
  const lon = poi.AddressInfo.Longitude;
  const titulo = poi.AddressInfo.Title;
  
  let cor = '#4bc0c0'; 
  
  if (estacaoAssociada && estacaoAssociada.estacao_id == poi.ID) {
    if (estadoAtual === 'reservado') cor = '#f39c12';
    if (estadoAtual === 'iniciado') cor = '#e74c3c';
  }

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${cor};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px black;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

  const marker = L.marker([lat, lon], { icon: icon }).addTo(map);
  
  marker.on('click', () => {
    mostrarPopup(poi);
  });
  
  markers.push(marker);
}

function mostrarPopup(poi) {
  const lat = poi.AddressInfo.Latitude;
  const lng = poi.AddressInfo.Longitude;
  
  let conteudo = `
    <div style="font-family:'Oswald',sans-serif; text-align:center; min-width:200px;">
      <h3 style="color:#232323; margin-top:0;">${poi.AddressInfo.Title}</h3>
      <p style="color:#666; font-size:0.9em;">${poi.AddressInfo.AddressLine1 || ''}</p>
  `;

  if (!carroSelecionado) {
    conteudo += `<p style="color:#e74c3c;">Selecione um carro primeiro.</p></div>`;
  } else if (estadoAtual) {
    if (estacaoAssociada && estacaoAssociada.estacao_id == poi.ID) {
        if (estadoAtual === 'reservado') {
            conteudo += `
                <p style="color:#f39c12; font-weight:bold;">Reservado</p>
                <button onclick="iniciarCarregamentoReservado()" style="width:100%; background:#4bc0c0; color:white; border:none; padding:10px; border-radius:5px; margin-bottom:5px; cursor:pointer;">Iniciar Carregamento</button>
                <button onclick="cancelarReserva()" style="width:100%; background:#e74c3c; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">Cancelar Reserva</button>
            `;
        } else if (estadoAtual === 'iniciado') {
            conteudo += `
                <p style="color:#e74c3c; font-weight:bold;">A Carregar...</p>
                <button onclick="terminarCarregamento()" style="width:100%; background:#e74c3c; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">Terminar</button>
            `;
        }
    } else {
        conteudo += `<p style="color:#666;">Já tem uma estação ativa.</p>`;
    }
  } else {
    conteudo += `
        <button onclick='reservarEstacao(${JSON.stringify(poi).replace(/'/g, "&#39;")})' style="width:100%; background:#f39c12; color:white; border:none; padding:10px; border-radius:5px; margin-bottom:5px; cursor:pointer;">Reservar (1.00€)</button>
        <button onclick='iniciarCarregamento(${JSON.stringify(poi).replace(/'/g, "&#39;")})' style="width:100%; background:#4bc0c0; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;">Carregar Agora</button>
    `;
  }

  conteudo += `</div>`;

  L.popup()
    .setLatLng([lat, lng])
    .setContent(conteudo)
    .openOn(map);
}

async function verificarEstadoAtual() {
  const email = localStorage.getItem('email');
  try {
    const resp = await fetch(`http://localhost:3000/api/estado/${email}`);
    const data = await resp.json();
    
    if (data.ativo) {
        estadoAtual = data.status;
        estacaoAssociada = data;
        
        if (estadoAtual === 'iniciado') {
            document.getElementById('saldo-display').textContent = "A carregar...";
            document.getElementById('saldo-display').style.color = "#e74c3c";
        }
    } else {
        estadoAtual = null;
        estacaoAssociada = null;
    }
  } catch (err) {
    console.error(err);
  }
}

async function reservarEstacao(poi) {
  if (saldo < 1) {
    alert("Saldo insuficiente!");
    return;
  }
  
  const email = localStorage.getItem('email');
  
  try {
    const resp = await fetch('http://localhost:3000/api/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            estacao_id: poi.ID,
            carro_id: carroSelecionado.id,
            lat: poi.AddressInfo.Latitude,
            lon: poi.AddressInfo.Longitude,
            endereco: poi.AddressInfo.AddressLine1
        })
    });

    if (resp.ok) {
        await carregarSaldo();
        await verificarEstadoAtual();
        map.closePopup();
        const centro = { lat: 40.6782, lng: -73.9442 };
        carregarEstacoes(centro);
    } else {
        alert("Erro ao reservar.");
    }
  } catch (err) {
    console.error(err);
  }
}

async function iniciarCarregamento(poi) {
    const email = localStorage.getItem('email');
    try {
        const resp = await fetch('http://localhost:3000/api/iniciar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                estacao_id: poi.ID,
                carro_id: carroSelecionado.id,
                lat: poi.AddressInfo.Latitude,
                lon: poi.AddressInfo.Longitude,
                endereco: poi.AddressInfo.AddressLine1
            })
        });

        if (resp.ok) {
            await verificarEstadoAtual();
            map.closePopup();
            const centro = { lat: 40.6782, lng: -73.9442 };
            carregarEstacoes(centro);
        } else {
            alert("Erro ao iniciar.");
        }
    } catch (err) {
        console.error(err);
    }
}

async function iniciarCarregamentoReservado() {
    const email = localStorage.getItem('email');
    try {
        const resp = await fetch('http://localhost:3000/api/iniciar-reserva', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (resp.ok) {
            await verificarEstadoAtual();
            map.closePopup();
            const centro = { lat: 40.6782, lng: -73.9442 };
            carregarEstacoes(centro);
        }
    } catch (err) {
        console.error(err);
    }
}

async function cancelarReserva() {
    const email = localStorage.getItem('email');
    try {
        const resp = await fetch('http://localhost:3000/api/cancelar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (resp.ok) {
            await verificarEstadoAtual();
            map.closePopup();
            const centro = { lat: 40.6782, lng: -73.9442 };
            carregarEstacoes(centro);
        }
    } catch (err) {
        console.error(err);
    }
}

async function terminarCarregamento() {
    const email = localStorage.getItem('email');
    const valor = (Math.random() * 15 + 5).toFixed(2); 

    try {
        const resp = await fetch('http://localhost:3000/api/terminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, valor })
        });

        if (resp.ok) {
            alert(`Carregamento terminado! Custo: ${valor}€`);
            await carregarSaldo();
            await verificarEstadoAtual();
            map.closePopup();
            const centro = { lat: 40.6782, lng: -73.9442 };
            carregarEstacoes(centro);
            document.getElementById('saldo-display').style.color = "#4bc0c0";
        }
    } catch (err) {
        console.error(err);
    }
}

window.reservarEstacao = reservarEstacao;
window.iniciarCarregamento = iniciarCarregamento;
window.iniciarCarregamentoReservado = iniciarCarregamentoReservado;
window.cancelarReserva = cancelarReserva;
window.terminarCarregamento = terminarCarregamento;

document.addEventListener('DOMContentLoaded', function () {
  inicializar();
});