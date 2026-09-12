'use strict';

const API = {
  baseUrl: window.location.origin,

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const contentType = response.headers.get("content-type") || "";

    let data;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(typeof data === "string" ? data : "Erro na requisição.");
    }

    return data;
  }
};

/* ════════════════════════════════════════════
   DB — estado em memória sincronizado SOMENTE com o banco
   - Dados oficiais: /users, /trips, /payments, /seats e /rooms.
   - Não usa Local Storage.
════════════════════════════════════════════ */
const DB = {
  data: {
    users: [],
    trips: [],
    payments: [],
    seats: {},
    rooms: {},
    ok: true
  },
  saving: null,

  async load() {
    try {
      const [users, tripsRaw, paymentsRaw, seatsRaw, roomsRaw] = await Promise.all([
        API.request('/users'),
        API.request('/trips'),
        API.request('/payments'),
        API.request('/seats'),
        API.request('/rooms')
      ]);

      this.data = {
        users: (users || []).map(apiToUser),
        trips: (tripsRaw || []).map(apiToTrip),
        payments: (paymentsRaw || []).map(apiToPayment),
        seats: seatsArrayToMap(seatsRaw || []),
        rooms: roomsArrayToMap(roomsRaw || []),
        ok: true
      };
    } catch (err) {
      console.error('Erro ao carregar dados do banco:', err);
      toast('Não foi possível carregar os dados do banco.', 'er', 5000);
    }
  },

  get(k) {
    return this.data[k] ?? null;
  },

  async set(k, v) {
    this.data[k] = v;
    return this.saveKey(k);
  },

  async del(k) {
    delete this.data[k];
    return this.saveKey(k);
  },

  async saveKey(k) {
    const jobs = {
      users: () => API.request('/users/bulk', { method: 'PUT', body: JSON.stringify((this.data.users || []).map(userToApi)) }),
      trips: () => API.request('/trips/bulk', { method: 'PUT', body: JSON.stringify((this.data.trips || []).map(tripToApi)) }),
      payments: () => API.request('/payments/bulk', { method: 'PUT', body: JSON.stringify((this.data.payments || []).map(paymentToApi)) }),
      seats: () => API.request('/seats/bulk', { method: 'PUT', body: JSON.stringify(seatsMapToArray(this.data.seats || {})) }),
      rooms: () => API.request('/rooms/bulk', { method: 'PUT', body: JSON.stringify(roomsMapToArray(this.data.rooms || {})) })
    };
    if (!jobs[k]) return;
    this.saving = jobs[k]().catch(err => {
      console.error('Erro ao salvar no banco:', err);
      toast('Erro ao salvar no banco de dados.', 'er', 5000);
    });
    return this.saving;
  },

  async flush() {
    if (this.saving) await this.saving;
  }
};

function jsonParseSafe(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

function apiToUser(u) {
  return {
    cpf: CPF.strip(u.cpf || ''),
    name: u.name || '',
    password: u.password || '',
    role: (u.role || 'traveler').toLowerCase(),
    birthdate: u.birthdate || '',
    married: !!u.married,
    spouseName: u.spouseName || '',
    hasKids: !!u.hasKids,
    kids: u.kids || [],
    firstLogin: !!u.firstLogin
  };
}
function userToApi(u) {
  return {
    cpf: CPF.strip(u.cpf || ''),
    name: u.name || '',
    password: u.password || 'acess@123',
    role: (u.role || 'traveler').toLowerCase(),
    birthdate: u.birthdate || '',
    married: !!u.married,
    spouseName: u.spouseName || '',
    hasKids: !!u.hasKids,
    kids: u.kids || [],
    firstLogin: !!u.firstLogin
  };
}
function apiToTrip(t) {
  return {
    id: t.id,
    name: t.name || '',
    destination: t.destination || '',
    departurePlace: t.departurePlace || '',
    departureTime: t.departureTime || '',
    date: t.date || '',
    maxPeople: t.maxPeople || 44,
    price: Number(t.price || 0),
    arrecadationGoal: Number(t.arrecadationGoal || 0),
    rules: t.rules || '',
    buses: jsonParseSafe(t.busesJson, []),
    hotels: jsonParseSafe(t.hotelsJson, []),
    travelers: jsonParseSafe(t.travelersJson, [])
  };
}
function tripToApi(t) {
  return {
    id: t.id || ('trip_' + Date.now()),
    name: t.name || '',
    destination: t.destination || '',
    departurePlace: t.departurePlace || '',
    departureTime: t.departureTime || '',
    date: t.date || null,
    maxPeople: t.maxPeople || 44,
    price: Number(t.price || 0),
    arrecadationGoal: Number(t.arrecadationGoal || 0),
    rules: t.rules || '',
    busesJson: JSON.stringify(t.buses || []),
    hotelsJson: JSON.stringify(t.hotels || []),
    travelersJson: JSON.stringify(t.travelers || [])
  };
}
function apiToPayment(p) {
  return {
    id: p.id || ((p.userCpf || p.cpf || '') + '_' + p.tripId),
    cpf: CPF.strip(p.cpf || p.userCpf || ''),
    tripId: p.tripId || '',
    totalInstallments: Number(p.totalInstallments || 1),
    paidInstallments: Number(p.paidInstallments || 0),
    dueDay: Number(p.dueDay || 10),
    locked: !!p.locked,
    receipts: jsonParseSafe(p.receiptsJson, {})
  };
}
function paymentToApi(p) {
  const cpf = CPF.strip(p.cpf || p.userCpf || '');
  return {
    id: p.id || (cpf + '_' + p.tripId),
    userCpf: cpf,
    tripId: p.tripId || '',
    totalInstallments: Number(p.totalInstallments || 1),
    paidInstallments: Number(p.paidInstallments || 0),
    dueDay: Number(p.dueDay || 10),
    locked: !!p.locked,
    receiptsJson: JSON.stringify(p.receipts || {})
  };
}
function seatsArrayToMap(list) {
  const out = {};
  (list || []).forEach(s => {
    const key = `${s.tripId}_${s.busId}`;
    const cpf = CPF.strip(s.userCpf || s.cpf || '');
    if (!out[key]) out[key] = {};
    if (!out[key][cpf]) out[key][cpf] = [];
    out[key][cpf].push(Number(s.seatNumber));
  });
  return out;
}
function seatsMapToArray(map) {
  const rows = [];
  Object.entries(map || {}).forEach(([key, byCpf]) => {
    const sep = key.lastIndexOf('_');
    if (sep <= 0) return;
    const tripId = key.substring(0, sep);
    const busId = key.substring(sep + 1);
    Object.entries(byCpf || {}).forEach(([cpfRaw, nums]) => {
      const cpf = CPF.strip(cpfRaw);
      (nums || []).forEach(n => rows.push({
        id: `${tripId}_${busId}_${cpf}_${n}`,
        tripId,
        busId,
        floor: 1,
        seatNumber: Number(n),
        userCpf: cpf
      }));
    });
  });
  return rows;
}
function roomsArrayToMap(list) {
  const out = {};
  (list || []).forEach(r => {
    if (!out[r.tripId]) out[r.tripId] = {};
    out[r.tripId][r.id] = r.occupants || [];
  });
  return out;
}
function roomsMapToArray(map) {
  const rows = [];
  Object.entries(map || {}).forEach(([tripId, rooms]) => {
    Object.entries(rooms || {}).forEach(([roomId, occupants]) => {
      rows.push({
        id: roomId,
        tripId,
        name: roomId,
        type: 'Quarto',
        capacity: Math.max((occupants || []).length, 1),
        occupants: occupants || []
      });
    });
  });
  return rows;
}

function seed() {
  // Não cria dados locais. Os dados oficiais vêm dos endpoints reais do backend.
  if (!DB.get('trips')) DB.data.trips = [];
  if (!DB.get('payments')) DB.data.payments = [];
  if (!DB.get('seats')) DB.data.seats = {};
  if (!DB.get('rooms')) DB.data.rooms = {};
}

/* ════════════════════════════════════════════
   SESSION
   Dados do sistema ficam no banco. Aqui ficam apenas cookies simples
   para manter o usuário e a viagem ativa entre páginas.
════════════════════════════════════════════ */
function setCookie(name, value, days = 1) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const prefix = `${name}=`;
  const item = document.cookie.split('; ').find(row => row.startsWith(prefix));
  if (!item) return null;
  try { return JSON.parse(decodeURIComponent(item.slice(prefix.length))); }
  catch { return null; }
}

function delCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

const S = {
  get      : ()   => getCookie('iv_session'),
  set      : u    => setCookie('iv_session', u),
  clear    : ()   => delCookie('iv_session'),
  getTrip  : ()   => getCookie('iv_active_trip'),
  setTrip  : id   => setCookie('iv_active_trip', id),
  clearTrip: ()   => delCookie('iv_active_trip')
};

/* ════════════════════════════════════════════
   CPF
════════════════════════════════════════════ */
const CPF = {
  strip : v => (v||'').replace(/\D/g,''),
  format: v => {
    const d = CPF.strip(v);
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },
  mask  : input => {
    input.addEventListener('input', function(){
      let v = this.value.replace(/\D/g,'').slice(0,11);
      if      (v.length>9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
      else if (v.length>6) v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
      else if (v.length>3) v = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
      this.value = v;
    });
  },
  valid : cpf => {
    const d = CPF.strip(cpf);
    if (d.length!==11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;
    let s=0; for(let i=0;i<9;i++) s+=parseInt(d[i])*(10-i);
    let r=(s*10)%11; if(r===10||r===11) r=0;
    if(r!==parseInt(d[9])) return false;
    s=0; for(let i=0;i<10;i++) s+=parseInt(d[i])*(11-i);
    r=(s*10)%11; if(r===10||r===11) r=0;
    return r===parseInt(d[10]);
  }
};

function bindCPF(input, fb) {
  CPF.mask(input);
  input.addEventListener('blur', () => {
    const v = CPF.strip(input.value);
    if (!v) return;
    if (!CPF.valid(v)) {
      input.classList.add('is-invalid'); input.classList.remove('is-valid');
      if(fb){ fb.textContent='CPF inválido.'; fb.className='field-msg show err'; }
    } else {
      input.classList.add('is-valid'); input.classList.remove('is-invalid');
      if(fb){ fb.textContent='CPF válido'; fb.className='field-msg show ok'; }
    }
  });
}

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
function toast(msg, type='in', dur=3400) {
  const icons = {ok:'<i data-lucide="check-circle" class="lucide-icon"></i>',er:'<i data-lucide="x-circle" class="lucide-icon"></i>',wn:'<i data-lucide="alert-triangle" class="lucide-icon"></i>',in:'<i data-lucide="info" class="lucide-icon"></i>'};
  let box = document.getElementById('toast-box');
  if (!box) { box=document.createElement('div'); box.id='toast-box'; box.className='toast-box'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-ico">${icons[type]||'<i data-lucide="info" class="lucide-icon"></i>'}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()"><i data-lucide="x" class="lucide-icon"></i></button>`;
  box.appendChild(el);
  reInitIcons();
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),320); }, dur);
}

/* ════════════════════════════════════════════
   MODAL
════════════════════════════════════════════ */
const openM  = id => { const m=document.getElementById(id); if(m){m.classList.add('on');document.body.style.overflow='hidden';reInitIcons();} };
const closeM = id => { const m=document.getElementById(id); if(m){m.classList.remove('on');document.body.style.overflow='';reInitIcons();} };
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay') && !e.target.classList.contains('no-close'))
    { e.target.classList.remove('on'); document.body.style.overflow=''; }
});

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
const $   = (id,v) => { const el=document.getElementById(id); if(el&&v!==undefined) el.textContent=v; return el; };
const fmt = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0);
const fmtD = d => d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : '—';
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getTrip(id) {
  const trips = DB.get('trips')||[];
  return trips.find(t=>t.id===id)||null;
}
function getActiveTrip() { return getTrip(S.getTrip()); }
function getUserTrips(cpf) {
  const trips = DB.get('trips')||[];
  return trips.filter(t=>(t.travelers||[]).includes(cpf));
}
function getUserSeat(cpf, tripId) {
  const seats = DB.get('seats')||{};
  const trip  = getTrip(tripId); if(!trip) return null;
  for (const bus of (trip.buses||[])) {
    const key  = `${tripId}_${bus.id}`;
    const bmap = seats[key]||{};
    if (bmap[cpf]) return { bus: bus.id, seats: bmap[cpf] };
  }
  return null;
}
function getUserRoom(cpf, tripId) {
  const rooms = DB.get('rooms')||{};
  const tRooms = rooms[tripId]||{};
  for (const [roomId, occupants] of Object.entries(tRooms)) {
    if ((occupants||[]).includes(cpf)) return roomId;
  }
  return null;
}
function getRoommates(cpf, tripId, roomId) {
  const rooms  = DB.get('rooms')||{};
  const tRooms = rooms[tripId]||{};
  const occs   = tRooms[roomId]||[];
  const users  = DB.get('users')||[];
  return occs.filter(c=>c!==cpf).map(c=>{ const u=users.find(x=>x.cpf===c); return u?u.name:c; });
}

function toggleSB() { document.querySelector('.sidebar')?.classList.toggle('open'); }
function logout()   { S.clear(); S.clearTrip(); location.href='index.html'; }
function guard(role) {
  const s = S.get();
  if (!s) { location.href='index.html'; return false; }
  if (role && s.role!==role) {
    location.href = s.role==='admin'?'dashboard-admin.html':'dashboard-viajante.html';
    return false;
  }
  return true;
}
function setActive() {
  const pg = location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.nav-a').forEach(a=>a.classList.toggle('on', a.getAttribute('href')===pg));
}
function fillSB() {
  const s=S.get(); if(!s) return;
  $('sb-name', s.name);
  $('sb-role', s.role==='admin'?'Administrador':'Viajante');
  $('sb-ava',  s.name.charAt(0).toUpperCase());
}

/* ════════════════════════════════════════════
   BUILD SIDEBARS DYNAMICALLY
════════════════════════════════════════════ */
function buildAdminSidebar(active) {
  const nav = document.getElementById('sb-nav');
  const sub = document.getElementById('sb-sub');
  if(sub) sub.textContent='Painel Admin';
  if(!nav) return;
  nav.innerHTML=`
    <div class="sb-sec">Principal</div>
    <a href="dashboard-admin.html" class="nav-a ${active==='dash'?'on':''}"><span class="ico"><i data-lucide="bar-chart-2" class="lucide-icon"></i></span>Dashboard</a>
    <a href="viajantes.html"       class="nav-a ${active==='viaj'?'on':''}"><span class="ico"><i data-lucide="users" class="lucide-icon"></i></span>Viajantes</a>
    <div class="sb-sec">Gestão</div>
    <a href="pagamento.html"    class="nav-a ${active==='pag'?'on':''}"><span class="ico"><i data-lucide="credit-card" class="lucide-icon"></i></span>Pagamentos</a>
    <a href="transporte.html"   class="nav-a ${active==='trans'?'on':''}"><span class="ico"><i data-lucide="bus" class="lucide-icon"></i></span>Transporte</a>
    <a href="hotel.html"        class="nav-a ${active==='hotel'?'on':''}"><span class="ico"><i data-lucide="building-2" class="lucide-icon"></i></span>Hotel</a>
    <div class="sb-sec">Sistema</div>
    <a href="cadastros.html" class="nav-a ${active==='cadastros'?'on':''}"><span class="ico"><i data-lucide="folder-open" class="lucide-icon"></i></span>Cadastro Global</a>
    <a href="configuracoes.html" class="nav-a ${active==='cfg'?'on':''}"><span class="ico"><i data-lucide="settings" class="lucide-icon"></i></span>Configurações</a>`;
  reInitIcons();
}
function buildTravelerSidebar(active) {
  const nav = document.getElementById('sb-nav');
  const sub = document.getElementById('sb-sub');
  if(sub) sub.textContent='Área do Viajante';
  if(!nav) return;
  nav.innerHTML=`
    <div class="sb-sec">Minha Viagem</div>
    <a href="dashboard-viajante.html" class="nav-a ${active==='dash'?'on':''}"><span class="ico"><i data-lucide="home" class="lucide-icon"></i></span>Início</a>
    <a href="pagamento.html"          class="nav-a ${active==='pag'?'on':''}"><span class="ico"><i data-lucide="credit-card" class="lucide-icon"></i></span>Pagamento</a>`;
  reInitIcons();
}

/* ════════════════════════════════════════════
   TRAVELER TRIP SELECTOR (always shows popup)
════════════════════════════════════════════ */
function showTravelerTripSelector(trips, onSelect) {
  document.getElementById('trav-trip-sel')?.remove();
  const ov=document.createElement('div');
  ov.className='overlay no-close on'; ov.id='trav-trip-sel';
  const cards=trips.length
    ? trips.map(t=>`
      <div onclick="travSelectTrip('${t.id}')" class="trav-trip-card" data-id="${t.id}"
        style="cursor:pointer;padding:1.1rem 1.25rem;border:2px solid var(--border);border-radius:var(--r);
        background:var(--surface);transition:all .2s;display:flex;align-items:center;gap:1rem"
        onmouseover="this.style.borderColor='var(--red)';this.style.background='rgba(232,25,44,.03)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
        <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--navy),var(--sky));
          display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="plane" class="lucide-icon" style="width:1.5rem;height:1.5rem;stroke:white"></i></div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.94rem;color:var(--text)">${t.name}</div>
          <div style="font-size:.76rem;color:var(--text-3);margin-top:.18rem">
            ${t.destination||'—'} &nbsp;|&nbsp; ${fmtD(t.date)}
          </div>
        </div>
        <span style="margin-left:auto;color:var(--text-3);font-size:1.2rem">›</span>
      </div>`).join('')
    : `<div style="padding:2.5rem;text-align:center">
        <div style="margin-bottom:1rem"><i data-lucide="plane" class="lucide-icon" style="width:3rem;height:3rem;stroke:var(--text-3)"></i></div>
        <p style="color:var(--text-2);font-size:.9rem">Você ainda não foi adicionado a nenhuma viagem.<br>Aguarde o administrador.</p>
      </div>`;
  ov.innerHTML=`
    <div class="modal" style="max-width:480px">
      <div class="modal-head" style="background:linear-gradient(135deg,var(--navy),var(--navy-light));border-radius:var(--r-lg) var(--r-lg) 0 0">
        <div>
          <div class="modal-title" style="color:#fff"><i data-lucide="plane" class="lucide-icon"></i> Suas Viagens</div>
          <div style="font-size:.76rem;color:rgba(255,255,255,.45);margin-top:.18rem">Escolha qual viagem deseja acessar</div>
        </div>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem;max-height:55vh;overflow-y:auto">${cards}</div>
      <div class="modal-foot"><button class="btn btn-outline" onclick="logout()"><i data-lucide="log-out" class="lucide-icon"></i> Sair</button></div>
    </div>`;
  document.body.appendChild(ov);
  reInitIcons();
  window._travTripCallback=onSelect;
}
window.travSelectTrip=function(id){
  S.setTrip(id);
  document.getElementById('trav-trip-sel')?.remove();
  document.body.style.overflow='';
  if(window._travTripCallback) window._travTripCallback(id);
};

/* ════════════════════════════════════════════
   ADMIN TRIP SELECTOR MODAL
════════════════════════════════════════════ */
window.openAdminTripSelector=function(){
  document.getElementById('trip-sel-overlay')?.remove();
  const trips=DB.get('trips')||[];
  const ov=document.createElement('div');
  ov.className='overlay no-close on'; ov.id='trip-sel-overlay';
  const cards=trips.length
    ? trips.map(t=>`
      <div onclick="adminSelectTrip('${t.id}')" class="trip-card" data-id="${t.id}"
        style="cursor:pointer;padding:1rem 1.25rem;border:2px solid var(--border);border-radius:var(--r);
        background:var(--surface);transition:all .2s;display:flex;align-items:center;gap:.85rem">
        <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--red),var(--red-light));
          display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="plane" class="lucide-icon" style="width:1.5rem;height:1.5rem;stroke:white"></i></div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.94rem;color:var(--text)">${t.name}</div>
          <div style="font-size:.76rem;color:var(--text-3);margin-top:.18rem">${t.destination||'—'} &nbsp;|&nbsp; ${fmtD(t.date)} &nbsp;|&nbsp; ${(t.travelers||[]).length} viajantes</div>
        </div>
        <div style="display:flex;gap:.35rem;flex-shrink:0">
          <button class="btn btn-outline btn-sm btn-icon" onclick="event.stopPropagation();openCreateTrip('${t.id}')"><i data-lucide="pencil" class="lucide-icon"></i></button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteTrip('${t.id}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>
        </div>
      </div>`).join('')
    : `<div class="alert al-sky"><span class="al-ico"><i data-lucide="info" class="lucide-icon"></i></span><span>Nenhuma viagem cadastrada. Crie a primeira!</span></div>`;
  ov.innerHTML=`
    <div class="modal" style="max-width:560px">
      <div class="modal-head" style="padding:1.25rem 1.5rem">
        <div>
          <div class="modal-title"><i data-lucide="plane" class="lucide-icon"></i> Selecionar Viagem</div>
          <div style="font-size:.76rem;color:var(--text-3);margin-top:.2rem">Selecione ou crie uma viagem para gerenciar</div>
        </div>
        <button class="btn btn-red btn-sm" onclick="openCreateTrip()"><i data-lucide="plus" class="lucide-icon"></i> Nova Viagem</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.6rem;max-height:55vh;overflow-y:auto">${cards}</div>
      <div class="modal-foot" style="justify-content:space-between">
        <button class="btn btn-outline btn-sm" onclick="openGlobalCadastros()"><i data-lucide="folder-open" class="lucide-icon"></i> Gerenciar Viajantes</button>
        <button class="btn btn-outline btn-sm" onclick="logout()"><i data-lucide="log-out" class="lucide-icon"></i> Sair</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  reInitIcons();
};

window.adminSelectTrip=function(id){
  S.setTrip(id);
  document.getElementById('trip-sel-overlay')?.remove();
  document.body.style.overflow='';
  const pg=location.pathname.split('/').pop();
  if(pg==='index.html'||pg==='') location.href='dashboard-admin.html';
  else location.reload();
};

/* ════════════════════════════════════════════
   GLOBAL CADASTROS OVERLAY (admin, outside trip)
════════════════════════════════════════════ */
window.openGlobalCadastros=function(){
  document.getElementById('trip-sel-overlay')?.remove();
  document.getElementById('global-cad-overlay')?.remove();
  renderGlobalCadastrosOverlay();
};

function renderGlobalCadastrosOverlay(){
  const users=DB.get('users')||[];
  const ov=document.createElement('div');
  ov.className='overlay no-close on'; ov.id='global-cad-overlay';
  const rows=users.map(u=>`
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.85rem 1rem">
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="ava" style="background:${u.role==='admin'?'linear-gradient(135deg,var(--gold),#d4830a)':'linear-gradient(135deg,var(--navy),var(--sky))'};flex-shrink:0">${u.name.charAt(0)}</div>
          <div>
            <div style="font-weight:600;font-size:.88rem">${u.name}</div>
            <div style="font-size:.72rem;color:var(--text-3)">${u.married&&u.spouseName?'<i data-lucide="heart" class="lucide-icon"></i> '+u.spouseName:''} ${u.hasKids?'· <i data-lucide="baby" class="lucide-icon"></i> '+(u.kids||[]).length+' filho(s)':''}</div>
          </div>
        </div>
      </td>
      <td style="padding:.85rem 1rem;font-size:.8rem;color:var(--text-3)">${CPF.format(u.cpf)}</td>
      <td style="padding:.85rem 1rem"><span class="badge ${u.role==='admin'?'b-gold':'b-sky'}">${u.role==='admin'?'<i data-lucide="crown" class="lucide-icon"></i> Admin':'<i data-lucide="plane" class="lucide-icon"></i> Viajante'}</span></td>
      <td style="padding:.85rem 1rem;font-size:.78rem;color:var(--text-3)">${u.firstLogin?'<i data-lucide="hourglass" class="lucide-icon"></i> Aguardando':'<i data-lucide="check-circle" class="lucide-icon"></i> Ativo'}</td>
      <td style="padding:.85rem 1rem;white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editGlobalUser('${u.cpf}')"><i data-lucide="pencil" class="lucide-icon"></i></button>
        ${u.cpf!=='10127544135'?`<button class="btn btn-danger btn-sm" onclick="deleteGlobalUser('${u.cpf}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>`:'' }
      </td>
    </tr>`).join('');
  ov.innerHTML=`
    <div class="modal" style="max-width:680px;max-height:92vh">
      <div class="modal-head">
        <div>
          <div class="modal-title"><i data-lucide="folder-open" class="lucide-icon"></i> Cadastro Global de Viajantes</div>
          <div style="font-size:.76rem;color:var(--text-3);margin-top:.18rem">Todos os usuários do sistema, independente da viagem</div>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button class="btn btn-red btn-sm" onclick="openNewGlobalUser()"><i data-lucide="plus" class="lucide-icon"></i> Novo</button>
          <button class="modal-x" onclick="document.getElementById('global-cad-overlay').remove();document.body.style.overflow='';openAdminTripSelector()"><i data-lucide="x" class="lucide-icon"></i></button>
        </div>
      </div>
      <div style="overflow-y:auto;max-height:62vh">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--surface-2);border-bottom:1.5px solid var(--border)">
            <th style="padding:.7rem 1rem;text-align:left;font-size:.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">Nome</th>
            <th style="padding:.7rem 1rem;text-align:left;font-size:.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">CPF</th>
            <th style="padding:.7rem 1rem;text-align:left;font-size:.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">Papel</th>
            <th style="padding:.7rem 1rem;text-align:left;font-size:.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">Status</th>
            <th style="padding:.7rem 1rem;text-align:left;font-size:.7rem;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">Ações</th>
          </tr></thead>
          <tbody>${rows||'<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text-3)">Nenhum usuário cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('global-cad-overlay').remove();document.body.style.overflow='';openAdminTripSelector()">← Voltar às Viagens</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  reInitIcons();
}

window.openNewGlobalUser=function(editCpf=null){
  document.getElementById('global-user-overlay')?.remove();
  const u=editCpf?(DB.get('users')||[]).find(x=>x.cpf===editCpf):null;
  const ov=document.createElement('div');
  ov.className='overlay on'; ov.id='global-user-overlay';
  ov.innerHTML=`
    <div class="modal" style="max-width:560px;max-height:92vh;overflow-y:auto">
      <div class="modal-head">
        <span class="modal-title">${u?'<i data-lucide="pencil" class="lucide-icon"></i> Editar Usuário':'<i data-lucide="plus" class="lucide-icon"></i> Novo Usuário'}</span>
        <button class="modal-x" onclick="document.getElementById('global-user-overlay').remove();document.body.style.overflow='';(document.getElementById('users-tbody')?renderCadastrosPage():renderGlobalCadastrosOverlay())"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="gu-edit-cpf" value="${editCpf||''}">
        <div class="g2" style="gap:.85rem">
          <div class="form-group dark-label" style="grid-column:1/-1">
            <label>Nome Completo *</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="user" class="lucide-icon"></i></span>
              <input type="text" id="gu-name" class="form-control light" placeholder="Nome completo" value="${u?.name||''}">
            </div>
          </div>
          <div class="form-group dark-label">
            <label>CPF *</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="id-card" class="lucide-icon"></i></span>
              <input type="text" id="gu-cpf" class="form-control light" placeholder="000.000.000-00"
                maxlength="14" inputmode="numeric"
                value="${u?CPF.format(u.cpf):''}" ${u?'readonly style="background:var(--surface-2)"':''}>
            </div>
            <span class="field-msg" id="gu-cpf-fb"></span>
          </div>
          <div class="form-group dark-label">
            <label>Data de Nascimento</label>
            <input type="date" id="gu-birth" class="form-control light no-icon" value="${u?.birthdate||''}">
          </div>
          <div class="form-group dark-label" style="grid-column:1/-1">
            <label>Papel no Sistema *</label>
            <select id="gu-role" class="form-control light no-icon">
              <option value="traveler" ${(!u||u.role==='traveler')?'selected':''}>Viajante</option>
              <option value="admin" ${u?.role==='admin'?'selected':''}>Administrador</option>
            </select>
          </div>
        </div>
        <!-- Casamento -->
        <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:.75rem 0">
          <input type="checkbox" id="gu-married" style="width:18px;height:18px;accent-color:var(--red)" ${u?.married?'checked':''}>
          <label for="gu-married" style="font-size:.88rem;font-weight:600;color:var(--text);cursor:pointer"><i data-lucide="heart" class="lucide-icon"></i> Casado(a)</label>
        </div>
        <div class="gone" id="gu-spouse-sec">
          <div class="form-group dark-label">
            <label>Nome do Cônjuge</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="users" class="lucide-icon"></i></span>
              <input type="text" id="gu-spouse" class="form-control light" placeholder="Nome exato do cônjuge" value="${u?.spouseName||''}">
            </div>
            <div id="gu-spouse-hint" style="font-size:.76rem;color:var(--mint);margin-top:.3rem;display:none"></div>
          </div>
        </div>
        <!-- Filhos -->
        <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 0;border-bottom:1px solid var(--border);margin-bottom:.75rem">
          <input type="checkbox" id="gu-kids" style="width:18px;height:18px;accent-color:var(--red)" ${u?.hasKids?'checked':''}>
          <label for="gu-kids" style="font-size:.88rem;font-weight:600;color:var(--text);cursor:pointer"><i data-lucide="baby" class="lucide-icon"></i> Tem filhos</label>
        </div>
        <div class="gone" id="gu-kids-sec">
          <div class="form-group dark-label">
            <label>Quantidade de Filhos</label>
            <input type="number" id="gu-kids-qty" class="form-control light no-icon" min="1" max="10" value="${u?.kids?.length||1}" style="max-width:120px">
          </div>
          <div id="gu-kids-names"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('global-user-overlay').remove();document.body.style.overflow='';(document.getElementById('users-tbody')?renderCadastrosPage():renderGlobalCadastrosOverlay())">Cancelar</button>
        <button class="btn btn-red" onclick="saveGlobalUser()"><i data-lucide="save" class="lucide-icon"></i> Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  reInitIcons();
  // Wire events
  const cpfEl=document.getElementById('gu-cpf');if(cpfEl&&!u) bindCPF(cpfEl,document.getElementById('gu-cpf-fb'));
  const marEl=document.getElementById('gu-married');
  marEl?.addEventListener('change',function(){document.getElementById('gu-spouse-sec').classList.toggle('gone',!this.checked);});
  if(u?.married) document.getElementById('gu-spouse-sec')?.classList.remove('gone');
  document.getElementById('gu-spouse')?.addEventListener('blur',function(){
    const hint=document.getElementById('gu-spouse-hint');if(!hint)return;
    const users=DB.get('users')||[];
    const match=users.find(x=>x.married&&x.spouseName&&x.spouseName.toLowerCase().trim()===this.value.toLowerCase().trim()&&x.cpf!==(u?.cpf));
    if(match){hint.style.display='block';hint.textContent=`${match.name} também indicou este nome como cônjuge — eles serão vinculados!`;}
    else hint.style.display='none';
  });
  const kidsEl=document.getElementById('gu-kids');
  kidsEl?.addEventListener('change',function(){document.getElementById('gu-kids-sec').classList.toggle('gone',!this.checked);});
  if(u?.hasKids) document.getElementById('gu-kids-sec')?.classList.remove('gone');
  const qtyEl=document.getElementById('gu-kids-qty');
  function buildKidInputs(count){
    const c=document.getElementById('gu-kids-names');if(!c)return;c.innerHTML='';
    for(let i=1;i<=Math.min(count,10);i++){
      c.innerHTML+=`<div class="form-group dark-label"><label>Nome do Filho ${i}</label>
        <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="baby" class="lucide-icon"></i></span>
          <input type="text" id="gu-kid-${i}" class="form-control light" placeholder="Nome do filho ${i}" value="${u?.kids?.[i-1]||''}">
        </div></div>`;
    }
  }
  qtyEl?.addEventListener('input',function(){buildKidInputs(parseInt(this.value)||0);});
  buildKidInputs(u?.kids?.length||0);
};

window.saveGlobalUser=function(){
  const editCpf=document.getElementById('gu-edit-cpf')?.value;
  const name=document.getElementById('gu-name')?.value.trim();if(!name){toast('Preencha o nome.','er');return;}
  const role=document.getElementById('gu-role')?.value||'traveler';
  const birth=document.getElementById('gu-birth')?.value||'';
  const married=document.getElementById('gu-married')?.checked||false;
  const spouseName=document.getElementById('gu-spouse')?.value?.trim()||'';
  const hasKids=document.getElementById('gu-kids')?.checked||false;
  const kidQty=parseInt(document.getElementById('gu-kids-qty')?.value)||0;
  const kids=[];for(let i=1;i<=kidQty;i++){const n=document.getElementById(`gu-kid-${i}`)?.value?.trim();if(n)kids.push(n);}
  const users=DB.get('users')||[];
  if(editCpf){
    const idx=users.findIndex(u=>u.cpf===editCpf);
    if(idx>=0) users[idx]={...users[idx],name,role,birthdate:birth,married,spouseName,hasKids,kids};
  } else {
    const rawCpf=CPF.strip(document.getElementById('gu-cpf')?.value||'');
    if(!CPF.valid(rawCpf)){toast('CPF inválido.','er');return;}
    if(users.find(u=>u.cpf===rawCpf)){toast('CPF já cadastrado.','er');return;}
    users.push({cpf:rawCpf,password:'acess@123',role,name,birthdate:birth,married,spouseName,hasKids,kids,firstLogin:true});
    toast(`${name} cadastrado! Login: ${CPF.format(rawCpf)} / acess@123`,'ok',5000);
  }
  DB.set('users',users);
  document.getElementById('global-user-overlay')?.remove();document.body.style.overflow='';
  toast(editCpf?'Usuário atualizado!':'Cadastrado com sucesso!','ok');
  // Refresh whichever context is active
  const onPage=document.getElementById('users-tbody');
  if(onPage) renderCadastrosPage(); else renderGlobalCadastrosOverlay();
};

window.editGlobalUser=function(cpf){
  const onPage=document.getElementById('users-tbody');
  if(!onPage) document.getElementById('global-cad-overlay')?.remove();
  openNewGlobalUser(cpf);
};

window.deleteGlobalUser=function(cpf){
  const users=DB.get('users')||[];const u=users.find(x=>x.cpf===cpf);if(!u)return;
  if(!confirm(`Excluir ${u.name} do sistema?\n\nSerá removido de todas as viagens.`))return;
  DB.set('users',users.filter(x=>x.cpf!==cpf));
  DB.set('trips',(DB.get('trips')||[]).map(t=>({...t,travelers:(t.travelers||[]).filter(c=>c!==cpf)})));
  toast('Usuário removido.','ok');
  // Refresh whichever context we're in
  const onPage=document.getElementById('users-tbody');
  if(onPage) renderCadastrosPage(); else renderGlobalCadastrosOverlay();
};

/* ════════════════════════════════════════════
   CREATE / EDIT TRIP MODAL (Admin)
════════════════════════════════════════════ */
function openCreateTrip(editId=null) {
  document.getElementById('trip-sel-overlay')?.remove();
  document.getElementById('create-trip-overlay')?.remove();

  const trip = editId ? getTrip(editId) : null;
  const v    = trip || {};

  const buses = (v.buses||[{id:1,floors:1,seats:44}]);
  let busesHtml = buses.map((b,i)=>buildBusRow(b,i)).join('');

  const ov = document.createElement('div');
  ov.className = 'overlay no-close on';
  ov.id = 'create-trip-overlay';
  ov.innerHTML = `
    <div class="modal" style="max-width:640px;max-height:92vh;overflow-y:auto">
      <div class="modal-head">
        <span class="modal-title">${editId?'<i data-lucide="pencil" class="lucide-icon"></i> Editar Viagem':'<i data-lucide="plus" class="lucide-icon"></i> Nova Viagem'}</span>
        <button class="modal-x" onclick="closeCreateTrip()"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="trip-edit-id" value="${editId||''}">
        <div class="g2" style="gap:.85rem">
          <div class="form-group dark-label" style="grid-column:1/-1">
            <label>Nome da Viagem *</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="plane" class="lucide-icon"></i></span>
              <input type="text" id="t-name" class="form-control light" value="${v.name||''}" placeholder="Ex: Retiro Espiritual 2025">
            </div>
          </div>
          <div class="form-group dark-label">
            <label>Local de Partida *</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="map-pin" class="lucide-icon"></i></span>
              <input type="text" id="t-dep" class="form-control light" value="${v.departurePlace||''}" placeholder="Ex: Igreja Central">
            </div>
          </div>
          <div class="form-group dark-label">
            <label>Destino Final *</label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="flag" class="lucide-icon"></i></span>
              <input type="text" id="t-dest" class="form-control light" value="${v.destination||''}" placeholder="Ex: Aparecida do Norte — SP">
            </div>
          </div>
          <div class="form-group dark-label">
            <label>Data da Viagem *</label>
            <input type="date" id="t-date" class="form-control light" value="${v.date||''}">
          </div>
          <div class="form-group dark-label">
            <label>Hora de Partida *</label>
            <input type="time" id="t-time" class="form-control light" value="${v.departureTime||''}">
          </div>
          <div class="form-group dark-label">
            <label>Máximo de Pessoas</label>
            <input type="number" id="t-max" class="form-control light" value="${v.maxPeople||44}" min="1">
          </div>
          <div class="form-group dark-label">
            <label>Valor por Viajante (R$)</label>
            <input type="number" id="t-price" class="form-control light" value="${v.price||''}" min="0" step="0.01" placeholder="0,00">
          </div>
          <div class="form-group dark-label" style="grid-column:1/-1">
            <label><i data-lucide="target" class="lucide-icon"></i> Meta de Arrecadação (R$) <span style="font-size:.72rem;color:var(--text-3);font-weight:400">— deixe em branco para calcular automaticamente (preço × viajantes)</span></label>
            <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="target" class="lucide-icon"></i></span>
              <input type="number" id="t-goal" class="form-control light" value="${v.arrecadationGoal||''}" min="0" step="0.01" placeholder="Meta total da viagem">
            </div>
          </div>
        </div>

        <div style="margin:.75rem 0;padding:.75rem 1rem;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
            <span style="font-size:.85rem;font-weight:700;color:var(--text)"><i data-lucide="bus" class="lucide-icon"></i> Ônibus</span>
            <button type="button" class="btn btn-outline btn-sm" onclick="addBusRow()">+ Adicionar Ônibus</button>
          </div>
          <div id="buses-list">${busesHtml}</div>
        </div>

        <div class="form-group dark-label">
          <label>Hotel (nome)</label>
          <div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="building-2" class="lucide-icon"></i></span>
            <input type="text" id="t-hotel" class="form-control light" value="${(v.hotels&&v.hotels[0])?v.hotels[0].name:''}" placeholder="Ex: Hotel Central">
          </div>
        </div>

        <div class="form-group dark-label">
          <label>Regras da Viagem</label>
          <textarea id="t-rules" class="form-control light" rows="5" placeholder="• Regra 1&#10;• Regra 2">${v.rules||''}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="closeCreateTrip()">Cancelar</button>
        <button class="btn btn-red" onclick="saveTrip()"><i data-lucide="save" class="lucide-icon"></i> Salvar Viagem</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  reInitIcons();
  window._busCount = buses.length;
}

function buildBusRow(b, i) {
  const f=b.floors||1;
  return `<div class="bus-row" data-bus="${b.id}" style="margin-bottom:.65rem;padding:.75rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
      <span style="font-size:.82rem;font-weight:700;color:var(--text)"><i data-lucide="bus" class="lucide-icon"></i> Ônibus ${i+1}</span>
      <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removeBusRow(this)"><i data-lucide="trash-2" class="lucide-icon"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <div>
        <label style="font-size:.72rem;color:var(--text-3);font-weight:600;display:block;margin-bottom:.25rem">Andares</label>
        <select class="form-control light bus-floors" style="font-size:.82rem" onchange="toggleBusFloor2(this)">
          <option value="1" ${f===1?'selected':''}>1 andar</option>
          <option value="2" ${f===2?'selected':''}>2 andares</option>
        </select>
      </div>
      <div>
        <label style="font-size:.72rem;color:var(--text-3);font-weight:600;display:block;margin-bottom:.25rem">Assentos — 1º Andar</label>
        <input type="number" class="form-control light bus-seats-f1" value="${b.seatsFloor1||b.seats||44}" min="2" max="100" style="font-size:.82rem">
      </div>
      <div class="bus-f2-row" style="grid-column:1/-1;display:${f===2?'block':'none'}">
        <label style="font-size:.72rem;color:var(--text-3);font-weight:600;display:block;margin-bottom:.25rem">Assentos — 2º Andar</label>
        <input type="number" class="form-control light bus-seats-f2" value="${b.seatsFloor2||0}" min="0" max="100" style="font-size:.82rem;max-width:180px">
      </div>
    </div>
  </div>`;
}

window.toggleBusFloor2 = function(sel) {
  const row=sel.closest('.bus-row');
  const f2=row?.querySelector('.bus-f2-row');
  if(f2) f2.style.display=sel.value==='2'?'block':'none';
};

window.addBusRow = function() {
  window._busCount = (window._busCount||1)+1;
  const el = document.getElementById('buses-list');
  el.insertAdjacentHTML('beforeend', buildBusRow({id:window._busCount,floors:1,seats:44}, window._busCount-1));
};
window.removeBusRow = function(btn) {
  const rows = document.querySelectorAll('.bus-row');
  if(rows.length<=1){ toast('A viagem precisa ter ao menos 1 ônibus.','wn'); return; }
  btn.closest('.bus-row').remove();
};
window.closeCreateTrip = function() {
  document.getElementById('create-trip-overlay')?.remove();
  document.body.style.overflow='';
  // Re-open trip selector for admin
  const s=S.get();
  if(s&&s.role==='admin') openAdminTripSelector();
};

window.saveTrip = async function() {
  const name  = document.getElementById('t-name').value.trim();
  const dep   = document.getElementById('t-dep').value.trim();
  const dest  = document.getElementById('t-dest').value.trim();
  const date  = document.getElementById('t-date').value;
  const time  = document.getElementById('t-time').value;
  if(!name||!dest||!date){ toast('Preencha nome, destino e data.','er'); return; }

  const busRows = document.querySelectorAll('.bus-row');
  const buses   = Array.from(busRows).map((row,i)=>{
    const floors=parseInt(row.querySelector('.bus-floors').value)||1;
    const sF1=parseInt(row.querySelector('.bus-seats-f1').value)||44;
    const sF2=floors===2?(parseInt(row.querySelector('.bus-seats-f2')?.value)||0):0;
    return{id:i+1, floors, seatsFloor1:sF1, seatsFloor2:sF2, seats:sF1+sF2};
  });

  const hotelName = document.getElementById('t-hotel').value.trim();
  const hotels    = hotelName ? [{id:1, name:hotelName, rooms:[]}] : [];

  const editId = document.getElementById('trip-edit-id').value;
  const trips  = DB.get('trips')||[];

  if(editId) {
    const idx = trips.findIndex(t=>t.id===editId);
    if(idx>=0){
      trips[idx] = {...trips[idx], name, departurePlace:dep, destination:dest,
        date, departureTime:time, maxPeople:parseInt(document.getElementById('t-max').value)||44,
        price:parseFloat(document.getElementById('t-price').value)||0,
        buses, hotels, rules:document.getElementById('t-rules').value };
    }
    toast('Viagem atualizada!','ok');
  } else {
    const id = 'trip_'+Date.now();
    trips.push({ id, name, departurePlace:dep, destination:dest,
      date, departureTime:time, maxPeople:parseInt(document.getElementById('t-max').value)||44,
      price:parseFloat(document.getElementById('t-price').value)||0,
      buses, hotels:[], rules:document.getElementById('t-rules').value,
      travelers:[] });
    S.setTrip(id);
    toast('Viagem criada!','ok');
  }
  await DB.set('trips', trips);
  await DB.flush();
  document.getElementById('create-trip-overlay')?.remove();
  document.body.style.overflow='';
  location.href='dashboard-admin.html';
};

/* ════════════════════════════════════════════
   ADMIN TRIP SELECTOR
════════════════════════════════════════════ */
// openAdminTripSelector is now window.openAdminTripSelector (defined in new trip sel block)
function _legacy_openAdminTripSelector() {
  const trips = DB.get('trips')||[];
  showTripSelector(trips, id=>{ location.href='dashboard-admin.html'; }, true);

  // Add edit/delete buttons after rendering
  setTimeout(()=>{
    document.querySelectorAll('.trip-card').forEach(card=>{
      const id = card.dataset.id;
      const btns = document.createElement('div');
      btns.style.cssText='display:flex;gap:.35rem;flex-shrink:0';
      btns.innerHTML=`
        <button class="btn btn-outline btn-sm btn-icon" title="Editar"
          onclick="event.stopPropagation();openCreateTrip('${id}')"><i data-lucide="pencil" class="lucide-icon"></i></button>
        <button class="btn btn-danger btn-sm btn-icon" title="Excluir"
          onclick="event.stopPropagation();deleteTrip('${id}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>`;
      card.appendChild(btns);
    });
  }, 50);
}

window.deleteTrip = function(id) {
  if(!confirm('Excluir esta viagem? Todos os dados serão perdidos.')) return;
  DB.set('trips', (DB.get('trips')||[]).filter(t=>t.id!==id));
  // Clean related data
  const seats = DB.get('seats')||{};
  Object.keys(seats).filter(k=>k.startsWith(id+'_')).forEach(k=>delete seats[k]);
  DB.set('seats', seats);
  const rooms = DB.get('rooms')||{};
  delete rooms[id]; DB.set('rooms', rooms);
  DB.set('payments', (DB.get('payments')||[]).filter(p=>p.tripId!==id));
  if(S.getTrip()===id) S.clearTrip();
  toast('Viagem excluída.','ok');
  openAdminTripSelector();
};

/* ════════════════════════════════════════════
   PAGE: LOGIN
════════════════════════════════════════════ */
function initLogin() {
  const form = document.getElementById('login-form');
  if(!form) return;
  const cpfEl = document.getElementById('login-cpf');
  bindCPF(cpfEl, document.getElementById('cpf-fb'));

  document.querySelector('.toggle-pw')?.addEventListener('click', function(){
    const pw=document.getElementById('login-pw');
    pw.type=pw.type==='password'?'text':'password';
    this.innerHTML=pw.type==='password'?'<i data-lucide="eye" class="lucide-icon"></i>':'<i data-lucide="eye-off" class="lucide-icon"></i>';
    if(window.lucide) lucide.createIcons();
  });

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const raw = CPF.strip(cpfEl.value);
    const pw  = document.getElementById('login-pw').value;

    if(!CPF.valid(raw)){ toast('CPF inválido.','er'); return; }

    try {
      const userApi = await API.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ cpf: raw, password: pw })
      });

      await DB.load();
      const users = DB.get('users') || [];
      const userFromState = users.find(u => u.cpf === raw);
      const user = {
        ...(userFromState || {}),
        cpf: userApi.cpf || raw,
        name: userApi.name || userFromState?.name || 'Usuário',
        password: userApi.password || pw,
        role: (userApi.role || userFromState?.role || 'traveler').toLowerCase(),
        married: userApi.married || false,
        spouseName: userApi.spouseName || '',
        hasKids: userApi.hasKids || false,
        kids: userApi.kids || [],
        firstLogin: Boolean(userApi.firstLogin ?? userFromState?.firstLogin ?? false)
      };

      if(user.firstLogin){
        S.set(user); openM('first-login-modal'); return;
      }

      S.set(user);
      toast(`Bem-vindo(a), ${user.name.split(' ')[0]}!`,'ok',1600);

      setTimeout(()=>{
        if(user.role==='admin'){
          openAdminTripSelector();
        } else {
          const myTrips = getUserTrips(user.cpf);
          showTravelerTripSelector(myTrips, ()=>{ location.href='dashboard-viajante.html'; });
        }
      }, 600);

    } catch (error) {
      toast(error.message || 'CPF ou senha incorretos.', 'er');
    }
  });

  document.getElementById('first-login-form')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const np=document.getElementById('new-pw').value;
    const cp=document.getElementById('confirm-pw').value;
    if(np.length<6){ toast('Senha deve ter ao menos 6 caracteres.','er'); return; }
    if(np!==cp){ toast('As senhas não coincidem.','er'); return; }
    const s=S.get(); const us=DB.get('users')||[];
    const idx=us.findIndex(u=>u.cpf===s.cpf);
    if(idx>=0){ us[idx].password=np; us[idx].firstLogin=false; await DB.set('users',us); }
    s.password=np; s.firstLogin=false; S.set(s);
    closeM('first-login-modal');
    toast('Senha criada! Redirecionando...','ok');
    setTimeout(()=>{
      if(s.role === 'admin'){
        openAdminTripSelector();
      } else {
        const myTrips=getUserTrips(s.cpf);
        showTravelerTripSelector(myTrips, ()=>{ location.href='dashboard-viajante.html'; });
      }
    }, 900);
  });
}

/* ════════════════════════════════════════════
   PAGE: DASHBOARD ADMIN
════════════════════════════════════════════ */
function initAdminDash() {
  if(!guard('admin')) return;
  const tripId = S.getTrip();
  if(!tripId){ openAdminTripSelector(); return; }
  const trip = getTrip(tripId);
  if(!trip){ S.clearTrip(); openAdminTripSelector(); return; }

  fillSB(); buildAdminSidebar('dash');
  $('pg-trip-name', trip.name);
  $('sb-name-banner', S.get()?.name?.split(' ')[0]||'Admin');

  renderAdminStats(trip);
  renderCharts(trip);
  renderRecentTable(trip);
}

function renderAdminStats(trip) {
  const travelers = (trip.travelers||[]);
  const ps = (DB.get('payments')||[]).filter(p=>p.tripId===trip.id);
  const pending = ps.reduce((a,p)=>a+Object.values(p.receipts||{}).filter(r=>r.status==='pending').length,0);
  const seats   = DB.get('seats')||{};
  let taken=0;
  (trip.buses||[]).forEach(b=>{ const bmap=seats[`${trip.id}_${b.id}`]||{}; taken+=Object.values(bmap).flat().length; });
  const totalSeats = (trip.buses||[]).reduce((a,b)=>a+b.seats,0);

  $('stat-travelers', travelers.length);
  $('stat-price',     fmt(trip.price));
  $('stat-seats',     `${taken}/${totalSeats}`);
  $('stat-pending',   pending);
  $('dash-trip-dest', trip.destination||'—');
  $('dash-trip-date', fmtD(trip.date));
}

function renderCharts(trip) {
  const ps = (DB.get('payments')||[]).filter(p=>p.tripId===trip.id);
  let paid=0,pend=0;
  ps.forEach(p=>{ paid+=p.paidInstallments; pend+=(p.totalInstallments-p.paidInstallments); });
  drawPie('chart-pay',[{label:'Pagas',value:paid,color:'#00B894'},{label:'Pendentes',value:pend,color:'#F5A623'}]);

  const seats=DB.get('seats')||{};
  let taken=0; const totalSeats=(trip.buses||[]).reduce((a,b)=>a+b.seats,0);
  (trip.buses||[]).forEach(b=>{ const bmap=seats[`${trip.id}_${b.id}`]||{}; taken+=Object.values(bmap).flat().length; });
  drawPie('chart-bus',[{label:'Ocupados',value:taken,color:'#E8192C'},{label:'Livres',value:totalSeats-taken,color:'#00B894'}]);

  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));
  const bdata=users.map(u=>{ const p=ps.find(x=>x.cpf===u.cpf); return{name:u.name.split(' ')[0],paid:p?p.paidInstallments:0,total:p?p.totalInstallments:0}; });
  drawBars('chart-bars',bdata);
}

function drawPie(id, slices) {
  const c=document.getElementById(id); if(!c) return;
  const ctx=c.getContext('2d');
  const W=c.width=c.parentElement?.offsetWidth||200, H=c.height=220;
  const cx=W/2, cy=H/2-12, R=Math.min(cx,cy)-28;
  const total=slices.reduce((a,s)=>a+s.value,0);
  ctx.clearRect(0,0,W,H);
  if(!total){
    ctx.fillStyle='#E2E8F0'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#94A3B8'; ctx.font='12px Sora'; ctx.textAlign='center'; ctx.fillText('Sem dados',cx,cy+4); return;
  }
  let angle=-Math.PI/2;
  slices.forEach(s=>{
    const sw=(s.value/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,angle,angle+sw); ctx.closePath();
    ctx.fillStyle=s.color; ctx.fill();
    if(sw>0.28){ const mx=angle+sw/2; ctx.fillStyle='#fff'; ctx.font='bold 12px Sora'; ctx.textAlign='center'; ctx.fillText(s.value,cx+R*.62*Math.cos(mx),cy+R*.62*Math.sin(mx)+4); }
    angle+=sw;
  });
  ctx.beginPath(); ctx.arc(cx,cy,R*.42,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
  let lx=12;
  slices.forEach(s=>{
    ctx.fillStyle=s.color; if(ctx.roundRect){ctx.beginPath();ctx.roundRect(lx,H-18,10,10,3);ctx.fill();}else{ctx.fillRect(lx,H-18,10,10);}
    ctx.fillStyle='#4A5568'; ctx.font='10px Sora'; ctx.textAlign='left'; ctx.fillText(`${s.label} (${s.value})`,lx+14,H-10);
    lx+=ctx.measureText(`${s.label} (${s.value})`).width+32;
  });
}

function drawBars(id, data) {
  const c=document.getElementById(id); if(!c) return;
  const ctx=c.getContext('2d');
  const W=c.width=c.parentElement?.offsetWidth||400, H=c.height=220;
  ctx.clearRect(0,0,W,H);
  if(!data.length) return;
  const pad={t:20,b:44,l:10,r:10};
  const bw=(W-pad.l-pad.r)/data.length;
  const maxV=Math.max(...data.map(d=>d.total),1);
  const ch=H-pad.t-pad.b;
  data.forEach((d,i)=>{
    const x=pad.l+i*bw;
    const tH=(d.total/maxV)*ch; const pH=(d.paid/maxV)*ch;
    ctx.fillStyle='#E2E8F0';
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x+bw*.18,H-pad.b-tH,bw*.64,tH,4);ctx.fill();}else{ctx.fillRect(x+bw*.18,H-pad.b-tH,bw*.64,tH);}
    ctx.fillStyle='#00B894';
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x+bw*.18,H-pad.b-pH,bw*.64,pH,4);ctx.fill();}else{ctx.fillRect(x+bw*.18,H-pad.b-pH,bw*.64,pH);}
    ctx.fillStyle='#94A3B8'; ctx.font='10px Sora'; ctx.textAlign='center'; ctx.fillText(d.name,x+bw/2,H-pad.b+16);
    if(tH>18){ctx.fillStyle='#0B1F3A'; ctx.font='bold 10px Sora'; ctx.fillText(`${d.paid}/${d.total}`,x+bw/2,H-pad.b-tH-4);}
  });
}

function renderRecentTable(trip) {
  const tbody=document.getElementById('dash-tbody'); if(!tbody) return;
  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));
  const ps=(DB.get('payments')||[]).filter(p=>p.tripId===trip.id);
  tbody.innerHTML=users.map(u=>{
    const p=ps.find(x=>x.cpf===u.cpf);
    const pct=p?Math.round((p.paidInstallments/p.totalInstallments)*100):0;
    return`<tr>
      <td><div class="flex ic g1"><div class="ava">${u.name.charAt(0)}</div><span>${u.name}</span></div></td>
      <td>${CPF.format(u.cpf)}</td>
      <td><span class="badge ${pct===100?'b-green':pct>0?'b-gold':'b-red'}">${pct}% pago</span></td>
      <td>${p?`${p.paidInstallments}/${p.totalInstallments}`:'—'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewTraveler('${u.cpf}')"><i data-lucide="eye" class="lucide-icon"></i> Ver</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="5" class="tc tm">Nenhum viajante nesta viagem</td></tr>';
}

/* ════════════════════════════════════════════
   PAGE: DASHBOARD VIAJANTE — ticket digital
════════════════════════════════════════════ */
function initTravelerDash() {
  if(!guard('traveler')) return;
  const s      = S.get();
  const tripId = S.getTrip();

  if(!tripId){
    const myTrips=getUserTrips(s.cpf);
    if(!myTrips.length){ showTripSelector([],null,false); return; }
    if(myTrips.length===1){ S.setTrip(myTrips[0].id); location.reload(); return; }
    showTripSelector(myTrips, ()=>location.reload(), false); return;
  }

  const trip = getTrip(tripId);
  if(!trip){ S.clearTrip(); location.reload(); return; }

  fillSB(); buildTravelerSidebar('dash');

  // Fill ticket
  $('tk-name',    s.name);
  $('tk-from',    trip.departurePlace||'—');
  $('tk-to',      trip.destination||'—');
  $('tk-date',    fmtD(trip.date));
  $('tk-time',    trip.departureTime||'—');
  $('tk-tripname',trip.name);
  // IATA-style abbreviations
  const abbr = str => (str||'').replace(/[^A-Za-zÀ-ú]/g,' ').trim().split(/\s+/).map(w=>w[0]?.toUpperCase()||'').join('').slice(0,3)||'---';
  $('tk-from-iata', abbr(trip.departurePlace));
  $('tk-to-iata',   abbr(trip.destination));
  $('tk-tripname-brand', trip.name);
  $('tk-tripname-foot',  trip.name);

  // Seat
  const seatInfo = getUserSeat(s.cpf, tripId);
  $('tk-seat', seatInfo ? `Ônibus ${seatInfo.bus} — Assento(s) ${seatInfo.seats.join(', ')}` : 'Não atribuído');

  // Room
  const roomId = getUserRoom(s.cpf, tripId);
  if(roomId) {
    const hotel  = (trip.hotels||[])[0];
    const room   = hotel ? (hotel.rooms||[]).find(r=>String(r.id)===String(roomId)) : null;
    const mates  = getRoommates(s.cpf, tripId, roomId);
    $('tk-room',      room ? `Quarto ${room.id}${room.type?' — '+(room.type==='single'?'Individual':room.type==='double'?'Duplo':'Familiar'):''}` : `Quarto ${roomId}`);
    $('tk-roommates', mates.length ? mates.join(', ') : 'Quarto individual');
  } else {
    $('tk-room',      'Não atribuído');
    $('tk-roommates', '—');
  }

  // Payment
  const ps = (DB.get('payments')||[]).filter(p=>p.tripId===tripId);
  const p  = ps.find(x=>x.cpf===s.cpf);
  if(p) {
    const pct = Math.round((p.paidInstallments/p.totalInstallments)*100);
    const label = pct===100?'Confirmado':`${pct}% pago`;
    const el=document.getElementById('tk-pay-badge');
    if(el){ el.className=`badge ${pct===100?'b-green':'b-gold'}`; el.textContent=label; }
    $('tk-pay-text', label);
  } else {
    const el=document.getElementById('tk-pay-badge');
    if(el){ el.className='badge b-red'; el.textContent='Pendente'; }
    $('tk-pay-text', 'Pendente — configure na aba Pagamento');
  }

  // Rules
  const rulesEl=document.getElementById('trip-rules');
  if(rulesEl) rulesEl.innerHTML=trip.rules?trip.rules.replace(/\n/g,'<br>'):'<span class="tm">Nenhuma regra cadastrada.</span>';
}

window.downloadTicketPDF = function() {
  const s      = S.get();
  const tripId = S.getTrip();
  const trip   = getTrip(tripId);
  if(!trip||!s){ toast('Dados insuficientes para gerar PDF.','er'); return; }

  const seatInfo = getUserSeat(s.cpf, tripId);
  const roomId   = getUserRoom(s.cpf, tripId);
  const ps       = (DB.get('payments')||[]).filter(p=>p.tripId===tripId);
  const p        = ps.find(x=>x.cpf===s.cpf);
  const pct      = p?Math.round((p.paidInstallments/p.totalInstallments)*100):0;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Passagem — ${s.name}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;background:#f0f4f8;display:flex;justify-content:center;padding:2rem}
    .ticket{background:#fff;border-radius:16px;overflow:hidden;width:600px;box-shadow:0 8px 32px rgba(0,0,0,.12)}
    .tk-top{background:linear-gradient(135deg,#0B1F3A,#1A3560);padding:2rem;color:#fff}
    .tk-logo{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.25rem}
    .tk-sub{font-size:.82rem;opacity:.5;text-transform:uppercase;letter-spacing:.08em}
    .tk-route{display:flex;align-items:center;gap:1rem;margin-top:1.5rem}
    .tk-city{flex:1}.tk-city-name{font-size:1.5rem;font-weight:700}.tk-city-label{font-size:.72rem;opacity:.5;margin-top:.2rem}
    .tk-arrow{font-size:2rem;opacity:.5}
    .tk-body{padding:2rem}
    .tk-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}
    .tk-field label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8}
    .tk-field p{font-size:.96rem;font-weight:600;color:#0B1F3A;margin-top:.25rem}
    .tk-div{border-top:2px dashed #E2E8F0;margin:1.5rem 0}
    .tk-status{display:inline-block;padding:.35rem .9rem;border-radius:99px;font-size:.8rem;font-weight:700;
      background:${pct===100?'#d1fae5':'#fef3dc'};color:${pct===100?'#065f46':'#7a4e00'}}
    .tk-bar{height:8px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin-top:.5rem}
    .tk-bar-fill{height:100%;background:linear-gradient(90deg,#00B894,#4fd1b0);width:${pct}%;border-radius:99px}
    .tk-footer{background:#F4F6FA;padding:1rem 2rem;font-size:.72rem;color:#94A3B8;text-align:center}
  </style></head><body>
  <div class="ticket">
    <div class="tk-top">
      <div class="tk-logo">Igreja Viagens</div>
      <div class="tk-sub">Passagem Digital — ${trip.name}</div>
      <div class="tk-route">
        <div class="tk-city"><div class="tk-city-name">${(trip.departurePlace||'—').split(' ')[0]}</div><div class="tk-city-label">${trip.departurePlace||'—'}</div></div>
        <div class="tk-arrow">→</div>
        <div class="tk-city"><div class="tk-city-name">${(trip.destination||'—').split(' ')[0]}</div><div class="tk-city-label">${trip.destination||'—'}</div></div>
      </div>
    </div>
    <div class="tk-body">
      <div class="tk-grid">
        <div class="tk-field"><label>Viajante</label><p>${s.name}</p></div>
        <div class="tk-field"><label>CPF</label><p>${CPF.format(s.cpf)}</p></div>
        <div class="tk-field"><label>Data</label><p>${fmtD(trip.date)}</p></div>
        <div class="tk-field"><label>Hora de Partida</label><p>${trip.departureTime||'—'}</p></div>
        <div class="tk-field"><label>Assento</label><p>${seatInfo?`Ônibus ${seatInfo.bus} — ${seatInfo.seats.join(', ')}`:'Não atribuído'}</p></div>
        <div class="tk-field"><label>Quarto</label><p>${roomId?`Quarto ${roomId}`:'Não atribuído'}</p></div>
      </div>
      <div class="tk-div"></div>
      <div class="tk-field"><label>Status do Pagamento</label>
        <div style="margin-top:.4rem"><span class="tk-status">${pct===100?'Confirmado':`${pct}% pago`}</span></div>
        <div class="tk-bar" style="margin-top:.75rem"><div class="tk-bar-fill"></div></div>
      </div>
    </div>
    <div class="tk-footer">Gerado em ${new Date().toLocaleString('pt-BR')} — Igreja Viagens Sistema</div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`;

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
};

/* ════════════════════════════════════════════
   PAGE: VIAJANTES (CRUD completo)
════════════════════════════════════════════ */
function initViajantes() {
  if(!guard('admin')) return;
  const tripId = S.getTrip();
  if(!tripId){ openAdminTripSelector(); return; }
  fillSB(); buildAdminSidebar('viaj');
  $('pg-trip-name', getTrip(tripId)?.name||'');
  renderTravTable();

  document.getElementById('add-btn')?.addEventListener('click',()=>openAddTravelerToTrip());
  const cpfNew=document.getElementById('nt-cpf');
  if(cpfNew) bindCPF(cpfNew, document.getElementById('nt-cpf-fb'));

  document.getElementById('nt-married')?.addEventListener('change',function(){
    document.getElementById('spouse-sec').classList.toggle('gone',!this.checked);
  });
  document.getElementById('nt-kids')?.addEventListener('change',function(){
    document.getElementById('kids-sec').classList.toggle('gone',!this.checked);
  });
  document.getElementById('nt-kids-qty')?.addEventListener('input',function(){
    const c=document.getElementById('kids-names'); c.innerHTML='';
    for(let i=1;i<=Math.min(parseInt(this.value)||0,10);i++){
      c.innerHTML+=`<div class="form-group dark-label"><label>Nome do filho ${i}</label><div class="inp-wrap"><span class="inp-icon dark"><i data-lucide="baby" class="lucide-icon"></i></span><input type="text" id="kid-${i}" class="form-control light" placeholder="Nome do filho ${i}"></div></div>`;
    }
  });

  document.getElementById('add-form')?.addEventListener('submit', e=>{ e.preventDefault(); saveTraveler(); });
}

function openTravelerModal(cpf) {
  const u = cpf ? (DB.get('users')||[]).find(x=>x.cpf===cpf) : null;
  // Fill form fields
  const sv=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  sv('nt-name',  u?u.name:'');
  sv('nt-cpf',   u?CPF.format(u.cpf):'');
  sv('nt-birth', u?u.birthdate:'');
  const cpfEl = document.getElementById('nt-cpf');
  if(cpfEl) cpfEl.readOnly = !!u; // can't change CPF on edit

  const marEl=document.getElementById('nt-married');
  if(marEl){ marEl.checked=u?u.married:false; document.getElementById('spouse-sec')?.classList.toggle('gone',!marEl.checked); }
  sv('nt-spouse', u?u.spouseName:'');

  const kidsEl=document.getElementById('nt-kids');
  if(kidsEl){ kidsEl.checked=u?u.hasKids:false; document.getElementById('kids-sec')?.classList.toggle('gone',!kidsEl.checked); }
  const qtyEl=document.getElementById('nt-kids-qty');
  if(qtyEl){ qtyEl.value=u&&u.kids?u.kids.length:0; qtyEl.dispatchEvent(new Event('input')); }
  setTimeout(()=>{ if(u&&u.kids){ u.kids.forEach((k,i)=>{ const el=document.getElementById(`kid-${i+1}`); if(el) el.value=k; }); } },50);

  document.getElementById('modal-trav-title').innerHTML = u?'<i data-lucide="pencil" class="lucide-icon"></i> Editar Viajante':'<i data-lucide="plus" class="lucide-icon"></i> Cadastrar Viajante';if(window.lucide)lucide.createIcons();
  document.getElementById('trav-edit-cpf').value = cpf||'';
  document.getElementById('add-modal-trip').value = S.getTrip();
  openM('add-modal');
}

function saveTraveler() {
  const editCpf = document.getElementById('trav-edit-cpf').value;
  const tripId  = document.getElementById('add-modal-trip').value;
  const name    = document.getElementById('nt-name').value.trim();
  if(!name){ toast('Preencha o nome.','er'); return; }

  const cpf = editCpf || CPF.strip(document.getElementById('nt-cpf').value);

  if(!editCpf){
    if(!CPF.valid(cpf)){ toast('CPF inválido.','er'); return; }
    const users=DB.get('users')||[];
    if(users.find(u=>u.cpf===cpf)){ toast('CPF já cadastrado.','er'); return; }
  }

  const hasKids = document.getElementById('nt-kids')?.checked||false;
  const qty     = parseInt(document.getElementById('nt-kids-qty')?.value)||0;
  const kids    = [];
  for(let i=1;i<=qty;i++){ const n=document.getElementById(`kid-${i}`)?.value?.trim(); if(n) kids.push(n); }

  const users = DB.get('users')||[];
  if(editCpf){
    const idx=users.findIndex(u=>u.cpf===editCpf);
    if(idx>=0){ users[idx]={...users[idx], name, birthdate:document.getElementById('nt-birth').value||'',
      married:document.getElementById('nt-married')?.checked||false,
      spouseName:document.getElementById('nt-spouse')?.value?.trim()||'',
      hasKids, kids }; }
    DB.set('users',users);
    toast(`${name} atualizado!`,'ok');
  } else {
    users.push({ cpf, password:'acess@123', role:'traveler', firstLogin:true,
      name, birthdate:document.getElementById('nt-birth').value||'',
      married:document.getElementById('nt-married')?.checked||false,
      spouseName:document.getElementById('nt-spouse')?.value?.trim()||'',
      hasKids, kids });
    DB.set('users',users);
    // Assign to trip
    const trips=DB.get('trips')||[];
    const ti=trips.findIndex(t=>t.id===tripId);
    if(ti>=0&&!(trips[ti].travelers||[]).includes(cpf)){ trips[ti].travelers=[...(trips[ti].travelers||[]),cpf]; DB.set('trips',trips); }
    // Create payment record placeholder
    const ps=DB.get('payments')||[];
    if(!ps.find(p=>p.cpf===cpf&&p.tripId===tripId)){
      ps.push({cpf,tripId,totalInstallments:1,dueDay:10,paidInstallments:0,locked:false,receipts:{}});
      DB.set('payments',ps);
    }
    toast(`${name} cadastrado! Login: ${CPF.format(cpf)} / acess@123`,'ok',5000);
  }

  closeM('add-modal');
  document.getElementById('add-form').reset();
  document.getElementById('spouse-sec')?.classList.add('gone');
  document.getElementById('kids-sec')?.classList.add('gone');
  document.getElementById('trav-edit-cpf').value='';
  renderTravTable();
}


/* ════════════════════════════════════════════
   Add traveler to trip (from global registry)
════════════════════════════════════════════ */
window.openAddTravelerToTrip = function() {
  const tripId=S.getTrip(); const trip=getTrip(tripId); if(!trip) return;
  document.getElementById('add-to-trip-overlay')?.remove();
  const allUsers=(DB.get('users')||[]).filter(u=>u.role==='traveler');
  const inTrip=trip.travelers||[];
  const available=allUsers.filter(u=>!inTrip.includes(u.cpf));
  const ov=document.createElement('div'); ov.className='overlay on'; ov.id='add-to-trip-overlay';
  const rows=available.map(u=>`
    <div onclick="addUserToTrip('${u.cpf}')"
      style="cursor:pointer;display:flex;align-items:center;gap:.75rem;padding:.8rem 1rem;
      border:1.5px solid var(--border);border-radius:var(--r-sm);transition:all .2s;background:var(--surface)"
      onmouseover="this.style.borderColor='var(--red)';this.style.background='rgba(232,25,44,.03)'"
      onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
      <div class="ava">${u.name.charAt(0)}</div>
      <div style="flex:1">
        <div class="fw6" style="font-size:.88rem">${u.name}</div>
        <div class="tm" style="font-size:.72rem">${CPF.format(u.cpf)}
          ${u.married&&u.spouseName?` · <i data-lucide="heart" class="lucide-icon"></i> ${u.spouseName}`:''}
          ${u.hasKids&&u.kids?.length?` · <i data-lucide="baby" class="lucide-icon"></i> ${u.kids.join(', ')}`:``}
        </div>
      </div>
      <span style="color:var(--red);font-size:.82rem;font-weight:600">+ Adicionar</span>
    </div>`).join('');
  ov.innerHTML=`
    <div class="modal" style="max-width:500px">
      <div class="modal-head">
        <div>
          <div class="modal-title"><i data-lucide="plus" class="lucide-icon"></i> Adicionar à Viagem</div>
          <div style="font-size:.76rem;color:var(--text-3);margin-top:.18rem">Selecione viajantes já cadastrados no sistema</div>
        </div>
        <button class="modal-x" onclick="document.getElementById('add-to-trip-overlay').remove();document.body.style.overflow=''"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.5rem;max-height:55vh;overflow-y:auto">
        ${rows||`<div class="alert al-sky"><span class="al-ico"><i data-lucide="info" class="lucide-icon"></i></span><span>
          Todos os viajantes cadastrados já estão nesta viagem, ou não há cadastros ainda.<br><br>
          <button onclick="document.getElementById('add-to-trip-overlay').remove();document.body.style.overflow='';openGlobalCadastros()" class="btn btn-outline btn-sm" style="margin-top:.5rem">
            <i data-lucide="folder-open" class="lucide-icon"></i> Cadastrar Novo Viajante no Sistema
          </button>
        </span></div>`}
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('add-to-trip-overlay').remove();document.body.style.overflow=''">Fechar</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('add-to-trip-overlay').remove();document.body.style.overflow='';openGlobalCadastros()"><i data-lucide="folder-open" class="lucide-icon"></i> Ir aos Cadastros</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.addUserToTrip = function(cpf) {
  const tripId=S.getTrip();
  const trips=DB.get('trips')||[]; const ti=trips.findIndex(t=>t.id===tripId); if(ti<0) return;
  if(!(trips[ti].travelers||[]).includes(cpf)){
    trips[ti].travelers=[...(trips[ti].travelers||[]),cpf]; DB.set('trips',trips);
  }
  const ps=DB.get('payments')||[];
  if(!ps.find(p=>p.cpf===cpf&&p.tripId===tripId)){
    ps.push({cpf,tripId,totalInstallments:1,dueDay:10,paidInstallments:0,locked:false,receipts:{}}); DB.set('payments',ps);
  }
  const u=(DB.get('users')||[]).find(x=>x.cpf===cpf);
  toast(`${u?.name||cpf} adicionado à viagem!`,'ok');
  document.getElementById('add-to-trip-overlay')?.remove(); document.body.style.overflow='';
  renderTravTable();
};

function renderTravTable(filter='') {
  const tbody=document.getElementById('trav-tbody'); if(!tbody) return;
  const tripId=S.getTrip();
  const trip=getTrip(tripId);
  const travCpfs=(trip?.travelers||[]);
  let users=(DB.get('users')||[]).filter(u=>travCpfs.includes(u.cpf));
  if(filter) users=users.filter(u=>u.name.toLowerCase().includes(filter)||u.cpf.includes(filter));
  const ps=(DB.get('payments')||[]).filter(p=>p.tripId===tripId);
  tbody.innerHTML=users.map(u=>{
    const p=ps.find(x=>x.cpf===u.cpf);
    const pct=p?Math.round((p.paidInstallments/p.totalInstallments)*100):0;
    const pr=p?Object.values(p.receipts||{}).filter(r=>r.status==='pending').length:0;
    return`<tr>
      <td><div class="flex ic g1"><div class="ava">${u.name.charAt(0)}</div><div><div class="fw6">${u.name}</div><div class="tm">${CPF.format(u.cpf)}</div></div></div></td>
      <td>${fmtD(u.birthdate)}</td>
      <td>${u.married?'<i data-lucide="heart" class="lucide-icon"></i> '+u.spouse:'—'}</td>
      <td>${u.hasKids?'<i data-lucide="baby" class="lucide-icon"></i> '+(u.kids||[]).length+' filho(s)':'—'}</td>
      <td><span class="badge ${pct===100?'b-green':pct>0?'b-gold':'b-red'}">${pct}%</span></td>
      <td>${pr>0?`<span class="badge b-gold"><i data-lucide="hourglass" class="lucide-icon"></i> ${pr}</span>`:`<span class="badge b-muted">—</span>`}</td>
      <td><div class="flex g1">
        <button class="btn btn-outline btn-sm" onclick="openTravelerModal('${u.cpf}')"><i data-lucide="pencil" class="lucide-icon"></i></button>
        <button class="btn btn-outline btn-sm" onclick="viewTraveler('${u.cpf}')"><i data-lucide="eye" class="lucide-icon"></i></button>
        <button class="btn btn-danger btn-sm" onclick="delTraveler('${u.cpf}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>
      </div></td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" class="tc tm" style="padding:2rem">Nenhum viajante nesta viagem</td></tr>';
  reInitIcons();
}

function searchTrav(){ renderTravTable((document.getElementById('search-trav')?.value||'').toLowerCase()); }

function viewTraveler(cpf) {
  const tripId=S.getTrip();
  const users=DB.get('users')||[];
  const u=users.find(x=>x.cpf===cpf); if(!u) return;
  const ps=(DB.get('payments')||[]).filter(p=>p.tripId===tripId);
  const p=ps.find(x=>x.cpf===cpf)||{totalInstallments:0,paidInstallments:0,receipts:{}};
  const seatInfo=getUserSeat(cpf,tripId);
  const roomId=getUserRoom(cpf,tripId);
  const el=document.getElementById('detail-content');
  if(el){
    el.innerHTML=`
    <div class="g2" style="gap:.85rem;margin-bottom:1.25rem">
      <div><p class="tm">Nome</p><p class="fw6 mt1">${u.name}</p></div>
      <div><p class="tm">CPF</p><p class="fw6 mt1">${CPF.format(u.cpf)}</p></div>
      <div><p class="tm">Nascimento</p><p class="fw6 mt1">${fmtD(u.birthdate)}</p></div>
      <div><p class="tm">Estado Civil</p><p class="fw6 mt1">${u.married?'Casado(a) com '+u.spouse:'Solteiro(a)'}</p></div>
      <div><p class="tm">Filhos</p><p class="fw6 mt1">${u.hasKids?(u.kids||[]).join(', '):'Nenhum'}</p></div>
      <div><p class="tm">Assento</p><p class="fw6 mt1">${seatInfo?`Ônibus ${seatInfo.bus} — ${seatInfo.seats.join(', ')}`:'—'}</p></div>
      <div><p class="tm">Quarto</p><p class="fw6 mt1">${roomId?`Quarto ${roomId}`:'—'}</p></div>
      <div><p class="tm">Pagamento</p><p class="fw6 mt1">${p.paidInstallments}/${p.totalInstallments} parcelas</p></div>
    </div>
    <div><p class="tm mb1">Comprovantes enviados</p>${buildReceiptHTML(p.receipts,cpf)}</div>`;
  }
  openM('detail-modal');
}

function delTraveler(cpf) {
  if(!confirm('Remover viajante desta viagem?')) return;
  const tripId=S.getTrip();
  const trips=DB.get('trips')||[];
  const ti=trips.findIndex(t=>t.id===tripId);
  if(ti>=0){ trips[ti].travelers=(trips[ti].travelers||[]).filter(c=>c!==cpf); DB.set('trips',trips); }
  // Clean seats
  const seats=DB.get('seats')||{};
  Object.keys(seats).filter(k=>k.startsWith(tripId+'_')).forEach(k=>{ delete seats[k][cpf]; });
  DB.set('seats',seats);
  // Clean rooms
  const rooms=DB.get('rooms')||{};
  const tr=rooms[tripId]||{};
  Object.keys(tr).forEach(r=>{ tr[r]=(tr[r]||[]).filter(c=>c!==cpf); });
  rooms[tripId]=tr; DB.set('rooms',rooms);
  toast('Viajante removido da viagem.','ok');
  renderTravTable();
}

/* ════════════════════════════════════════════
   RECEIPTS
════════════════════════════════════════════ */
function buildReceiptHTML(receipts, cpf){
  const entries=Object.entries(receipts||{});
  if(!entries.length) return '<p class="tm" style="padding:.5rem 0">Nenhum comprovante enviado.</p>';
  return entries.map(([k,r])=>{
    const isPdf=r.type&&r.type.includes('pdf');
    const hasData=!!r.data;
    let thumb='';
    if(hasData&&!isPdf){
      thumb=`<img src="${r.data}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border);flex-shrink:0" onclick="openReceiptViewer('${cpf}','${k}')">`;
    } else if(hasData&&isPdf){
      thumb=`<div style="width:64px;height:64px;border-radius:8px;background:rgba(232,25,44,.08);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;cursor:pointer" onclick="openReceiptViewer('${cpf}','${k}')"><i data-lucide="file-text" class="lucide-icon" style="width:1.5rem;height:1.5rem"></i></div>`;
    } else {
      thumb=`<div style="width:64px;height:64px;border-radius:8px;background:var(--gold-light);border:2px dashed var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="image" class="lucide-icon" style="width:1.5rem;height:1.5rem"></i></div>`;
    }
    return `
    <div style="display:flex;align-items:center;gap:.85rem;padding:.85rem;border:1.5px solid var(--border);border-radius:var(--r-sm);background:var(--surface);margin-bottom:.5rem;flex-wrap:wrap">
      <span class="parcel-n ${r.status==='approved'?'p':'w'}" style="flex-shrink:0">${k}</span>
      ${thumb}
      <div style="flex:1;min-width:120px">
        <p style="font-size:.86rem;font-weight:600;color:var(--text)">Parcela ${k}</p>
        <p style="font-size:.76rem;color:var(--text-3);margin-top:.15rem">${r.date||''}</p>
        <p style="font-size:.72rem;color:var(--text-3);word-break:break-all">${r.filename||''}</p>
        ${!hasData?`<p style="font-size:.72rem;color:#a36c00;font-weight:600;margin-top:.2rem"><i data-lucide="alert-triangle" class="lucide-icon"></i> Peça reenvio</p>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:.35rem;align-items:flex-end;flex-shrink:0">
        <span class="badge ${r.status==='approved'?'b-green':r.status==='rejected'?'b-red':'b-gold'}">${r.status==='approved'?'<i data-lucide="check-circle" class="lucide-icon"></i> Aprovado':r.status==='rejected'?'<i data-lucide="x-circle" class="lucide-icon"></i> Recusado':'<i data-lucide="hourglass" class="lucide-icon"></i> Pendente'}</span>
        ${r.status==='rejected'&&r.note?`<p style="font-size:.72rem;color:var(--coral);text-align:right;max-width:180px"><i data-lucide="alert-triangle" class="lucide-icon"></i> ${r.note}</p>`:''}
        <div style="display:flex;gap:.35rem">
          ${hasData?`<button class="btn btn-navy btn-sm" onclick="openReceiptViewer('${cpf}','${k}')"><i data-lucide="eye" class="lucide-icon"></i> Ver</button>`:''}
          ${r.status!=='approved'?`<button class="btn btn-success btn-sm" onclick="approveR('${cpf}','${k}')"><i data-lucide="check" class="lucide-icon"></i> Aprovar</button>`:''}
          ${r.status!=='approved'?`<button class="btn btn-danger btn-sm" onclick="promptRejectReceipt('${cpf}','${k}')" title="Recusar com observação"><i data-lucide="x-circle" class="lucide-icon"></i> Recusar</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function approveR(cpf,parcel){
  const tripId=S.getTrip();
  const ps=DB.get('payments')||[];
  const p=ps.find(x=>x.cpf===cpf&&x.tripId===tripId); if(!p) return;
  if(p.receipts[parcel]){ p.receipts[parcel].status='approved'; p.paidInstallments=Object.values(p.receipts).filter(r=>r.status==='approved').length; }
  DB.set('payments',ps); toast('Comprovante aprovado!','ok'); viewTraveler(cpf);
}
function rejectR(cpf,parcel){ promptRejectReceipt(cpf,parcel); }

window.promptRejectReceipt=function(cpf,n){
  document.getElementById('reject-overlay')?.remove();
  const ov=document.createElement('div'); ov.className='overlay on'; ov.id='reject-overlay';
  ov.innerHTML=`
    <div class="modal" style="max-width:420px">
      <div class="modal-head">
        <span class="modal-title">\u274c Recusar Comprovante \u2014 Parcela ${n}</span>
        <button class="modal-x" onclick="document.getElementById('reject-overlay').remove();document.body.style.overflow=''">\u2715</button>
      </div>
      <div class="modal-body">
        <div class="alert al-gold mb2"><span class="al-ico">\u26a0\ufe0f</span><span>O viajante ver\u00e1 este motivo e poder\u00e1 reenviar um novo comprovante.</span></div>
        <div class="form-group dark-label">
          <label>Motivo da recusa *</label>
          <textarea id="reject-note" class="form-control light" rows="3"
            placeholder="Ex: Comprovante ileg\u00edvel, valor incorreto..."></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('reject-overlay').remove();document.body.style.overflow=''">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmRejectReceipt('${cpf}','${n}')">\u274c Recusar e Notificar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.confirmRejectReceipt=function(cpf,n){
  const note=document.getElementById('reject-note')?.value.trim();
  if(!note){toast('Informe o motivo da recusa.','er');return;}
  const tripId=S.getTrip();
  const ps=DB.get('payments')||[];
  const idx=ps.findIndex(x=>x.cpf===cpf&&x.tripId===tripId); if(idx<0)return;
  if(!ps[idx].receipts[n])return;
  ps[idx].receipts[n].status='rejected';
  ps[idx].receipts[n].note=note;
  ps[idx].paidInstallments=Object.values(ps[idx].receipts).filter(r=>r.status==='approved').length;
  DB.set('payments',ps);
  document.getElementById('reject-overlay')?.remove(); document.body.style.overflow='';
  toast('Comprovante recusado. O viajante ver\u00e1 o motivo e poder\u00e1 reenviar.','wn');
  viewTraveler(cpf);
};

function openReceiptViewer(cpf,parcel){
  const tripId=S.getTrip();
  const ps=DB.get('payments')||[];
  const p=ps.find(x=>x.cpf===cpf&&x.tripId===tripId); if(!p) return;
  const r=p.receipts[parcel]; if(!r||!r.data) return;
  const isPdf=r.type&&r.type.includes('pdf');
  document.getElementById('receipt-viewer')?.remove();
  const viewer=document.createElement('div');
  viewer.id='receipt-viewer';
  viewer.style.cssText='position:fixed;inset:0;background:rgba(11,31,58,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:1.5rem;backdrop-filter:blur(8px);';
  viewer.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:900px;margin-bottom:1rem">
      <div style="color:#fff;font-size:.9rem;font-weight:600"><i data-lucide="receipt" class="lucide-icon" style="width:.9rem;height:.9rem"></i> Parcela ${parcel} &nbsp;|&nbsp; <span style="color:rgba(255,255,255,.5)">${r.filename||''}</span></div>
      <div style="display:flex;gap:.6rem">
        <a href="${r.data}" download="${r.filename||'comprovante'}" style="padding:.45rem .9rem;background:var(--mint);color:#fff;border-radius:6px;font-size:.8rem;font-weight:600;text-decoration:none">⬇️ Baixar</a>
        <button onclick="document.getElementById('receipt-viewer').remove()" style="padding:.45rem .9rem;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:6px;font-size:.8rem;cursor:pointer"><i data-lucide="x" class="lucide-icon"></i> Fechar</button>
      </div>
    </div>
    ${isPdf
      ? `<iframe src="${r.data}" style="width:100%;max-width:900px;height:75vh;border-radius:10px;border:none;background:#fff"></iframe>`
      : `<img src="${r.data}" style="max-width:900px;max-height:75vh;width:100%;object-fit:contain;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5)">`}`;
  viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.remove();});
  document.body.appendChild(viewer);
}

/* ════════════════════════════════════════════
   PAGE: PAGAMENTO
════════════════════════════════════════════ */
function initPagamento(){
  const s=S.get(); if(!s){location.href='index.html';return;}
  const tripId=S.getTrip();
  if(!tripId){ location.href=s.role==='admin'?'dashboard-admin.html':'dashboard-viajante.html'; return; }
  fillSB();
  if(s.role==='admin'){ buildAdminSidebar('pag'); renderAdminPay(tripId); }
  else { buildTravelerSidebar('pag'); renderTravPay(s, tripId); }
}

function renderTravPay(s, tripId){
  const trip=getTrip(tripId); if(!trip){ return; }
  document.getElementById('admin-pay')?.classList.add('gone');
  document.getElementById('trav-pay')?.classList.remove('gone');

  if(!trip.price){
    const el=document.getElementById('trav-pay');
    if(el) el.innerHTML=`<div class="alert al-gold"><span class="al-ico"><i data-lucide="hourglass" class="lucide-icon"></i></span><span>O administrador ainda não configurou o valor da viagem.</span></div>`;
    return;
  }

  const ps=DB.get('payments')||[];
  let p=ps.find(x=>x.cpf===s.cpf&&x.tripId===tripId);
  if(!p){ p={cpf:s.cpf,tripId,totalInstallments:1,dueDay:10,paidInstallments:0,locked:false,receipts:{}}; ps.push(p); DB.set('payments',ps); }

  $('tv-total', fmt(trip.price));

  if(p.locked){
    // Show locked view
    document.getElementById('parc-config')?.classList.add('gone');
    document.getElementById('parc-locked-info')?.classList.remove('gone');
    $('locked-count', p.totalInstallments+'x');
    $('locked-day',   `dia ${p.dueDay} de cada mês`);
    $('locked-each',  fmt(trip.price/p.totalInstallments));
    renderParcels(s.cpf, tripId);
  } else {
    document.getElementById('parc-config')?.classList.remove('gone');
    document.getElementById('parc-locked-info')?.classList.add('gone');
    const selQ=document.getElementById('parc-sel');
    const selD=document.getElementById('due-day-sel');
    if(selQ) selQ.value=p.totalInstallments;
    if(selD) selD.value=p.dueDay||10;
    updateParcelPreview(trip.price, p.totalInstallments, p.dueDay||10);
    selQ?.addEventListener('change',()=>updateParcelPreview(trip.price,parseInt(selQ.value),parseInt(selD?.value||10)));
    selD?.addEventListener('change',()=>updateParcelPreview(trip.price,parseInt(selQ?.value||1),parseInt(selD.value)));
  }
}

function updateParcelPreview(price, qty, day) {
  $('tv-count', qty+'x');
  $('tv-each',  fmt(price/qty));
  // Show upcoming months
  const prev=document.getElementById('parc-preview'); if(!prev) return;
  const now=new Date();
  let html='';
  for(let i=0;i<qty;i++){
    const m=new Date(now.getFullYear(), now.getMonth()+i, day);
    html+=`<div style="display:flex;justify-content:space-between;padding:.45rem .75rem;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);font-size:.82rem">
      <span>Parcela ${i+1} — ${MONTHS[m.getMonth()]}/${m.getFullYear()}</span>
      <span class="fw6">${fmt(price/qty)}</span>
    </div>`;
  }
  prev.innerHTML=html;
}

window.lockInstallments = function() {
  const s=S.get(); const tripId=S.getTrip();
  const trip=getTrip(tripId);
  const qty=parseInt(document.getElementById('parc-sel')?.value||1);
  const day=parseInt(document.getElementById('due-day-sel')?.value||10);
  if(!confirm(`Confirmar ${qty}x com vencimento no dia ${day}?\n\nAtenção: esta escolha NÃO poderá ser alterada.`)) return;
  const ps=DB.get('payments')||[];
  const idx=ps.findIndex(x=>x.cpf===s.cpf&&x.tripId===tripId);
  if(idx>=0){ ps[idx].totalInstallments=qty; ps[idx].dueDay=day; ps[idx].locked=true; }
  DB.set('payments',ps);
  toast('Parcelamento confirmado!','ok');
  renderTravPay(s,tripId);
  renderParcels(s.cpf,tripId);
};

function renderParcels(cpf,tripId){
  const el=document.getElementById('parc-list'); if(!el) return;
  const trip=getTrip(tripId); if(!trip) return;
  const ps=DB.get('payments')||[];
  const p=ps.find(x=>x.cpf===cpf&&x.tripId===tripId); if(!p) return;
  const each=trip.price/p.totalInstallments;
  const now=new Date();
  el.innerHTML=Array.from({length:p.totalInstallments},(_,i)=>{
    const n=i+1;
    const r=p.receipts[n];
    const st=r?r.status:'none';
    const m=new Date(now.getFullYear(), now.getMonth()+i, p.dueDay||10);
    return`<div class="parcel">
      <span class="parcel-n ${st==='approved'?'p':st==='pending'?'w':'u'}">${n}</span>
      <div class="parcel-inf">
        <p class="parcel-lbl">Parcela ${n} — ${MONTHS[m.getMonth()]}/${m.getFullYear()}</p>
        <p class="parcel-dt">${r?'Enviado em '+r.date:`Vence dia ${p.dueDay||10}`}</p>
        ${r?.status==='rejected'&&r?.note?`<p style="font-size:.76rem;color:var(--coral);margin-top:.2rem"><i data-lucide="alert-triangle" class="lucide-icon"></i> Admin: "${r.note}" — <strong>Reenvie o comprovante</strong></p>`:''}
      </div>
      <span class="parcel-val">${fmt(each)}</span>
      <span class="badge ${st==='approved'?'b-green':st==='pending'?'b-gold':'b-muted'}">${st==='approved'?'<i data-lucide="check-circle" class="lucide-icon"></i> Aprovado':st==='pending'?'<i data-lucide="hourglass" class="lucide-icon"></i> Aguardando':'<i data-lucide="upload" class="lucide-icon"></i> Enviar'}</span>
      ${st==='rejected'?`<button class="btn btn-red btn-sm" onclick="openUpload(${n})"><i data-lucide="refresh-cw" class="lucide-icon"></i> Reenviar</button>`:st!=='approved'?`<button class="btn btn-outline btn-sm" onclick="openUpload(${n})"><i data-lucide="upload" class="lucide-icon"></i></button>`:''}
    </div>`;
  }).join('');
  document.getElementById('parc-section')?.classList.remove('gone');
}

function openUpload(n){ $('up-num',n); document.getElementById('up-parc').value=n; openM('upload-modal'); }

window.submitReceipt = function(){
  const s=S.get(); const tripId=S.getTrip();
  const n=document.getElementById('up-parc')?.value;
  const file=document.getElementById('rcpt-file')?.files[0];
  if(!file){ toast('Selecione um arquivo.','er'); return; }
  if(file.size>4*1024*1024){ toast('Arquivo muito grande. Máximo 4MB.','er'); return; }
  const btn=document.querySelector('#upload-modal .btn-red');
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }
  const reader=new FileReader();
  reader.onload=e=>{
    const ps=DB.get('payments')||[];
    const idx=ps.findIndex(x=>x.cpf===s.cpf&&x.tripId===tripId);
    if(idx>=0){ ps[idx].receipts[n]={status:'pending',date:new Date().toLocaleDateString('pt-BR'),filename:file.name,type:file.type,data:e.target.result}; DB.set('payments',ps); }
    if(btn){ btn.disabled=false; btn.innerHTML='<i data-lucide="upload" class="lucide-icon"></i> Enviar Comprovante';if(window.lucide)lucide.createIcons(); }
    closeM('upload-modal');
    const fi=document.getElementById('rcpt-file'); if(fi) fi.value='';
    toast('Comprovante enviado! Aguardando aprovação.','ok');
    renderParcels(s.cpf,tripId);
  };
  reader.onerror=()=>{ if(btn){btn.disabled=false;btn.innerHTML='<i data-lucide="upload" class="lucide-icon"></i> Enviar Comprovante';if(window.lucide)lucide.createIcons();} toast('Erro ao ler arquivo.','er'); };
  reader.readAsDataURL(file);
};

function renderAdminPay(tripId){
  document.getElementById('admin-pay')?.classList.remove('gone');
  document.getElementById('trav-pay')?.classList.add('gone');
  const trip=getTrip(tripId); if(!trip) return;
  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));
  const ps=(DB.get('payments')||[]).filter(p=>p.tripId===tripId);

  // Arrecadação
  // Goal: manual if set, otherwise auto (price × travelers)
  const meta    = trip.arrecadationGoal || ((trip.price||0) * users.length);
  const arrec   = ps.reduce((a,p)=>a+(trip.price/p.totalInstallments)*p.paidInstallments,0);
  const pctMeta = meta>0?Math.round((arrec/meta)*100):0;
  $('arrecadado',   fmt(arrec));
  $('meta-total',   fmt(meta));
  $('pct-meta',     pctMeta+'%');
  const barEl=document.getElementById('meta-bar');
  if(barEl) barEl.style.width=pctMeta+'%';

  const tbody=document.getElementById('adm-pay-tbody'); if(!tbody) return;
  tbody.innerHTML=users.map(u=>{
    const p=ps.find(x=>x.cpf===u.cpf);
    const pct=p?Math.round((p.paidInstallments/p.totalInstallments)*100):0;
    const pr=p?Object.values(p.receipts||{}).filter(r=>r.status==='pending').length:0;
    return`<tr>
      <td><div class="flex ic g1"><div class="ava">${u.name.charAt(0)}</div>${u.name}</div></td>
      <td>${fmt(trip.price||0)}</td>
      <td>${p&&p.locked?`${p.totalInstallments}x — dia ${p.dueDay}`:'Não configurado'}</td>
      <td><div class="flex ic" style="gap:.5rem"><div class="pbar" style="width:80px"><div class="pbar-fill ${pct===100?'green':pct>50?'gold':'red'}" style="width:${pct}%"></div></div>${pct}%</div></td>
      <td>${pr>0?`<span class="badge b-gold"><i data-lucide="hourglass" class="lucide-icon"></i> ${pr}</span>`:'<span class="badge b-green">Em dia</span>'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewTravelerPayment('${u.cpf}')">Ver detalhes</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="6" class="tc tm">Nenhum viajante</td></tr>';
}

window.viewTravelerPayment = function(cpf){ viewTraveler(cpf); };

/* ════════════════════════════════════════════
   PAGE: TRANSPORTE (Admin only)
════════════════════════════════════════════ */
function initTransporte(){
  if(!guard('admin')) return;
  const tripId=S.getTrip();
  if(!tripId){ openAdminTripSelector(); return; }
  fillSB(); buildAdminSidebar('trans');
  const trip=getTrip(tripId);
  $('pg-trip-name', trip?.name||'');
  renderBusAdmin(trip, tripId);
}

function renderBusAdmin(trip, tripId){
  const container=document.getElementById('transport-container'); if(!container) return;
  if(!trip||!(trip.buses||[]).length){
    container.innerHTML=`<div class="alert al-gold"><span class="al-ico"><i data-lucide="alert-triangle" class="lucide-icon"></i></span><span>Nenhum ônibus configurado nesta viagem.</span></div>`;
    return;
  }
  const seats=DB.get('seats')||{};
  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));
  // Family map for suggestions
  function famNames(cpf){ const u=users.find(x=>x.cpf===cpf); if(!u)return[]; const m=[]; if(u.married&&u.spouseName)m.push(u.spouseName); if(u.hasKids)(u.kids||[]).forEach(k=>{if(k)m.push(k);}); return m; }

  container.innerHTML=trip.buses.map(bus=>{
    const floors=bus.floors||1;
    let busHtml='';
    for(let fl=1;fl<=floors;fl++){
      const key=`${tripId}_${bus.id}_${fl}`;
      const bmap=seats[key]||{};
      const seatToCpf={};
      Object.entries(bmap).forEach(([cpf,slist])=>(slist||[]).forEach(s=>{seatToCpf[s]=cpf;}));
      const flSeats=fl===1?(bus.seatsFloor1||bus.seats||44):(bus.seatsFloor2||0);
      if(flSeats===0) continue;
      let seatsHtml='';
      const rows=Math.ceil(flSeats/4);
      let sn=1;
      for(let r=1;r<=rows&&sn<=flSeats;r++){
        seatsHtml+=`<div class="seat-row"><span class="row-n">${r}</span>`;
        for(let c=0;c<4;c++){
          if(c===2) seatsHtml+='<div class="seat-gap"></div>';
          if(sn>flSeats){ seatsHtml+='<div style="width:36px"></div>'; }
          else {
            const n=sn; const isDrv=(fl===1&&n===1);
            const occupant=seatToCpf[n];
            const u=occupant?users.find(x=>x.cpf===occupant):null;
            let cls=isDrv?'drv':occupant?'taken':'free';
            let ttl=isDrv?'Motorista':u?u.name:`Assento ${n} — livre`;
            seatsHtml+=`<button class="seat ${cls}" title="${ttl}"
              ${isDrv?'disabled':''}
              onclick="adminClickSeat('${tripId}','${bus.id}',${n},${fl})">${isDrv?'<i data-lucide="steering-wheel" class="lucide-icon" style="width:.75rem;height:.75rem"></i>':n}</button>`;
            sn++;
          }
        }
        seatsHtml+='</div>';
      }
      busHtml+=`<div style="margin-bottom:1.25rem">
        <div style="font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:.65rem">
          ${floors===2?(fl===1?'<i data-lucide="bus" class="lucide-icon"></i> 1º Andar':'<i data-lucide="layers" class="lucide-icon"></i> 2º Andar'):'<i data-lucide="bus" class="lucide-icon"></i> Mapa de Assentos'}
        </div>
        <div style="text-align:center;background:var(--navy);color:rgba(255,255,255,.5);font-size:.7rem;font-weight:700;
          letter-spacing:.08em;padding:.45rem;border-radius:var(--r-sm);margin-bottom:.75rem;text-transform:uppercase">
          <i data-lucide="steering-wheel" class="lucide-icon" style="width:.8rem;height:.8rem"></i> Frente do Ônibus
        </div>
        <div class="seat-grid">${seatsHtml}</div>
      </div>`;
    }
    let occ=0;
    for(let fl=1;fl<=floors;fl++){const bmap=seats[`${tripId}_${bus.id}_${fl}`]||{};occ+=Object.values(bmap).flat().length;}
    const total=bus.seats||0;
    return`<div class="card mb3">
      <div class="card-head">
        <div><div class="card-title"><i data-lucide="bus" class="lucide-icon"></i> ${floors===2?'Ônibus 2 andares':'Ônibus'} #${bus.id} — ${total} assentos</div>
          <div class="card-sub">${occ} ocupados / ${Math.max(0,total-occ-1)} livres</div></div>
      </div>
      <div class="card-body">${busHtml}</div>
    </div>`;
  }).join('');

  container.insertAdjacentHTML('afterbegin',`
    <div class="flex ic" style="gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;font-size:.8rem;color:var(--text-2)">
      <div class="flex ic g1"><div style="width:14px;height:14px;border-radius:3px;background:#d1fae5"></div>Livre — clique para atribuir</div>
      <div class="flex ic g1"><div style="width:14px;height:14px;border-radius:3px;background:#fee2e2"></div>Ocupado — clique para liberar</div>
    </div>`);
}

window.adminClickSeat = function(tripId, busId, seatNum, floor=1){
  const trip=getTrip(tripId); if(!trip) return;
  const seats=DB.get('seats')||{};
  const key=`${tripId}_${busId}_${floor}`;
  if(!seats[key]) seats[key]={};
  const bmap=seats[key];
  // Check if occupied
  let occupantCpf=null;
  Object.entries(bmap).forEach(([cpf,slist])=>{ if((slist||[]).includes(seatNum)) occupantCpf=cpf; });

  if(occupantCpf){
    // Free the seat
    if(!confirm('Liberar este assento?')) return;
    bmap[occupantCpf]=(bmap[occupantCpf]||[]).filter(s=>s!==seatNum);
    if(!bmap[occupantCpf].length) delete bmap[occupantCpf];
    DB.set('seats',seats);
    toast(`Assento ${seatNum} liberado.`,'ok');
    renderBusAdmin(trip,tripId);
  } else {
    // Assign to traveler — show picker
    showTravelerPicker(tripId, busId, seatNum, floor, trip);
  }
};

function showTravelerPicker(tripId, busId, seatNum, floor=1, trip){
  document.getElementById('traveler-picker')?.remove();
  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));
  const ov=document.createElement('div');
  ov.className='overlay on'; ov.id='traveler-picker';
  ov.innerHTML=`
    <div class="modal" style="max-width:420px">
      <div class="modal-head"><span class="modal-title"><i data-lucide="armchair" class="lucide-icon"></i> Atribuir Assento ${seatNum}</span>
        <button class="modal-x" onclick="document.getElementById('traveler-picker').remove();document.body.style.overflow=''"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.5rem;max-height:50vh;overflow-y:auto">
        ${users.map(u=>`
          <div onclick="assignSeat('${tripId}','${busId}',${seatNum},${floor},'${u.cpf}')"
            style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border:1.5px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:all .2s"
            onmouseover="this.style.borderColor='var(--red)'" onmouseout="this.style.borderColor='var(--border)'">
            <div class="ava">${u.name.charAt(0)}</div>
            <div><div class="fw6" style="font-size:.88rem">${u.name}</div><div class="tm">${CPF.format(u.cpf)}</div></div>
          </div>`).join('')||'<p class="tm">Nenhum viajante cadastrado.</p>'}
      </div>
      <div class="modal-foot"><button class="btn btn-outline" onclick="document.getElementById('traveler-picker').remove();document.body.style.overflow=''">Cancelar</button></div>
    </div>`;
  document.body.appendChild(ov);
}

window.assignSeat = function(tripId, busId, seatNum, floor=1, cpf){
  const seats=DB.get('seats')||{};
  const key=`${tripId}_${busId}_${floor}`;
  if(!seats[key]) seats[key]={};
  if(!seats[key][cpf]) seats[key][cpf]=[];
  if(!seats[key][cpf].includes(seatNum)) seats[key][cpf].push(seatNum);
  DB.set('seats',seats);
  document.getElementById('traveler-picker')?.remove();
  document.body.style.overflow='';
  const users=DB.get('users')||[];
  const u=users.find(x=>x.cpf===cpf);
  toast(`Assento ${seatNum} atribuído a ${u?.name||cpf}!`,'ok');
  renderBusAdmin(getTrip(tripId),tripId);
};

/* ════════════════════════════════════════════
   PAGE: HOTEL (Admin only — fully functional)
════════════════════════════════════════════ */
function initHotel(){
  if(!guard('admin')) return;
  const tripId=S.getTrip();
  if(!tripId){ openAdminTripSelector(); return; }
  fillSB(); buildAdminSidebar('hotel');
  const trip=getTrip(tripId);
  $('pg-trip-name', trip?.name||'');
  renderHotelAdmin(trip, tripId);
  initHotelForms(trip, tripId);
}

function renderHotelAdmin(trip, tripId){
  const container=document.getElementById('hotel-container'); if(!container) return;
  const rooms_db=DB.get('rooms')||{};
  const tRooms=rooms_db[tripId]||{};
  const hotels=(trip?.hotels)||[];

  if(!hotels.length){
    container.innerHTML=`<div class="alert al-sky"><span class="al-ico"><i data-lucide="info" class="lucide-icon"></i></span><span>Nenhum hotel configurado. Adicione um hotel usando o formulário abaixo.</span></div>`;
    return;
  }

  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));

  container.innerHTML=hotels.map(hotel=>`
    <div class="card mb3">
      <div class="card-head">
        <div><div class="card-title"><i data-lucide="building-2" class="lucide-icon"></i> ${hotel.name}</div>
          <div class="card-sub">${(hotel.rooms||[]).length} quartos</div></div>
        <button class="btn btn-outline btn-sm" onclick="openAddRoom('${tripId}','${hotel.id}')"><i data-lucide="plus" class="lucide-icon"></i> Quarto</button>
      </div>
      <div class="card-body">
        <div class="rooms" id="hotel-rooms-${hotel.id}">
          ${(hotel.rooms||[]).map(room=>{
            const occs=tRooms[room.id]||[];
            const occNames=occs.map(c=>{ const u=users.find(x=>x.cpf===c); return u?u.name:c; });
            return`<div class="room ${occs.length>=room.capacity?'occ':''}">
              <div class="room-ico">${room.type==='single'?'<i data-lucide="bed-single" class="lucide-icon" style="width:1.5rem;height:1.5rem"></i>':room.type==='double'?'<i data-lucide="bed-double" class="lucide-icon" style="width:1.5rem;height:1.5rem"></i>':'<i data-lucide="home" class="lucide-icon" style="width:1.5rem;height:1.5rem"></i>'}</div>
              <div class="room-n">Quarto ${room.id}</div>
              <div class="room-t">${room.type==='single'?'Individual':room.type==='double'?'Duplo':'Familiar'}</div>
              <div class="room-c"><i data-lucide="users" class="lucide-icon"></i> ${occs.length}/${room.capacity} pessoas</div>
              ${occNames.length?`<div style="font-size:.72rem;color:var(--text-3);margin-top:.3rem;line-height:1.6">${occNames.join('<br>')}</div>`:''}
              <div class="mt1" style="display:flex;gap:.35rem;flex-wrap:wrap">
                <button class="btn btn-outline btn-sm" style="font-size:.72rem" onclick="openAssignRoom('${tripId}','${hotel.id}','${room.id}')"><i data-lucide="user-plus" class="lucide-icon"></i> Atribuir</button>
                <button class="btn btn-danger btn-sm" style="font-size:.72rem" onclick="removeRoom('${tripId}','${hotel.id}','${room.id}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>
              </div>
            </div>`;
          }).join('')||'<p class="tm">Nenhum quarto cadastrado. Clique em "+ Quarto".</p>'}
        </div>
      </div>
    </div>`).join('');
}

function initHotelForms(trip, tripId){
  // Add hotel form
  document.getElementById('add-hotel-form')?.addEventListener('submit', e=>{
    e.preventDefault();
    const name=document.getElementById('hotel-name-inp').value.trim();
    if(!name){ toast('Informe o nome do hotel.','er'); return; }
    const trips=DB.get('trips')||[];
    const ti=trips.findIndex(t=>t.id===tripId);
    if(ti<0) return;
    const hotels=trips[ti].hotels||[];
    hotels.push({id:Date.now(), name, rooms:[]});
    trips[ti].hotels=hotels;
    DB.set('trips',trips);
    document.getElementById('hotel-name-inp').value='';
    toast('Hotel adicionado!','ok');
    renderHotelAdmin(trips[ti],tripId);
  });
}

window.openAddRoom = function(tripId, hotelId){
  document.getElementById('add-room-overlay')?.remove();
  const ov=document.createElement('div');
  ov.className='overlay on'; ov.id='add-room-overlay';
  ov.innerHTML=`
    <div class="modal" style="max-width:380px">
      <div class="modal-head"><span class="modal-title"><i data-lucide="plus" class="lucide-icon"></i> Novo Quarto</span>
        <button class="modal-x" onclick="document.getElementById('add-room-overlay').remove();document.body.style.overflow=''"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group dark-label">
          <label>Número/Nome do Quarto</label>
          <input type="text" id="room-num" class="form-control light" placeholder="Ex: 101">
        </div>
        <div class="form-group dark-label">
          <label>Tipo</label>
          <select id="room-type" class="form-control light">
            <option value="single">Individual (1 pessoa)</option>
            <option value="double">Duplo (2 pessoas)</option>
            <option value="family">Familiar (até 4 pessoas)</option>
            <option value="custom">Capacidade personalizada</option>
          </select>
        </div>
        <div class="form-group dark-label" id="custom-cap-sec" style="display:none">
          <label>Capacidade (pessoas)</label>
          <input type="number" id="room-cap" class="form-control light" value="3" min="1" max="20">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('add-room-overlay').remove();document.body.style.overflow=''">Cancelar</button>
        <button class="btn btn-red" onclick="saveRoom('${tripId}','${hotelId}')">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('room-type')?.addEventListener('change',function(){
    document.getElementById('custom-cap-sec').style.display=this.value==='custom'?'block':'none';
  });
};

window.saveRoom = function(tripId, hotelId){
  const num=document.getElementById('room-num').value.trim();
  const type=document.getElementById('room-type').value;
  if(!num){ toast('Informe o número do quarto.','er'); return; }
  const capMap={single:1,double:2,family:4};
  const capacity=type==='custom'?parseInt(document.getElementById('room-cap').value)||2:capMap[type];
  const trips=DB.get('trips')||[];
  const ti=trips.findIndex(t=>t.id===tripId); if(ti<0) return;
  const hi=(trips[ti].hotels||[]).findIndex(h=>h.id==hotelId); if(hi<0) return;
  trips[ti].hotels[hi].rooms.push({id:num, type, capacity});
  DB.set('trips',trips);
  document.getElementById('add-room-overlay')?.remove();
  document.body.style.overflow='';
  toast(`Quarto ${num} adicionado!`,'ok');
  renderHotelAdmin(trips[ti],tripId);
};

window.removeRoom = function(tripId, hotelId, roomId){
  if(!confirm(`Remover quarto ${roomId}?`)) return;
  const trips=DB.get('trips')||[];
  const ti=trips.findIndex(t=>t.id===tripId); if(ti<0) return;
  const hi=(trips[ti].hotels||[]).findIndex(h=>h.id==hotelId); if(hi<0) return;
  trips[ti].hotels[hi].rooms=trips[ti].hotels[hi].rooms.filter(r=>String(r.id)!==String(roomId));
  DB.set('trips',trips);
  const rooms=DB.get('rooms')||{};
  if(rooms[tripId]) { delete rooms[tripId][roomId]; DB.set('rooms',rooms); }
  toast('Quarto removido.','ok');
  renderHotelAdmin(trips[ti],tripId);
};

window.openAssignRoom = function(tripId, hotelId, roomId){
  document.getElementById('assign-room-overlay')?.remove();
  const trips=DB.get('trips')||[];
  const trip=trips.find(t=>t.id===tripId); if(!trip) return;
  const hotel=(trip.hotels||[]).find(h=>h.id==hotelId); if(!hotel) return;
  const room=(hotel.rooms||[]).find(r=>String(r.id)===String(roomId)); if(!room) return;
  const rooms_db=DB.get('rooms')||{};
  const tRooms=rooms_db[tripId]||{};
  const current=tRooms[roomId]||[];
  const users=(DB.get('users')||[]).filter(u=>(trip.travelers||[]).includes(u.cpf));

  const ov=document.createElement('div');
  ov.className='overlay on'; ov.id='assign-room-overlay';
  ov.innerHTML=`
    <div class="modal" style="max-width:440px">
      <div class="modal-head">
        <div><div class="modal-title"><i data-lucide="building-2" class="lucide-icon"></i> Quarto ${roomId}</div>
          <div style="font-size:.78rem;color:var(--text-3);margin-top:.15rem">Capacidade: ${room.capacity} pessoa(s) — ${current.length} ocupante(s) atuais</div>
        </div>
        <button class="modal-x" onclick="document.getElementById('assign-room-overlay').remove();document.body.style.overflow=''"><i data-lucide="x" class="lucide-icon"></i></button>
      </div>
      <div class="modal-body">
        <p style="font-size:.82rem;color:var(--text-2);margin-bottom:.85rem">Selecione os viajantes para este quarto (máx ${room.capacity}):</p>
        <div style="display:flex;flex-direction:column;gap:.45rem;max-height:45vh;overflow-y:auto">
          ${users.map(u=>{
            const inRoom=current.includes(u.cpf);
            const otherRoom=getUserRoom(u.cpf,tripId);
            const blocked=!inRoom&&otherRoom&&otherRoom!==String(roomId);
            return`<label style="display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;
              border:1.5px solid ${inRoom?'var(--red)':'var(--border)'};border-radius:var(--r-sm);
              cursor:${blocked?'not-allowed':'pointer'};background:${inRoom?'rgba(232,25,44,.04)':'var(--surface)'}">
              <input type="checkbox" value="${u.cpf}" ${inRoom?'checked':''} ${blocked?'disabled':''}>
              <div class="ava">${u.name.charAt(0)}</div>
              <div style="flex:1">
                <div class="fw6" style="font-size:.86rem">${u.name}</div>
                ${u.married&&u.spouseName?`<div class="tm" style="font-size:.72rem"><i data-lucide="heart" class="lucide-icon"></i> ${u.spouseName}${u.hasKids&&u.kids?.length?' · <i data-lucide="baby" class="lucide-icon"></i> '+u.kids.join(', '):''}</div>`:''}
                ${blocked?`<div class="tm">Já no quarto ${otherRoom}</div>`:''}
              </div>
            </label>`;
          }).join('')||'<p class="tm">Nenhum viajante.</p>'}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" onclick="document.getElementById('assign-room-overlay').remove();document.body.style.overflow=''">Cancelar</button>
        <button class="btn btn-red" onclick="saveRoomAssignment('${tripId}','${roomId}',${room.capacity})"><i data-lucide="save" class="lucide-icon"></i> Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
};

window.saveRoomAssignment = function(tripId, roomId, capacity){
  const checked=Array.from(document.querySelectorAll('#assign-room-overlay input[type=checkbox]:checked')).map(c=>c.value);
  if(checked.length>capacity){ toast(`Este quarto comporta no máximo ${capacity} pessoa(s).`,'er'); return; }
  const rooms_db=DB.get('rooms')||{};
  if(!rooms_db[tripId]) rooms_db[tripId]={};
  rooms_db[tripId][roomId]=checked;
  DB.set('rooms',rooms_db);
  document.getElementById('assign-room-overlay')?.remove();
  document.body.style.overflow='';
  toast('Quarto atualizado!','ok');
  renderHotelAdmin(getTrip(tripId),tripId);
};

/* ════════════════════════════════════════════
   PAGE: CONFIGURAÇÕES
════════════════════════════════════════════ */
function initConfig(){
  if(!guard('admin')) return;
  const tripId=S.getTrip();
  if(!tripId){ openAdminTripSelector(); return; }
  fillSB(); buildAdminSidebar('cfg');
  $('pg-trip-name', getTrip(tripId)?.name||'');
  loadCfg(tripId);
  document.getElementById('cfg-form')?.addEventListener('submit', e=>{
    e.preventDefault();
    const trips=DB.get('trips')||[];
    const ti=trips.findIndex(t=>t.id===tripId); if(ti<0) return;
    trips[ti].price    = parseFloat(document.getElementById('cfg-price').value)||0;
    trips[ti].arrecadationGoal = parseFloat(document.getElementById('cfg-goal')?.value)||0;
    trips[ti].rules    = document.getElementById('cfg-rules').value;
    trips[ti].name     = document.getElementById('cfg-name').value;
    trips[ti].destination = document.getElementById('cfg-dest').value;
    trips[ti].departurePlace = document.getElementById('cfg-dep').value;
    trips[ti].date     = document.getElementById('cfg-date').value;
    trips[ti].departureTime  = document.getElementById('cfg-time').value;
    trips[ti].maxPeople= parseInt(document.getElementById('cfg-max').value)||44;
    DB.set('trips',trips);
    toast('Configurações salvas!','ok');
  });
}

function loadCfg(tripId){
  const trip=getTrip(tripId)||{};
  const sv=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  sv('cfg-price', trip.price||'');
  sv('cfg-goal',  trip.arrecadationGoal||'');
  sv('cfg-rules', trip.rules||'');
  sv('cfg-name',  trip.name||'');
  sv('cfg-dest',  trip.destination||'');
  sv('cfg-dep',   trip.departurePlace||'');
  sv('cfg-date',  trip.date||'');
  sv('cfg-time',  trip.departureTime||'');
  sv('cfg-max',   trip.maxPeople||44);
}


/* ════════════════════════════════════════════
   PAGE: CADASTROS GLOBAL (standalone)
════════════════════════════════════════════ */
function initCadastros() {
  if(!guard('admin')) return;
  fillSB(); buildAdminSidebar('cadastros');
  const tripId=S.getTrip();
  if(tripId) $('pg-trip-name', getTrip(tripId)?.name||'');
  renderCadastrosPage();
  document.getElementById('add-user-btn')?.addEventListener('click',()=>openNewGlobalUser());
  document.getElementById('search-users')?.addEventListener('input',function(){ renderCadastrosPage(this.value); });
}

function renderCadastrosPage(filter='') {
  const tbody=document.getElementById('users-tbody'); if(!tbody) return;
  const f=filter.toLowerCase();
  const users=(DB.get('users')||[]).filter(u=>!f||u.name.toLowerCase().includes(f)||CPF.format(u.cpf).includes(f));
  tbody.innerHTML=users.map(u=>`
    <tr>
      <td><div class="flex ic g1">
        <div class="ava" style="background:${u.role==='admin'?'linear-gradient(135deg,var(--gold),#d4830a)':'linear-gradient(135deg,var(--navy),var(--sky))'}">${u.name.charAt(0)}</div>
        <div>
          <div class="fw6">${u.name}</div>
          <div class="tm" style="font-size:.72rem">
            ${u.married&&u.spouseName?'<i data-lucide="heart" class="lucide-icon"></i> '+u.spouseName:''}
            ${u.hasKids&&u.kids?.length?'· <i data-lucide="baby" class="lucide-icon"></i> '+(u.kids||[]).join(', '):''}
          </div>
        </div>
      </div></td>
      <td><span style="font-size:.82rem">${CPF.format(u.cpf)}</span></td>
      <td><span class="badge ${u.role==='admin'?'b-gold':'b-sky'}">${u.role==='admin'?'<i data-lucide="crown" class="lucide-icon"></i> Admin':'<i data-lucide="plane" class="lucide-icon"></i> Viajante'}</span></td>
      <td><span class="badge ${u.firstLogin?'b-gold':'b-green'}">${u.firstLogin?'<i data-lucide="hourglass" class="lucide-icon"></i> Aguardando':'<i data-lucide="check-circle" class="lucide-icon"></i> Ativo'}</span></td>
      <td style="font-size:.8rem;color:var(--text-3)">${getUserTrips(u.cpf).map(t=>t.name).join(', ')||'—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" onclick="editGlobalUser('${u.cpf}')"><i data-lucide="pencil" class="lucide-icon"></i> Editar</button>
        ${u.cpf!=='10127544135'?`<button class="btn btn-danger btn-sm" onclick="deleteGlobalUser('${u.cpf}')"><i data-lucide="trash-2" class="lucide-icon"></i></button>`:'' }
      </td>
    </tr>`).join('')||'<tr><td colspan="6" class="tc tm" style="padding:2rem">Nenhum usuário encontrado.</td></tr>';
  reInitIcons();
}

/* ════════════════════════════════════════════
   DEBUG
════════════════════════════════════════════ */
window.debugIV = function(){
  const users=DB.get('users')||[];
  console.group('Igreja Viagens');
  users.forEach(u=>console.log(`${u.role==='admin'?'[admin]':'[viaj]'} ${u.name} | ${CPF.format(u.cpf)} | ${u.password} | firstLogin:${u.firstLogin}`));
  console.log('Trips:', DB.get('trips')?.length||0);
  console.log('Sessão:', S.get());
  console.log('Viagem ativa:', S.getTrip());
  console.groupEnd();
};
window.resetIV = function(){
  S.clear();
  S.clearTrip();
  location.reload();
};

/* ════════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async ()=>{
  await DB.load();
  seed();
  const pg=location.pathname.split('/').pop()||'index.html';

  if(pg==='index.html'||pg===''){
    const s=S.get();
    if(s&&!s.firstLogin){
      if(s.role==='admin'){ openAdminTripSelector(); return; }
      const myTrips=getUserTrips(s.cpf);
      showTravelerTripSelector(myTrips, ()=>{ location.href='dashboard-viajante.html'; }); return;
    }
    initLogin(); return;
  }

  const routes={
    'dashboard-admin.html'   : initAdminDash,
    'dashboard-viajante.html': initTravelerDash,
    'viajantes.html'         : initViajantes,
    'pagamento.html'         : initPagamento,
    'transporte.html'        : initTransporte,
    'hotel.html'             : initHotel,
    'configuracoes.html'     : initConfig,
    'cadastros.html'         : initCadastros,
  };
  routes[pg]?.();

  document.getElementById('menu-tog')?.addEventListener('click', toggleSB);
  document.querySelector('.page')?.classList.add('fade-up');
});


function reInitIcons(){
  if(!window.lucide) return;
  window.requestAnimationFrame(() => {
    try { window.lucide.createIcons(); } catch(e) { console.warn('Erro ao carregar ícones Lucide:', e); }
  });
}

// Garante ícones também em conteúdos criados depois, como menus, tabelas, toasts e pop-ups.
(function observeLucideIcons(){
  let scheduled = false;
  const schedule = () => {
    if(scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; reInitIcons(); }, 30);
  };
  document.addEventListener('DOMContentLoaded', schedule);
  new MutationObserver((mutations) => {
    if(mutations.some(m => Array.from(m.addedNodes || []).some(n => n.nodeType === 1 && (n.matches?.('[data-lucide]') || n.querySelector?.('[data-lucide]'))))) {
      schedule();
    }
  }).observe(document.documentElement, { childList:true, subtree:true });
})();
