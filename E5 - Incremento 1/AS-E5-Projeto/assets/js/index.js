// Inicialização do mapa
// Coordenadas de Brooklyn, NY
var map = L.map('map').setView([40.6782, -73.9442], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.Control.geocoder().addTo(map);

// Variáveis globais
let carros = [];
let carroSelecionado = null;
let saldo = 0;
let estacoes = [];
let markers = [];
let estadoAtual = null; // null, 'reservado', 'carregando'
let estacaoAssociada = null;
let isAdmin = false;

// === FUNÇÕES DE INICIALIZAÇÃO ===

async function inicializar() {
  // Hardcoded para ser sempre o Cliente
  localStorage.setItem('email', 'cliente@multipower.pt');
  localStorage.setItem('is_admin', '0'); 
  isAdmin = false; // Garante que não vê botões de admin

  await carregarCarros();
  await carregarSaldo();
  await verificarEstadoAtual();
  configurarEventos();
}

async function carregarCarros() {
  const email = localStorage.getItem('email');
  if (!email) return;

  try {
    const resp = await fetch(`http://localhost:3000/api/carros/${email}`);
    carros = await resp.json();
    atualizarSelectCarro();
  } catch (error) {
    console.error('Erro ao carregar carros:', error);
    carros = [];
    atualizarSelectCarro();
  }
}

function atualizarSelectCarro() {
  const select = document.getElementById('car-select');
  select.innerHTML = '';

  if (carros.length === 0) {
    select.innerHTML = '<option value="">Sem carros registados</option>';
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = '<option value="">Selecionar carro...</option>' +
      carros.map(c => `<option value="${c.id}">${c.marca} ${c.modelo} (${c.ano})</option>`).join('');
  }
}

async function carregarSaldo() {
  const email = localStorage.getItem('email');
  if (!email) return;

  try {
    const resp = await fetch(`http://localhost:3000/api/wallet/${email}`);
    if (resp.ok) {
      const data = await resp.json();
      saldo = parseFloat(data.saldo);
    } else {
      saldo = 0;
    }
  } catch (error) {
    console.error('Erro ao carregar saldo:', error);
    saldo = 0;
  }

  atualizarDisplaySaldo();
}

function atualizarDisplaySaldo() {
  const saldoSpan = document.getElementById('saldo-span');
  if (saldoSpan) {
    saldoSpan.textContent = saldo.toFixed(2) + '€';
  }
}

async function verificarEstadoAtual() {
  if (!carroSelecionado) return;

  try {
    const resp = await fetch(`http://localhost:3000/api/carro_estacao/${carroSelecionado}`);
    if (resp.ok) {
      const text = await resp.text();
      if (text) {
        const associacao = JSON.parse(text);
        if (associacao && associacao.estacao_id) {
          estacaoAssociada = associacao;
          estadoAtual = associacao.status; // 'reservado' ou 'iniciado'
          await focarEstacaoAssociada();
          return;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar estado atual:', error);
  }

  // Limpar estado se não houver associação
  estadoAtual = null;
  estacaoAssociada = null;
}

// === FUNÇÕES DE GESTÃO DE SALDO ===

async function alterarSaldo(valor, registrar = false) {
  const email = localStorage.getItem('email');
  if (!email) return false;

  try {
    const resp = await fetch('http://localhost:3000/api/wallet/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, valor, registar: registrar })
    });

    if (resp.ok) {
      await carregarSaldo();
      return true;
    }
  } catch (error) {
    console.error('Erro ao alterar saldo:', error);
  }

  return false;
}

// === FUNÇÕES DE DISPONIBILIDADE ===

// Sistema de gestão local de disponibilidade
let ocupacaoLocal = new Map(); // estacaoId -> número de lugares ocupados localmente

// Variável para controlar se o endpoint existe
let endpointDisponibilidadeExiste = null;

async function obterDisponibilidadeEstacao(estacaoId, totalPontos) {
  // Primeiro verificar se está em manutenção
  try {
    const manutencaoResp = await fetch(`http://localhost:3000/api/manutencao/${estacaoId}`);
    if (manutencaoResp.ok) {
      const manutencaoData = await manutencaoResp.json();
      if (manutencaoData.em_manutencao) {
        return -1; // Indica que está em manutenção
      }
    }
  } catch (error) {
    console.warn(`Erro ao verificar manutenção da estação ${estacaoId}`);
  }

  // Sempre calcula apenas com ocupação local
  const ocupacaoLocalAdicional = ocupacaoLocal.get(estacaoId) || 0;
  const disponivel = Math.max(0, totalPontos - ocupacaoLocalAdicional);
  return disponivel;
}

function adicionarOcupacaoLocal(estacaoId) {
  const ocupacaoAtual = ocupacaoLocal.get(estacaoId) || 0;
  ocupacaoLocal.set(estacaoId, ocupacaoAtual + 1);
}

function removerOcupacaoLocal(estacaoId) {
  const ocupacaoAtual = ocupacaoLocal.get(estacaoId) || 0;
  if (ocupacaoAtual > 0) {
    ocupacaoLocal.set(estacaoId, ocupacaoAtual - 1);
  }
}

async function verificarDisponibilidadeAntes(estacaoId, totalPontos) {
  const disponivel = await obterDisponibilidadeEstacao(estacaoId, totalPontos);
  return disponivel > 0;
}

async function atualizarDisponibilidadeEstacao(estacaoId) {
  // Recarregar apenas a estação específica para atualizar a cor do marcador
  const estacao = estacoes.find(e => e.ID == estacaoId);
  if (!estacao) return;

  const addr = estacao.AddressInfo;
  const titulo = addr.Title;
  const endereco = addr.AddressLine1 || '';
  const total = estacao.NumberOfPoints || 1;
  const disponivel = await obterDisponibilidadeEstacao(estacaoId, total);

  // Encontrar e atualizar o marcador existente
  const marcadorIndex = markers.findIndex(marker => {
    const popup = marker.getPopup();
    return popup && popup.getContent().includes(titulo);
  });

  if (marcadorIndex !== -1) {
    // Remover marcador antigo
    map.removeLayer(markers[marcadorIndex]);
    markers.splice(marcadorIndex, 1);

    // Criar novo marcador com cor atualizada
    const cor = obterCorMarcador(disponivel, total);
    const popup = criarPopupEstacao(estacaoId, titulo, endereco, disponivel, total);
    criarMarcador(addr.Latitude, addr.Longitude, cor, popup);
  }
}

// === FUNÇÕES DO MAPA ===

function limparMarcadores() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
}

function calcularRaioPorZoom(zoom) {
  if (zoom >= 15) return 3;
  if (zoom >= 12) return 10;
  if (zoom >= 8) return 30;
  return 50;
}

function obterCorMarcador(disponivel, total) {
  if (disponivel === -1) return 'purple'; // Manutenção
  if (disponivel === 0) return 'red';
  if (disponivel / total < 0.3) return 'orange';
  return 'green';
}

function criarMarcador(lat, lon, cor, popup, especial = false) {
  let htmlIcon;

  if (especial) {
    // Marcador especial com estrela para reservas/carregamentos
    htmlIcon = `
      <div style="position: relative; width: 28px; height: 28px;">
        <i style="
          background-color: ${cor};
          border-radius: 50%;
          display: block;
          width: 24px;
          height: 24px;
          border: 3px solid white;
          box-shadow: 0 0 10px ${cor};
          position: absolute;
          top: 2px;
          left: 2px;
          z-index: 1;
        "></i>
        <div style="
          position: absolute;
          top: -6px;
          left: 6px;
          width: 16px;
          height: 16px;
          background: gold;
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          box-shadow: 0 0 5px gold;
          z-index: 2;
        "></div>
      </div>
    `;
  } else {
    htmlIcon = `
      <i style="
        background-color: ${cor};
        border-radius: 50%;
        display: block;
        width: 20px;
        height: 20px;
        border: 2px solid white;
        box-shadow: 0 0 5px ${cor};
      "></i>
    `;
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: htmlIcon,
    iconSize: especial ? [28, 28] : [24, 24],
    iconAnchor: especial ? [14, 14] : [12, 12]
  });

  const marker = L.marker([lat, lon], { icon }).bindPopup(popup);
  marker.addTo(map);
  markers.push(marker);

  return marker;
}

async function carregarEstacoes() {
  if (estadoAtual && estacaoAssociada) {
    // Se há uma estação associada, mostrar apenas ela
    await mostrarEstacaoAssociada();
    return;
  }

  limparMarcadores();

  const centro = map.getCenter();
  const zoom = map.getZoom();
  const raio = calcularRaioPorZoom(zoom);

  try {
    // Carregar estações da API
const response = await fetch(
      `https://api.openchargemap.io/v3/poi/?output=json&countrycode=US&latitude=${centro.lat}&longitude=${centro.lng}&maxresults=50&distance=${raio}&distanceunit=KM&compact=true&verbose=false&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`
    );
    const data = await response.json();
    estacoes = data;

    // Processar estações da API
    for (const estacao of data) {
      const addr = estacao.AddressInfo;
      const id = estacao.ID;
      const titulo = addr.Title;
      const endereco = addr.AddressLine1 || '';
      const total = estacao.NumberOfPoints || 1;

      // Obter disponibilidade real da base de dados
      const disponivel = await obterDisponibilidadeEstacao(id, total);

      const cor = obterCorMarcador(disponivel, total);
      const popup = criarPopupEstacao(id, titulo, endereco, disponivel, total);

      criarMarcador(addr.Latitude, addr.Longitude, cor, popup);
    }

    // Carregar estações locais
    await carregarEstacoesLocais(centro, raio);

  } catch (error) {
    console.error('Erro ao carregar estações:', error);
    // Tentar carregar apenas estações locais se a API falhar
    await carregarEstacoesLocais(centro, raio);
  }
}

async function carregarEstacoesLocais(centro, raio) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/estacoes_locais/area?lat=${centro.lat}&lng=${centro.lng}&raio=${raio}`
    );

    if (response.ok) {
      const estacoesLocais = await response.json();

      for (const estacao of estacoesLocais) {
        const id = estacao.estacao_id;
        const titulo = estacao.nome_estacao;
        const endereco = estacao.nome_rua;
        const total = estacao.numero_lugares;

        // Obter disponibilidade real da base de dados
        const disponivel = await obterDisponibilidadeEstacao(id, total);

        const cor = obterCorMarcador(disponivel, total);
        const popup = criarPopupEstacao(id, titulo, endereco, disponivel, total, true);

        criarMarcador(estacao.latitude, estacao.longitude, cor, popup);
      }
    }
  } catch (error) {
    console.error('Erro ao carregar estações locais:', error);
  }
}

function criarPopupEstacao(id, titulo, endereco, disponivel, total, isLocal = false) {
  // Se está em manutenção
  if (disponivel === -1) {
    if (isAdmin) {
      const botaoRemoverEstacao = isLocal ?
        `<button 
          onclick="removerEstacaoLocal('${id}')" 
          style="
            background-color: #dc3545; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 5px; 
            cursor: pointer; 
            width: 100%; 
            margin-top: 5px;
          "
        >
          Remover Estação
        </button>` : '';

      return `
        <div>
          <strong>${titulo}</strong>${isLocal ? ' 🏠' : ''}<br>
          ${endereco}<br>
          <div style="margin-top: 10px; color: #800080; font-weight: bold;">
            🔧 EM MANUTENÇÃO
          </div>
          <div style="margin-top: 10px;">
            <button 
              onclick="removerManutencao('${id}')" 
              style="
                background-color: #28a745; 
                color: white; 
                border: none; 
                padding: 8px 12px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%;
              "
            >
              Remover Manutenção
            </button>
            ${botaoRemoverEstacao}
          </div>
        </div>
      `;
    } else {
      return `
        <div>
          <strong>${titulo}</strong>${isLocal ? ' 🏠' : ''}<br>
          ${endereco}<br>
          <div style="margin-top: 10px; color: #800080; font-weight: bold;">
            🔧 EM MANUTENÇÃO
          </div>
          <div style="margin-top: 10px; color: #666;">
            Estação indisponível
          </div>
        </div>
      `;
    }
  }

  // Se é admin, mostrar opções de manutenção e remoção
  if (isAdmin) {
    const botaoRemoverEstacao = isLocal ?
      `<button 
        onclick="removerEstacaoLocal('${id}')" 
        style="
          background-color: #dc3545; 
          color: white; 
          border: none; 
          padding: 8px 12px; 
          border-radius: 5px; 
          cursor: pointer; 
          width: 100%; 
          margin-top: 5px;
        "
      >
        Remover Estação
      </button>` : '';

    return `
      <div>
        <strong>${titulo}</strong>${isLocal ? ' 🏠' : ''}<br>
        ${endereco}<br>
        <span style="color: #666;">Disponíveis: ${disponivel} de ${total}</span>
        <div style="margin-top: 10px;">
          <button 
            onclick="colocarManutencao('${id}')" 
            style="
              background-color: #800080; 
              color: white; 
              border: none; 
              padding: 8px 12px; 
              border-radius: 5px; 
              cursor: pointer; 
              width: 100%;
            "
          >
            Colocar em Manutenção
          </button>
          ${botaoRemoverEstacao}
        </div>
      </div>
    `;
  }

  // Para utilizadores normais
  const podeInteragir = carroSelecionado && disponivel > 0;
  const temSaldo = saldo >= 1;

  let botoes = '';
  if (podeInteragir) {
    if (temSaldo) {
      botoes = `
        <div style="margin-top: 10px;">
          <button 
            onclick="reservarEstacao('${id}')" 
            style="
              background-color: #007bff; 
              color: white; 
              border: none; 
              padding: 8px 12px; 
              border-radius: 5px; 
              cursor: pointer; 
              width: 100%; 
              margin-bottom: 5px;
            "
          >
            Reservar (1€)
          </button>
          <button 
            onclick="iniciarCarregamento('${id}')" 
            style="
              background-color: #28a745; 
              color: white; 
              border: none; 
              padding: 8px 12px; 
              border-radius: 5px; 
              cursor: pointer; 
              width: 100%;
            "
          >
            Iniciar Carregamento
          </button>
        </div>
      `;
    } else {
      botoes = `
        <div style="margin-top: 10px; color: #dc3545;">
          Saldo insuficiente para reserva
        </div>
      `;
    }
  } else if (!carroSelecionado) {
    botoes = `
      <div style="margin-top: 10px; color: #666;">
        Selecione um carro primeiro
      </div>
    `;
  } else {
    botoes = `
      <div style="margin-top: 10px; color: #666;">
        Estação indisponível
      </div>
    `;
  }

  return `
    <div>
      <strong>${titulo}</strong>${isLocal ? ' 🏠' : ''}<br>
      ${endereco}<br>
      <span style="color: #666;">Disponíveis: ${disponivel} de ${total}</span>
      ${botoes}
    </div>
  `;
}

async function mostrarEstacaoAssociada() {
  limparMarcadores();

  try {
    // Primeiro tentar buscar como estação da API
const response = await fetch(
      `https://api.openchargemap.io/v3/poi/?output=json&chargepointid=${estacaoAssociada.estacao_id}&countrycode=US&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`
    );

    const data = await response.json();
    if (data && data.length > 0) {
      const estacao = data[0];
      const addr = estacao.AddressInfo;
      const titulo = addr.Title;
      const endereco = addr.AddressLine1 || '';

      let cor, popup;

      if (estadoAtual === 'reservado') {
        cor = '#ffa500'; // Laranja para reservado
        popup = criarPopupReservado(estacaoAssociada.estacao_id, titulo, endereco);
      } else if (estadoAtual === 'iniciado') {
        cor = '#007bff'; // Azul para carregamento iniciado
        popup = criarPopupCarregando(estacaoAssociada.estacao_id, titulo, endereco);
      }

      criarMarcador(addr.Latitude, addr.Longitude, cor, popup, true);
    } else {
      // Se não encontrar na API, buscar nas estações locais
      await mostrarEstacaoLocalAssociada();
    }

  } catch (error) {
    console.error('Erro ao mostrar estação associada:', error);
    // Tentar buscar nas estações locais
    await mostrarEstacaoLocalAssociada();
  }
}

async function mostrarEstacaoLocalAssociada() {
  try {
    const response = await fetch(`http://localhost:3000/api/admin/estacoes`);
    if (response.ok) {
      const estacoesLocais = await response.json();
      const estacaoLocal = estacoesLocais.find(e => e.estacao_id === estacaoAssociada.estacao_id);

      if (estacaoLocal) {
        const titulo = estacaoLocal.nome_estacao;
        const endereco = estacaoLocal.nome_rua;

        let cor, popup;

        if (estadoAtual === 'reservado') {
          cor = '#ffa500'; // Laranja para reservado
          popup = criarPopupReservado(estacaoAssociada.estacao_id, titulo, endereco);
        } else if (estadoAtual === 'iniciado') {
          cor = '#007bff'; // Azul para carregamento iniciado
          popup = criarPopupCarregando(estacaoAssociada.estacao_id, titulo, endereco);
        }

        criarMarcador(estacaoLocal.latitude, estacaoLocal.longitude, cor, popup, true);
      }
    }
  } catch (error) {
    console.error('Erro ao mostrar estação local associada:', error);
  }
}

function criarPopupReservado(id, titulo, endereco) {
  return `
    <div>
      <strong>${titulo}</strong><br>
      ${endereco}<br>
      <div style="margin-top: 10px; color: #ffa500; font-weight: bold;">
        ⭐ RESERVADO
      </div>
      <div style="margin-top: 10px;">
        <button 
          onclick="cancelarReserva('${id}')" 
          style="
            background-color: #dc3545; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 5px; 
            cursor: pointer; 
            width: 100%; 
            margin-bottom: 5px;
          "
        >
          Cancelar Reserva
        </button>
        <button 
          onclick="iniciarCarregamentoReservado('${id}')" 
          style="
            background-color: #28a745; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 5px; 
            cursor: pointer; 
            width: 100%;
          "
        >
          Iniciar Carregamento
        </button>
      </div>
    </div>
  `;
}

function criarPopupCarregando(id, titulo, endereco) {
  return `
    <div>
      <strong>${titulo}</strong><br>
      ${endereco}<br>
      <div style="margin-top: 10px; color: #007bff; font-weight: bold;">
        🔋 CARREGANDO
      </div>
      <div style="margin-top: 10px;">
        <button 
          onclick="terminarCarregamento('${id}')" 
          style="
            background-color: #dc3545; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 5px; 
            cursor: pointer; 
            width: 100%;
          "
        >
          Terminar Carregamento
        </button>
      </div>
    </div>
  `;
}

async function focarEstacaoAssociada() {
  if (!estacaoAssociada) return;

  try {
    const response = await fetch(
      `https://api.openchargemap.io/v3/poi/?output=json&chargepointid=${estacaoAssociada.estacao_id}&countrycode=PT&key=1b6229d7-8a8d-4e66-9d0f-2e101e00f789`
    );

    const data = await response.json();
    if (data && data.length > 0) {
      const estacao = data[0];
      const addr = estacao.AddressInfo;
      map.setView([addr.Latitude, addr.Longitude], 17, { animate: true });
    }
  } catch (error) {
    console.error('Erro ao focar estação associada:', error);
  }
}

// === FUNÇÕES DE AÇÃO ===

async function reservarEstacao(estacaoId) {
  if (!carroSelecionado) {
    alert('Selecione um carro primeiro.');
    return;
  }

  if (saldo < 1) {
    alert('Saldo insuficiente para reservar (necessário 1€).');
    return;
  }

  // Verificar disponibilidade em tempo real antes de reservar
  const estacao = estacoes.find(e => e.ID == estacaoId);
  const totalPontos = estacao ? (estacao.NumberOfPoints || 1) : 1;

  const temDisponibilidade = await verificarDisponibilidadeAntes(estacaoId, totalPontos);
  if (!temDisponibilidade) {
    alert('Esta estação já não tem lugares disponíveis.');
    await carregarEstacoes();
    return;
  }

  if (!confirm('Confirma a reserva desta estação por 1€?')) {
    return;
  }

  // Descontar 1€
  const sucesso = await alterarSaldo(-1, false);
  if (!sucesso) {
    alert('Erro ao processar pagamento.');
    return;
  }

  // Criar associação na base de dados
  try {
    const response = await fetch('http://localhost:3000/api/carro_estacao/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carro_id: carroSelecionado,
        estacao_id: estacaoId,
        status: 'reservado',
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString().slice(0, 5)
      })
    });

    if (response.ok) {
      // Adicionar ocupação local
      adicionarOcupacaoLocal(estacaoId);

      estadoAtual = 'reservado';
      estacaoAssociada = { estacao_id: estacaoId, status: 'reservado' };

      // Atualizar disponibilidade da estação no mapa
      await atualizarDisponibilidadeEstacao(estacaoId);

      await mostrarEstacaoAssociada();
      alert('Reserva efetuada com sucesso!');
    } else {
      // Reverter o pagamento se falhou
      await alterarSaldo(1, false);
      alert('Erro ao efetuar reserva.');
    }

  } catch (error) {
    console.error('Erro ao reservar estação:', error);
    await alterarSaldo(1, false);
    alert('Erro ao efetuar reserva.');
  }
}

async function iniciarCarregamento(estacaoId) {
  if (!carroSelecionado) {
    alert('Selecione um carro primeiro.');
    return;
  }

  // Verificar disponibilidade em tempo real antes de iniciar carregamento
  const estacao = estacoes.find(e => e.ID == estacaoId);
  const totalPontos = estacao ? (estacao.NumberOfPoints || 1) : 1;

  const temDisponibilidade = await verificarDisponibilidadeAntes(estacaoId, totalPontos);
  if (!temDisponibilidade) {
    alert('Esta estação já não tem lugares disponíveis.');
    await carregarEstacoes();
    return;
  }

  if (!confirm('Confirma o início do carregamento?')) {
    return;
  }

  // Criar associação na base de dados
  try {
    const response = await fetch('http://localhost:3000/api/carro_estacao/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carro_id: carroSelecionado,
        estacao_id: estacaoId,
        status: 'iniciado',
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString().slice(0, 5)
      })
    });

    if (response.ok) {
      // Adicionar ocupação local
      adicionarOcupacaoLocal(estacaoId);

      estadoAtual = 'iniciado';
      estacaoAssociada = { estacao_id: estacaoId, status: 'iniciado' };

      // Atualizar disponibilidade da estação no mapa
      await atualizarDisponibilidadeEstacao(estacaoId);

      await mostrarEstacaoAssociada();
      alert('Carregamento iniciado!');
    } else {
      alert('Erro ao iniciar carregamento.');
    }

  } catch (error) {
    console.error('Erro ao iniciar carregamento:', error);
    alert('Erro ao iniciar carregamento.');
  }
}

async function iniciarCarregamentoReservado(estacaoId) {
  if (!confirm('Confirma o início do carregamento na estação reservada?')) {
    return;
  }

  // Devolver o 1€ da reserva
  const sucessoDevolucao = await alterarSaldo(1, false);
  if (!sucessoDevolucao) {
    alert('Erro ao devolver o valor da reserva.');
    return;
  }

  // Atualizar status na base de dados
  try {
    const response = await fetch('http://localhost:3000/api/carro_estacao/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carro_id: carroSelecionado,
        estacao_id: estacaoId,
        status: 'iniciado',
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString().slice(0, 5)
      })
    });

    if (response.ok) {
      estadoAtual = 'iniciado';
      estacaoAssociada.status = 'iniciado';
      await mostrarEstacaoAssociada();
      alert('Carregamento iniciado! O valor da reserva foi devolvido.');
    } else {
      // Reverter devolução se falhou
      await alterarSaldo(-1, false);
      alert('Erro ao iniciar carregamento.');
    }

  } catch (error) {
    console.error('Erro ao iniciar carregamento reservado:', error);
    await alterarSaldo(-1, false);
    alert('Erro ao iniciar carregamento.');
  }
}

async function cancelarReserva(estacaoId) {
  if (!confirm('Tem certeza que deseja cancelar a reserva? O valor não será devolvido.')) {
    return;
  }

  // Remover associação da base de dados
  try {
    const response = await fetch('http://localhost:3000/api/carro_estacao/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carro_id: carroSelecionado,
        estacao_id: estacaoId
      })
    });

    if (response.ok) {
      // Remover ocupação local
      removerOcupacaoLocal(estacaoId);

      estadoAtual = null;
      estacaoAssociada = null;

      // Atualizar disponibilidade da estação no mapa
      await atualizarDisponibilidadeEstacao(estacaoId);

      await carregarEstacoes();
      alert('Reserva cancelada.');
    } else {
      alert('Erro ao cancelar reserva.');
    }

  } catch (error) {
    console.error('Erro ao cancelar reserva:', error);
    alert('Erro ao cancelar reserva.');
  }
}

async function terminarCarregamento(estacaoId) {
  if (!confirm('Confirma o término do carregamento?')) {
    return;
  }

  // Gerar valor aleatório entre 0 e 50€
  const valorCarregamento = Math.random() * 50;

  if (saldo < valorCarregamento) {
    alert(`Saldo insuficiente para pagar o carregamento (${valorCarregamento.toFixed(2)}€).`);
    return;
  }

  // Descontar valor do carregamento
  const sucesso = await alterarSaldo(-valorCarregamento, true);
  if (!sucesso) {
    alert('Erro ao processar pagamento do carregamento.');
    return;
  }

  // Remover associação da base de dados
  try {
    const response = await fetch('http://localhost:3000/api/carro_estacao/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carro_id: carroSelecionado,
        estacao_id: estacaoId
      })
    });

    if (response.ok) {
      // Remover ocupação local
      removerOcupacaoLocal(estacaoId);

      estadoAtual = null;
      estacaoAssociada = null;

      // Atualizar disponibilidade da estação no mapa
      await atualizarDisponibilidadeEstacao(estacaoId);

      await carregarEstacoes();
      alert(`Carregamento terminado! Valor cobrado: ${valorCarregamento.toFixed(2)}€`);
    } else {
      // Reverter cobrança se falhou
      await alterarSaldo(valorCarregamento, true);
      alert('Erro ao terminar carregamento.');
    }

  } catch (error) {
    console.error('Erro ao terminar carregamento:', error);
    await alterarSaldo(valorCarregamento, true);
    alert('Erro ao terminar carregamento.');
  }
}

// === FUNÇÕES DE ADMINISTRAÇÃO DE ESTAÇÕES LOCAIS ===

async function adicionarEstacaoLocal() {
  if (!isAdmin) {
    alert('Acesso negado');
    return;
  }

  const nomeEstacao = prompt('Nome da estação:');
  if (!nomeEstacao) return;

  const nomeRua = prompt('Nome da rua/endereço:');
  if (!nomeRua) return;

  const numeroLugares = parseInt(prompt('Número de lugares disponíveis:'));
  if (!numeroLugares || numeroLugares < 1) {
    alert('Número de lugares inválido');
    return;
  }

  const centro = map.getCenter();
  const latitude = parseFloat(prompt('Latitude:', centro.lat.toFixed(6)));
  const longitude = parseFloat(prompt('Longitude:', centro.lng.toFixed(6)));

  if (isNaN(latitude) || isNaN(longitude)) {
    alert('Coordenadas inválidas');
    return;
  }

  if (!confirm(`Confirma a criação da estação?\nNome: ${nomeEstacao}\nEndereço: ${nomeRua}\nLugares: ${numeroLugares}\nCoordenadas: ${latitude}, ${longitude}`)) {
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/api/admin/estacoes/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome_estacao: nomeEstacao,
        nome_rua: nomeRua,
        numero_lugares: numeroLugares,
        latitude: latitude,
        longitude: longitude,
        admin_email: localStorage.getItem('email')
      })
    });

    if (resp.ok) {
      alert('Estação adicionada com sucesso!');
      await carregarEstacoes();
    } else {
      const error = await resp.json();
      alert('Erro: ' + (error.error || 'Erro desconhecido'));
    }
  } catch (error) {
    console.error('Erro ao adicionar estação:', error);
    alert('Erro de comunicação com o servidor');
  }
}

async function removerEstacaoLocal(estacaoId) {
  if (!isAdmin) {
    alert('Acesso negado');
    return;
  }

  if (!confirm('Tem certeza que deseja remover esta estação local?')) {
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/api/admin/estacoes/remove', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estacao_id: estacaoId,
        admin_email: localStorage.getItem('email')
      })
    });

    if (resp.ok) {
      alert('Estação removida com sucesso!');
      await carregarEstacoes();
    } else {
      const error = await resp.json();
      alert('Erro: ' + (error.error || 'Erro desconhecido'));
    }
  } catch (error) {
    console.error('Erro ao remover estação:', error);
    alert('Erro de comunicação com o servidor');
  }
}

// === EVENTOS ===

function configurarEventos() {
  // Evento de seleção de carro
  document.getElementById('car-select').addEventListener('change', async function () {
    carroSelecionado = this.value;

    if (carroSelecionado) {
      await verificarEstadoAtual();
      if (estadoAtual && estacaoAssociada) {
        await mostrarEstacaoAssociada();
      } else {
        await carregarEstacoes();
      }
    } else {
      estadoAtual = null;
      estacaoAssociada = null;
      await carregarEstacoes();
    }
  });

  // Evento de movimento do mapa
  map.on('moveend', () => {
    if (!estadoAtual) {
      carregarEstacoes();
    }
  });
}


// === FUNÇÕES DE MANUTENÇÃO (ADMIN) ===

async function colocarManutencao(estacaoId) {
  if (!isAdmin) {
    alert('Acesso negado');
    return;
  }

  const descricao = prompt('Descrição da manutenção (opcional):') || 'Manutenção programada';

  if (!confirm(`Confirma colocar a estação em manutenção?\nDescrição: ${descricao}`)) {
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/api/admin/manutencao/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estacao_id: estacaoId,
        descricao: descricao,
        admin_email: localStorage.getItem('email')
      })
    });

    if (resp.ok) {
      alert('Estação colocada em manutenção com sucesso!');
      await atualizarDisponibilidadeEstacao(estacaoId);
    } else {
      const error = await resp.json();
      alert('Erro: ' + (error.error || 'Erro desconhecido'));
    }
  } catch (error) {
    console.error('Erro ao colocar em manutenção:', error);
    alert('Erro de comunicação com o servidor');
  }
}

async function removerManutencao(estacaoId) {
  if (!isAdmin) {
    alert('Acesso negado');
    return;
  }

  if (!confirm('Confirma remover a estação da manutenção?')) {
    return;
  }

  try {
    const resp = await fetch('http://localhost:3000/api/admin/manutencao/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estacao_id: estacaoId,
        admin_email: localStorage.getItem('email')
      })
    });

    if (resp.ok) {
      alert('Estação removida da manutenção com sucesso!');
      await atualizarDisponibilidadeEstacao(estacaoId);
    } else {
      const error = await resp.json();
      alert('Erro: ' + (error.error || 'Erro desconhecido'));
    }
  } catch (error) {
    console.error('Erro ao remover da manutenção:', error);
    alert('Erro de comunicação com o servidor');
  }
}


// === FUNÇÕES GLOBAIS ===

// Tornar funções acessíveis globalmente para os botões
window.reservarEstacao = reservarEstacao;
window.iniciarCarregamento = iniciarCarregamento;
window.iniciarCarregamentoReservado = iniciarCarregamentoReservado;
window.cancelarReserva = cancelarReserva;
window.terminarCarregamento = terminarCarregamento;
window.colocarManutencao = colocarManutencao;
window.removerManutencao = removerManutencao;
window.adicionarEstacaoLocal = adicionarEstacaoLocal;
window.removerEstacaoLocal = removerEstacaoLocal;

// === INICIALIZAÇÃO ===

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function () {
  inicializar();

  // Adicionar botão para admins adicionarem estações
  if (localStorage.getItem('is_admin') === '1') {
    const botaoAdicionar = document.createElement('button');
    botaoAdicionar.textContent = '+ Estação';
    botaoAdicionar.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000;
      background: #4bc0c0;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Oswald', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    botaoAdicionar.onclick = adicionarEstacaoLocal;
    document.body.appendChild(botaoAdicionar);
  }
});

// Carregar estações inicialmente
carregarEstacoes();