// =================================================================
// INÍCIO DO CÓDIGO - VERSÃO FINAL CORRIGIDA
// =================================================================

// Initialize jsPDF & Chart (global, as they are loaded in <head>)
const jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null;
const ChartJS = window.Chart || null;
const JsBarcode = window.JsBarcode || null;
const html2canvas = window.html2canvas || null;

if (!jsPDFModule) console.error("CRÍTICO: jsPDF não carregado!");
if (!ChartJS) console.error("CRÍTICO: Chart.js não carregado!");
if (!JsBarcode) console.error("CRÍTICO: JsBarcode não carregado!");
if (!html2canvas) console.error("CRÍTICO: html2canvas não carregado!");

console.log("Luckhouse Games - Script.js v4.0 (Final): Iniciando...");

// --- GLOBAL APP STATE & CONFIG ---
let STORE_CONFIG = {};
let ORDENS_SERVICO = [];
let CLIENTES = [];
let PRODUTOS = [];
let SERVICOS = [];
let VENDAS = [];
let DESPESAS = [];
let ENVIOS_PODIUM = [];
let SOLICITACOES_ESTOQUE = [];
let TRANSACOES_FINANCEIRAS = [];
let CADASTROS_AUXILIARES = { tipos: [], marcas: [], modelos: [] };

let pdvCartItems = [];
let pdvPontosDesconto = { pontos: 0, valor: 0 };
let CURRENT_USER = { username: null, role: null };
let salesChartInstance = null;
window.clientFromModalFlag = false;

// --- UTILITY FUNCTIONS ---
function showToast(message, type = "primary", title = "Notificação") {
    try {
        const toastEl = document.getElementById('liveToast');
        if (!toastEl) {
            alert(title + ": " + message);
            return;
        }
        const toastMessageEl = document.getElementById('toast-message');
        const toastTitleEl = document.getElementById('toast-title');
        toastMessageEl.textContent = message;
        toastTitleEl.textContent = title;
        
        const typeClasses = {
            success: 'bg-success-custom text-white',
            danger: 'bg-danger-custom text-white',
            warning: 'bg-warning text-dark',
            info: 'bg-info-custom',
            primary: 'bg-primary-custom text-white'
        };
        const classesToAdd = (typeClasses[type] || typeClasses.primary).split(' ');
        
        const toastHeader = toastEl.querySelector('.toast-header');
        const toastBody = toastEl.querySelector('.toast-body');

        toastEl.className = 'toast border-0';
        toastHeader.className = 'toast-header text-white';
        toastBody.className = 'toast-body';
        
        toastEl.classList.add(...classesToAdd);
        toastHeader.classList.add(...classesToAdd);
        toastBody.classList.add(...classesToAdd);

        bootstrap.Toast.getOrCreateInstance(toastEl).show();
    } catch (error) {
        console.error("Erro ao mostrar toast:", error, message);
    }
}


function formatCurrency(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "R$ --,--";
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getNextId(collection) {
    if (!Array.isArray(collection) || collection.length === 0) return 1;
    const maxId = Math.max(0, ...collection.map(item => Number(item.id) || 0));
    return maxId + 1;
}

async function imageToBase64(url) {
    if (!url) return null;
    if (!url.startsWith('http')) return null;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Erro ao converter imagem para Base64:', error);
        return null;
    }
}

// --- LOCALSTORAGE DATA MANAGEMENT ---
function saveData(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) { showToast(`Erro crítico ao salvar (${key}). Verifique o espaço de armazenamento.`, "danger"); }
}

function loadData(key, defaultValue = []) {
    const dataFromStorage = localStorage.getItem(key);
    if (dataFromStorage) {
        try { return JSON.parse(dataFromStorage); }
        catch (e) {
            console.error(`Erro ao parsear JSON da chave "${key}". Resetando para padrão.`);
            showToast(`Erro ao carregar dados (${key}).`, "warning");
            localStorage.removeItem(key);
        }
    }
    return Array.isArray(defaultValue) ? [...defaultValue] : (typeof defaultValue === 'object' && defaultValue !== null ? {...defaultValue} : defaultValue);
}

function loadAllData() {
    const oldComprasData = localStorage.getItem('luckhouse_compras');
    if (oldComprasData) {
        localStorage.setItem('luckhouse_despesas', oldComprasData);
        localStorage.removeItem('luckhouse_compras');
        console.log("MIGRAÇÃO: Dados de 'compras' movidos para 'despesas'.");
    }

    STORE_CONFIG = loadData('luckhouse_config', {});
    CLIENTES = loadData('luckhouse_clientes', []);
    PRODUTOS = loadData('luckhouse_produtos', []);
    SERVICOS = loadData('luckhouse_servicos', []);
    ORDENS_SERVICO = loadData('luckhouse_os', []);
    VENDAS = loadData('luckhouse_vendas', []);
    DESPESAS = loadData('luckhouse_despesas', []);
    ENVIOS_PODIUM = loadData('luckhouse_envios_podium', []);
    SOLICITACOES_ESTOQUE = loadData('luckhouse_solicitacoes_estoque', []);
    TRANSACOES_FINANCEIRAS = loadData('luckhouse_transacoes', []);
    CADASTROS_AUXILIARES = loadData('luckhouse_cadastros_aux', { tipos: [], marcas: [], modelos: [] });
    
    const defaultConfig = {
        nomeLoja: "Luckhouse Games", cnpj: "43.864.000/198", endereco: "Av. Itália, 200 – Shopping Amarilys, Itupeva – SP",
        telefone: "(11) 99357-7209", email: "luckhousegames@gmail.com", logoUrl: "assets/logo.png", diasGarantiaPadrao: 90,
        podiumGamesWhatsapp: "", whatsappEnvioTicket: "",
        templateOsCliente: "Olá, {cliente_nome}! Novidades sobre sua OS #{os_id} ({os_equipamento}) na {loja_nome}: o status foi atualizado para '{os_status}'. Problema relatado: {os_problema}.",
        templateReqEstoque: "Olá, Podium Games! Gostaria de solicitar os seguintes itens para a {loja_nome}:\n\n{lista_produtos}\n\nObrigado!",
        templatePromocao: "Olá, {cliente_nome}! Temos uma novidade imperdível para você aqui na {loja_nome}! Confira...",
        templateEnvioPodium: "Olá! Seguem os detalhes para a entrega do(s) seguinte(s) item(ns) da OS #{os_id}...",
        pontosPorReal: 1,
        pontosParaDesconto: 100,
        valorDescontoPontos: 5
    };
    STORE_CONFIG = { ...defaultConfig, ...STORE_CONFIG };
    
    updateStoreInfoUI();
}

// --- THEME MANAGEMENT ---
function applyTheme(theme) {
    document.body.classList.toggle('light-theme', theme === 'light');
    document.getElementById('theme-icon-sun').classList.toggle('d-none', theme === 'light');
    document.getElementById('theme-icon-moon').classList.toggle('d-none', theme !== 'light');
    localStorage.setItem('luckhouse_theme', theme);
    if(salesChartInstance) renderSalesChart();
}

function setupTheme() {
    const savedTheme = localStorage.getItem('luckhouse_theme') || 'dark';
    applyTheme(savedTheme);
    document.getElementById('theme-toggle-button').addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });
}

// --- UI & NAVIGATION ---
function updateStoreInfoUI() {
    const el = (id) => document.getElementById(id);
    const setVal = (id, val) => { if(el(id)) el(id).value = val || ''; };
    const setContent = (id, val) => { if(el(id)) el(id).textContent = val || ''; };
    
    const logoImg = el('sidebar-logo-img');
    if (logoImg) {
        if(STORE_CONFIG.logoUrl) {
            logoImg.src = STORE_CONFIG.logoUrl;
            logoImg.style.display = 'block';
            el('sidebar-logo-text').style.display = 'none';
        } else {
            logoImg.style.display = 'none';
            el('sidebar-logo-text').style.display = 'block';
        }
    }
    
    setContent('sidebar-store-name-display', STORE_CONFIG.nomeLoja);
    setContent('footer-store-name', STORE_CONFIG.nomeLoja);
    setContent('footer-store-name-2', STORE_CONFIG.nomeLoja);
    setContent('footer-cnpj', STORE_CONFIG.cnpj);
    setContent('footer-address', STORE_CONFIG.endereco);
    setContent('footer-phone', STORE_CONFIG.telefone);
    setContent('footer-email', STORE_CONFIG.email);

    if (el('config-nome-loja')) {
        setVal('config-nome-loja', STORE_CONFIG.nomeLoja);
        setVal('config-cnpj', STORE_CONFIG.cnpj);
        setVal('config-endereco', STORE_CONFIG.endereco);
        setVal('config-telefone', STORE_CONFIG.telefone);
        setVal('config-email', STORE_CONFIG.email);
        setVal('config-logo-url', STORE_CONFIG.logoUrl);
        setVal('config-garantia-dias', STORE_CONFIG.diasGarantiaPadrao);
        setVal('config-podium-games-whatsapp', STORE_CONFIG.podiumGamesWhatsapp);
        setVal('config-whatsapp-envio-ticket', STORE_CONFIG.whatsappEnvioTicket);
        setVal('config-template-os-cliente', STORE_CONFIG.templateOsCliente);
        setVal('config-template-req-estoque', STORE_CONFIG.templateReqEstoque);
        setVal('config-template-promocao', STORE_CONFIG.templatePromocao);
        setVal('config-template-envio-podium', STORE_CONFIG.templateEnvioPodium);
        setVal('config-pontos-por-real', STORE_CONFIG.pontosPorReal);
        setVal('config-pontos-para-desconto', STORE_CONFIG.pontosParaDesconto);
        setVal('config-valor-desconto-pontos', STORE_CONFIG.valorDescontoPontos);
    }
    updateTermoGarantiaPreview();
}

function updateTermoGarantiaPreview() {
    const osTermosPreview = document.getElementById('os-termos-garantia-preview');
    if (osTermosPreview) {
        osTermosPreview.innerHTML = `<p class="small">Garantia de ${STORE_CONFIG.diasGarantiaPadrao || 90} dias após entrega. Não nos responsabilizamos por danos causados por mau uso, quedas ou violação de lacre. Equipamentos não retirados em até 90 dias poderão ser descartados.</p>`;
    }
}

function navigateToSection(targetId, clickedLinkElement = null) {
    if (!CURRENT_USER.role && targetId !== 'login-prompt') return;

    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.remove('d-none');
    else document.getElementById('dashboard').classList.remove('d-none');
    
    document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]').forEach(l => l.classList.remove('active'));
    const activeLink = clickedLinkElement || document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if(activeLink) {
        activeLink.classList.add('active');
        document.getElementById('page-title').textContent = activeLink.innerText.trim();
    }
    
    if (CURRENT_USER.role) refreshDataForSection(targetId);
}

function refreshDataForSection(targetId) {
    switch(targetId) {
        case 'configuracoes': updateStoreInfoUI(); renderAuxCadastros(); break;
        case 'os': renderOSList(); populateClienteSelect(); break;
        case 'clientes': renderClientList(); break;
        case 'produtos': renderProductList(); renderServiceList(); renderSolicitacoesEstoqueList(); break;
        case 'pdv': renderPdvItemList(); populatePdvClienteSelect(); updatePdvFidelidadeUI(); break;
        case 'dashboard': renderDashboardOSRecentes(); break;
        case 'admin-area': renderAdminDashboard(); break;
        case 'envio-podium': renderPodiumOSList(); renderPodiumHistorico(); break;
        case 'despesas': renderDespesasList(); break;
    }
}

// --- AUTHENTICATION ---
function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (username === 'luckmaster' && password === 'L@1998*') CURRENT_USER = {username: 'Luck Master', role: 'admin'};
    else if (username === 'Henrique Del Peso' && password === 'hdp123') CURRENT_USER = {username: 'Henrique Del Peso', role: 'padrao'};
    else { document.getElementById('login-error-message').classList.remove('d-none'); return; }

    document.getElementById('login-error-message').classList.add('d-none');
    saveData('luckhouse_currentUser', CURRENT_USER);
    bootstrap.Modal.getInstance(document.getElementById('modalLogin'))?.hide();
    showToast(`Bem-vindo(a), ${CURRENT_USER.username}!`, "success");
    updateUIAfterLogin();
    navigateToSection('dashboard');
}

function handleLogout() {
    if (!confirm("Tem certeza que deseja sair?")) return;
    CURRENT_USER = {username: null, role: null};
    localStorage.removeItem('luckhouse_currentUser');
    updateUIAfterLogin();
    showToast("Você saiu do sistema.", "info");
}

function checkLoginState() {
    const storedUser = loadData('luckhouse_currentUser', null);
    if (storedUser?.username && storedUser?.role) {
        CURRENT_USER = storedUser;
        updateUIAfterLogin();
        navigateToSection('dashboard');
    } else {
        updateUIAfterLogin();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLogin')).show();
    }
}

function updateUIAfterLogin() {
    const isLoggedIn = !!CURRENT_USER.username;
    const isAdmin = isLoggedIn && CURRENT_USER.role === 'admin';
    document.getElementById('logged-in-user').textContent = isLoggedIn ? `${CURRENT_USER.username} (${CURRENT_USER.role})` : 'Não Logado';
    document.getElementById('logout-button').style.display = isLoggedIn ? 'block' : 'none';
    document.getElementById('login-prompt').classList.toggle('d-none', isLoggedIn);
    document.querySelectorAll('.main-content').forEach(s => s.classList.toggle('d-none', !isLoggedIn));
    document.querySelectorAll('.nav-item-admin, .admin-content').forEach(el => el.classList.toggle('d-none', !isAdmin));
    if (document.getElementById('dashboard-username')) document.getElementById('dashboard-username').textContent = CURRENT_USER.username || "Usuário";
    if(!isLoggedIn) navigateToSection('login-prompt');
}

// --- CONFIGURAÇÕES & CADASTROS AUXILIARES ---
function setupConfiguracoesModule() {
    document.getElementById('btn-save-config').addEventListener('click', () => {
        STORE_CONFIG.nomeLoja = document.getElementById('config-nome-loja').value;
        STORE_CONFIG.cnpj = document.getElementById('config-cnpj').value;
        STORE_CONFIG.endereco = document.getElementById('config-endereco').value;
        STORE_CONFIG.telefone = document.getElementById('config-telefone').value;
        STORE_CONFIG.email = document.getElementById('config-email').value;
        STORE_CONFIG.logoUrl = document.getElementById('config-logo-url').value.trim();
        STORE_CONFIG.diasGarantiaPadrao = parseInt(document.getElementById('config-garantia-dias').value) || 90;
        STORE_CONFIG.podiumGamesWhatsapp = document.getElementById('config-podium-games-whatsapp').value.trim();
        STORE_CONFIG.whatsappEnvioTicket = document.getElementById('config-whatsapp-envio-ticket').value.trim();
        STORE_CONFIG.templateOsCliente = document.getElementById('config-template-os-cliente').value;
        STORE_CONFIG.templateReqEstoque = document.getElementById('config-template-req-estoque').value;
        STORE_CONFIG.templatePromocao = document.getElementById('config-template-promocao').value;
        STORE_CONFIG.templateEnvioPodium = document.getElementById('config-template-envio-podium').value;
        STORE_CONFIG.pontosPorReal = parseFloat(document.getElementById('config-pontos-por-real').value) || 1;
        STORE_CONFIG.pontosParaDesconto = parseInt(document.getElementById('config-pontos-para-desconto').value) || 100;
        STORE_CONFIG.valorDescontoPontos = parseFloat(document.getElementById('config-valor-desconto-pontos').value) || 5;

        saveData('luckhouse_config', STORE_CONFIG);
        updateStoreInfoUI();
        showToast("Configurações salvas!", "success");
    });
    
    document.getElementById('btn-add-aux-tipo').addEventListener('click', () => addAuxCadastro('tipos', 'aux-new-tipo'));
    document.getElementById('btn-add-aux-marca').addEventListener('click', () => addAuxCadastro('marcas', 'aux-new-marca'));
    document.getElementById('btn-add-aux-modelo').addEventListener('click', () => addAuxCadastro('modelos', 'aux-new-modelo'));
}

function renderAuxCadastros() {
    const renderList = (key, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = CADASTROS_AUXILIARES[key].length > 0 ?
            `<ul class="list-group mb-2">${CADASTROS_AUXILIARES[key].map((item, index) => 
            `<li class="list-group-item list-group-item-sm py-1 d-flex justify-content-between align-items-center">${item} <button class="btn btn-sm btn-outline-danger p-0 px-2" onclick="deleteAuxCadastro('${key}', ${index})">&times;</button></li>`
            ).join('')}</ul>` : '<p class="text-muted small">Nenhum item.</p>';
    };
    renderList('tipos', 'aux-tipos-list');
    renderList('marcas', 'aux-marcas-list');
    renderList('modelos', 'aux-modelos-list');
}

function addAuxCadastro(key, inputId) {
    const input = document.getElementById(inputId);
    const value = input.value.trim();
    if (value && !CADASTROS_AUXILIARES[key].includes(value)) {
        CADASTROS_AUXILIARES[key].push(value);
        CADASTROS_AUXILIARES[key].sort();
        saveData('luckhouse_cadastros_aux', CADASTROS_AUXILIARES);
        renderAuxCadastros();
        input.value = '';
    } else { showToast("Item inválido ou já existe.", "warning"); }
}

window.deleteAuxCadastro = (key, index) => {
    CADASTROS_AUXILIARES[key].splice(index, 1);
    saveData('luckhouse_cadastros_aux', CADASTROS_AUXILIARES);
    renderAuxCadastros();
};

function populateSelectFromAux(selectId, key) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    CADASTROS_AUXILIARES[key].forEach(item => {
        select.innerHTML += `<option value="${item}">${item}</option>`;
    });
    select.value = currentVal;
}

// --- CLIENTES MODULE ---
function setupClientesModule() {
    document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('cliente-id').value;
        const cliente = {
            id: id ? parseInt(id) : getNextId(CLIENTES),
            nome: document.getElementById('cliente-nome').value,
            telefone: document.getElementById('cliente-telefone').value,
            cpf: document.getElementById('cliente-cpf').value,
            email: document.getElementById('cliente-email').value,
            endereco: document.getElementById('cliente-endereco').value,
            pontosFidelidade: parseInt(document.getElementById('cliente-pontos').value) || 0
        };
        if (!cliente.nome || !cliente.telefone) { showToast("Nome e Telefone são obrigatórios.", "warning"); return; }
        
        if (id) {
            const i = CLIENTES.findIndex(c=>c.id === parseInt(id));
            if(i > -1) CLIENTES[i] = cliente;
        } else { CLIENTES.push(cliente); }
        
        saveData('luckhouse_clientes', CLIENTES);
        renderClientList();
        populateClienteSelect();
        populatePdvClienteSelect();
        
        showToast(`Cliente ${id ? 'atualizado' : 'salvo'}!`, "success");
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalNovoCliente'));
        modalInstance?.hide();

        if (window.clientFromModalFlag === 'pdv') {
            document.getElementById('pdv-cliente-select').value = cliente.id;
        } else if (window.clientFromModalFlag === 'os') {
            const osModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovaOS'));
            populateClienteSelect();
            document.getElementById('os-cliente-select').value = cliente.id;
            osModal.show();
        }
        window.clientFromModalFlag = false;
    });
    document.getElementById('btn-search-client').addEventListener('click', filterClientList);
    document.getElementById('searchClientInput').addEventListener('keyup', filterClientList);
}

function renderClientList(list = CLIENTES) {
    const tbody = document.getElementById('client-list-tbody');
    tbody.innerHTML = list.length === 0 ? '<tr class="no-clients-message"><td colspan="5" class="text-center text-muted">Nenhum cliente.</td></tr>' : 
    list.sort((a,b)=>a.nome.localeCompare(b.nome)).map(c => 
        `<tr>
            <td data-label="Nome">${c.nome}</td>
            <td data-label="Telefone">${c.telefone||'-'}</td>
            <td data-label="CPF">${c.cpf||'-'}</td>
            <td data-label="Pontos"><i class="fas fa-star text-warning me-1"></i>${c.pontosFidelidade || 0}</td>
            <td data-label="Ações">
                <button class="btn btn-sm btn-success-custom me-1" title="WhatsApp" onclick="window.openWhatsAppModal(${c.id})"><i class="fab fa-whatsapp"></i></button>
                <button class="btn btn-sm btn-warning-custom me-1" title="Editar" onclick="window.editCliente(${c.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger-custom" title="Excluir" onclick="window.deleteCliente(${c.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`
    ).join('');
}

function filterClientList() {
    const term = document.getElementById('searchClientInput').value.toLowerCase();
    const filtered = CLIENTES.filter(c => 
        c.nome.toLowerCase().includes(term) || 
        c.telefone.toLowerCase().includes(term) || 
        (c.cpf && c.cpf.toLowerCase().includes(term))
    );
    renderClientList(filtered);
}

window.editCliente = (id) => {
    const cliente = CLIENTES.find(c => c.id === id);
    if (!cliente) return;
    const form = document.getElementById('formNovoCliente');
    form.reset();
    form.querySelector('#cliente-id').value = cliente.id;
    form.querySelector('#cliente-nome').value = cliente.nome;
    form.querySelector('#cliente-telefone').value = cliente.telefone;
    form.querySelector('#cliente-cpf').value = cliente.cpf || '';
    form.querySelector('#cliente-email').value = cliente.email || '';
    form.querySelector('#cliente-endereco').value = cliente.endereco || '';
    form.querySelector('#cliente-pontos').value = cliente.pontosFidelidade || 0;
    document.getElementById('modalNovoClienteLabelDynamic').textContent = 'Editar Cliente';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCliente')).show();
};

window.deleteCliente = (id) => { if (confirm("Excluir este cliente? Esta ação não pode ser desfeita.")) { CLIENTES = CLIENTES.filter(c => c.id !== id); saveData('luckhouse_clientes', CLIENTES); renderClientList(); showToast("Cliente excluído.", "info"); }};

function populateClienteSelect() {
    const select = document.getElementById('os-cliente-select');
    if(!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    CLIENTES.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome} (${c.telefone || 'Sem tel.'})</option>`;
    });
    select.value = currentVal;
}

function populatePdvClienteSelect() {
    const select = document.getElementById('pdv-cliente-select');
    if(!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Consumidor (Não Identificado)</option>';
    CLIENTES.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome} (CPF: ${c.cpf || 'N/A'})</option>`;
    });
    select.value = currentVal;
}

function openNewClientModal(from) {
    window.clientFromModalFlag = from;
    if (from === 'os') {
        const osModalInstance = bootstrap.Modal.getInstance(document.getElementById('modalNovaOS'));
        if (osModalInstance) {
            osModalInstance.hide();
        }
    }
    
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-pontos').value = 0;
    document.getElementById('modalNovoClienteLabelDynamic').textContent = 'Novo Cliente';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCliente')).show();
}

// --- WHATSAPP & PDF MODULE ---
function _prepareOsPdfHtml(data) {
    const { id, clienteNome, clienteTelefone, clienteCpf, clienteEmail, equipamentoSerial, problemaDescricao, acessoriosInclusos, observacoes, valorOrcamento, dataAbertura } = data;
    
    const equipFullName = data.equipamento || `${data.equipamentoTipo} ${data.equipamentoMarca} ${data.equipamentoModelo}`;
    const logoUrl = STORE_CONFIG.logoUrl || 'assets/logo.png';
    const garantiaDias = STORE_CONFIG.diasGarantiaPadrao || 90;

    return `
        <div class="pdf-page">
            <div class="pdf-header">
                <img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'"/>
                <div class="store-info">
                    <p><strong>${STORE_CONFIG.nomeLoja || ''}</strong></p>
                    <p>${STORE_CONFIG.endereco || ''}</p>
                    <p>Tel/WhatsApp: ${STORE_CONFIG.telefone || ''}</p>
                    <p>CNPJ: ${STORE_CONFIG.cnpj || ''}</p>
                </div>
            </div>

            <div class="pdf-title-section">
                <h1 class="pdf-title">ORDEM DE SERVIÇO</h1>
            </div>

            <div class="pdf-section">
                <h5>DADOS GERAIS</h5>
                <div class="pdf-grid">
                    <div class="pdf-item"><strong>Nº da OS</strong><span>${String(id).padStart(6, '0')}</span></div>
                    <div class="pdf-item"><strong>Data de Abertura</strong><span>${new Date(dataAbertura).toLocaleString('pt-BR')}</span></div>
                </div>
            </div>

            <div class="pdf-section">
                <h5>CLIENTE</h5>
                <div class="pdf-grid">
                    <div class="pdf-item"><strong>Nome</strong><span>${clienteNome || ''}</span></div>
                    <div class="pdf-item"><strong>Telefone</strong><span>${clienteTelefone || ''}</span></div>
                    <div class="pdf-item"><strong>CPF/CNPJ</strong><span>${clienteCpf || ''}</span></div>
                    <div class="pdf-item"><strong>E-mail</strong><span>${clienteEmail || ''}</span></div>
                </div>
            </div>

            <div class="pdf-section">
                <h5>EQUIPAMENTO</h5>
                <div class="pdf-grid">
                    <div class="pdf-item"><strong>Descrição</strong><span>${equipFullName}</span></div>
                    <div class="pdf-item"><strong>Nº de Série</strong><span>${equipamentoSerial || 'Não informado'}</span></div>
                    <div class="pdf-full-width-item pdf-item"><strong>Acessórios Inclusos / Estado Geral</strong><span>${acessoriosInclusos || 'Nenhum'}</span></div>
                </div>
            </div>
            
            <div class="pdf-section">
                <h5>DEFEITO E OBSERVAÇÕES</h5>
                <div class="pdf-item pdf-full-width-item"><strong>Problema Relatado pelo Cliente</strong><span>${problemaDescricao || ''}</span></div>
                <div class="pdf-item pdf-full-width-item"><strong>Laudo / Solução Técnica</strong><span>${observacoes || 'Aguardando diagnóstico.'}</span></div>
            </div>
            
            <div class="pdf-section">
                <h5>ORÇAMENTO</h5>
                <div class="pdf-item pdf-full-width-item"><strong>Valor Total</strong><span style="font-size: 14pt; font-weight: bold;">${formatCurrency(valorOrcamento)}</span></div>
            </div>

            <div class="pdf-barcode-area">
                <canvas id="os-pdf-barcode"></canvas>
            </div>
            
            <div class="pdf-terms">
                <strong>TERMOS DE SERVIÇO E GARANTIA:</strong>
                <p>1. A garantia para o serviço executado é de ${garantiaDias} dias, a contar da data de retirada, cobrindo apenas o defeito reparado. A garantia será invalidada em caso de violação do lacre, danos por mau uso, quedas, contato com líquidos ou picos de energia.</p>
                <p>2. Equipamentos não retirados em até 90 dias após a notificação de conclusão poderão ser vendidos para cobrir os custos do reparo e armazenamento, conforme Art. 644 do Código Civil.</p>
                <p>3. A ${STORE_CONFIG.nomeLoja} não se responsabiliza por eventuais perdas de dados. É de responsabilidade do cliente realizar o backup de suas informações antes de deixar o equipamento.</p>
                <p>4. Orçamentos não aprovados em até 30 dias implicarão no arquivamento da Ordem de Serviço e possível cobrança de taxa de armazenamento.</p>
            </div>
            
            <div class="pdf-signature-area">
                <div class="pdf-signature-line"></div>
                <p>Assinatura do Cliente</p>
                <small>Declaro estar ciente e de acordo com os termos acima.</small>
            </div>
        </div>
    `;
}

async function _generateOsPdf(data) {
    try {
        showToast("Gerando PDF da OS...", "info");
        const printAreaContainer = document.getElementById('os-pdf-print-area-container');
        if (!printAreaContainer || !html2canvas || !JsBarcode) {
            showToast("Erro: Módulos de geração de PDF não estão prontos.", "danger");
            return;
        }

        const osHtml = _prepareOsPdfHtml(data);
        printAreaContainer.innerHTML = osHtml;

        const barcodeCanvas = printAreaContainer.querySelector('#os-pdf-barcode');
        if (barcodeCanvas) {
            JsBarcode(barcodeCanvas, `OS-${String(data.id).padStart(6, '0')}`, {
                format: "CODE128",
                width: 2,
                height: 50,
                displayValue: true,
                fontSize: 14
            });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(printAreaContainer.querySelector('.pdf-page'), {
            scale: 2,
            useCORS: true,
            logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDFModule({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        doc.save(`OS_${String(data.id).padStart(6, '0')}_${data.clienteNome.replace(/\s/g, '_')}.pdf`);
        
        printAreaContainer.innerHTML = '';
        showToast("PDF da OS gerado com sucesso!", "success");

    } catch (e) {
        showToast(`Erro ao gerar PDF da OS: ${e.message}`, 'danger');
        console.error("Erro em _generateOsPdf:", e);
    }
}

function setupWhatsappPdfModule() {
    document.getElementById('os-list-container').addEventListener('click', function(e) {
        const button = e.target.closest('button');
        if (!button || !button.dataset.id) return;
        
        const osId = parseInt(button.dataset.id);
        if (isNaN(osId)) return;

        if (button.classList.contains('btn-os-pdf')) {
            const os = ORDENS_SERVICO.find(o => o.id === osId);
            const cliente = CLIENTES.find(c => c.id === os.clienteId);
            if (!os || !cliente) { showToast("OS ou Cliente não encontrado.", "danger"); return; }
            
            const pdfData = { 
                ...os, 
                clienteNome: cliente.nome, 
                clienteTelefone: cliente.telefone, 
                clienteCpf: cliente.cpf, 
                clienteEmail: cliente.email
            };
            
            _generateOsPdf(pdfData);

        } else if (button.classList.contains('btn-os-wpp')) {
            generateAndOpenOSWhatsAppMessage(osId);
        }
    });
}

function openWhatsAppModal(clienteId) {
    const cliente = CLIENTES.find(c => c.id === clienteId);
    if (!cliente) return;
    
    const modal = document.getElementById('modalWhatsappCliente');
    modal.querySelector('#whatsapp-cliente-id').value = cliente.id;
    modal.querySelector('#whatsapp-cliente-nome').value = cliente.nome;
    
    let template = STORE_CONFIG.templatePromocao || "Olá, {cliente_nome}! Confira nossas novidades!";
    let message = template
        .replace(/{cliente_nome}/g, cliente.nome)
        .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja);
        
    modal.querySelector('#whatsapp-message').value = message;
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

// --- PRODUTOS & SERVICOS MODULE ---
function setupProdutosModule() {
    document.getElementById('formNovoProduto').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('produto-id').value;
        const produto = {
            id: id ? parseInt(id) : getNextId(PRODUTOS),
            nome: document.getElementById('produto-nome').value,
            categoria: document.getElementById('produto-categoria').value,
            precoCusto: parseFloat(document.getElementById('produto-custo').value) || 0,
            precoVenda: parseFloat(document.getElementById('produto-preco').value),
            estoque: parseInt(document.getElementById('produto-estoque').value) || 0,
            isVideogame: document.getElementById('produto-is-videogame').checked,
            consignado: document.getElementById('produto-consignado').checked,
            tipo: 'produto'
        };
        if (!produto.nome || isNaN(produto.precoVenda)) { showToast("Nome e Preço de Venda são obrigatórios.", "warning"); return; }
        
        if (id) { const i = PRODUTOS.findIndex(p=>p.id === parseInt(id)); if(i > -1) PRODUTOS[i] = produto; }
        else { PRODUTOS.push(produto); }

        saveData('luckhouse_produtos', PRODUTOS);
        renderProductList();
        renderPdvItemList();
        showToast(`Produto ${id ? 'atualizado' : 'salvo'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovoProduto'))?.hide();
    });

    document.getElementById('formNovoServico').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('servico-id').value;
        const servico = {
            id: id ? parseInt(id) : getNextId(SERVICOS),
            nome: document.getElementById('servico-nome').value,
            descricao: document.getElementById('servico-descricao').value,
            valor: parseFloat(document.getElementById('servico-valor').value),
            custoTecnico: parseFloat(document.getElementById('servico-custo-tecnico').value) || 0,
            tipo: 'servico'
        };
        if (!servico.nome || isNaN(servico.valor)) { showToast("Nome e Valor para Cliente são obrigatórios.", "warning"); return; }
        
        if (id) { const i = SERVICOS.findIndex(s=>s.id=== parseInt(id)); if(i > -1) SERVICOS[i]=servico; }
        else { SERVICOS.push(servico); }
        
        saveData('luckhouse_servicos', SERVICOS);
        renderServiceList();
        renderPdvItemList();
        showToast(`Serviço ${id ? 'atualizado' : 'salvo'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovoServico'))?.hide();
    });
    
    document.getElementById('btn-search-prodserv').addEventListener('click', filterProductServiceList);
    document.getElementById('searchProductServiceInput').addEventListener('keyup', filterProductServiceList);
}

function renderProductList(list = PRODUTOS) {
    const tbody = document.getElementById('product-list-tbody');
    tbody.innerHTML = list.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">Nenhum produto.</td></tr>' :
    list.sort((a,b)=>a.nome.localeCompare(b.nome)).map(p => 
        `<tr>
            <td data-label="Nome">${p.nome} ${p.isVideogame ? '<i class="fas fa-gamepad text-primary-custom" title="Videogame"></i>' : ''} ${p.consignado ? '<i class="fas fa-hands-helping text-info-custom" title="Consignado"></i>' : ''}</td>
            <td data-label="Categoria">${p.categoria||'-'}</td>
            <td data-label="Custo">${formatCurrency(p.precoCusto)}</td>
            <td data-label="Venda">${formatCurrency(p.precoVenda)}</td>
            <td data-label="Estoque">${p.estoque}</td>
            <td data-label="Ações">
                <button class="btn btn-sm btn-warning-custom me-1" onclick="window.editProduto(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteProduto(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`
    ).join('');
}

window.editProduto = (id) => {
    const p = PRODUTOS.find(item => item.id === id);
    if(!p) return;
    const form = document.getElementById('formNovoProduto');
    form.reset();
    form.querySelector('#produto-id').value = p.id;
    form.querySelector('#produto-nome').value = p.nome;
    form.querySelector('#produto-categoria').value = p.categoria || '';
    form.querySelector('#produto-custo').value = p.precoCusto || 0;
    form.querySelector('#produto-preco').value = p.precoVenda;
    form.querySelector('#produto-estoque').value = p.estoque;
    form.querySelector('#produto-is-videogame').checked = p.isVideogame || false;
    form.querySelector('#produto-consignado').checked = p.consignado || false;
    document.getElementById('modalNovoProdutoLabelDynamic').textContent = 'Editar Produto';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoProduto')).show();
};

window.deleteProduto = (id) => { if(confirm('Excluir este produto?')) { PRODUTOS = PRODUTOS.filter(p => p.id !== id); saveData('luckhouse_produtos', PRODUTOS); renderProductList(); showToast('Produto excluído.', 'info'); }};

function renderServiceList(list = SERVICOS) {
    const tbody = document.getElementById('service-list-tbody');
    tbody.innerHTML = list.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Nenhum serviço.</td></tr>' :
    list.sort((a,b)=>a.nome.localeCompare(b.nome)).map(s => 
        `<tr>
            <td data-label="Nome">${s.nome}</td>
            <td data-label="Descrição">${s.descricao||'-'}</td>
            <td data-label="Custo Técnico">${formatCurrency(s.custoTecnico)}</td>
            <td data-label="Valor Cliente">${formatCurrency(s.valor)}</td>
            <td data-label="Ações">
                <button class="btn btn-sm btn-warning-custom me-1" onclick="window.editServico(${s.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteServico(${s.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`
    ).join('');
}

window.editServico = (id) => {
    const s = SERVICOS.find(item => item.id === id);
    if(!s) return;
    const form = document.getElementById('formNovoServico');
    form.reset();
    form.querySelector('#servico-id').value = s.id;
    form.querySelector('#servico-nome').value = s.nome;
    form.querySelector('#servico-descricao').value = s.descricao || '';
    form.querySelector('#servico-valor').value = s.valor;
    form.querySelector('#servico-custo-tecnico').value = s.custoTecnico || 0;
    document.getElementById('modalNovoServicoLabelDynamic').textContent = 'Editar Serviço';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoServico')).show();
};

window.deleteServico = (id) => { if(confirm('Excluir este serviço?')) { SERVICOS = SERVICOS.filter(s => s.id !== id); saveData('luckhouse_servicos', SERVICOS); renderServiceList(); showToast('Serviço excluído.', 'info'); }};

function filterProductServiceList() {
    const term = document.getElementById('searchProductServiceInput').value.toLowerCase();
    const activeTabId = document.querySelector('#myTab .nav-link.active').id;
    if (activeTabId === 'tab-produtos') {
        renderProductList(PRODUTOS.filter(p => p.nome.toLowerCase().includes(term) || (p.categoria && p.categoria.toLowerCase().includes(term))));
    } else {
        renderServiceList(SERVICOS.filter(s => s.nome.toLowerCase().includes(term)));
    }
}

// --- SOLICITAÇÕES DE ESTOQUE ---
function setupSolicitarEstoqueModule() {
    document.getElementById('btn-solicitar-estoque-modal').addEventListener('click', () => {
        const container = document.getElementById('solicitar-estoque-list');
        container.innerHTML = PRODUTOS.map(p => `
            <div class="input-group input-group-sm mb-2">
                <div class="input-group-text bg-dark-tertiary">
                    <input class="form-check-input mt-0" type="checkbox" value="${p.id}" data-nome="${p.nome}">
                </div>
                <span class="form-control">${p.nome}</span>
                <span class="input-group-text">Qtd:</span>
                <input type="number" class="form-control" value="1" min="1" style="max-width: 70px;">
            </div>
        `).join('');
    });

    document.getElementById('btn-gerar-msg-estoque-whatsapp').addEventListener('click', () => {
        const selected = document.querySelectorAll('#solicitar-estoque-list .form-check-input:checked');
        if (selected.length === 0) {
            showToast("Selecione ao menos um produto.", "warning");
            return;
        }
        if (!STORE_CONFIG.podiumGamesWhatsapp) {
            showToast("WhatsApp da Podium Games não configurado.", "danger");
            return;
        }

        const produtosSolicitados = Array.from(selected).map(chk => {
            const group = chk.closest('.input-group');
            return {
                id: chk.value,
                nome: chk.dataset.nome,
                quantidade: parseInt(group.querySelector('input[type="number"]').value) || 1
            };
        });

        const solicitacao = {
            id: getNextId(SOLICITACOES_ESTOQUE),
            data: new Date().toISOString(),
            produtos: produtosSolicitados
        };
        SOLICITACOES_ESTOQUE.push(solicitacao);
        saveData('luckhouse_solicitacoes_estoque', SOLICITACOES_ESTOQUE);
        renderSolicitacoesEstoqueList();

        const produtosListString = produtosSolicitados.map(p => `- ${p.quantidade}x ${p.nome}`).join('\n');
        let template = STORE_CONFIG.templateReqEstoque || '';
        let mensagem = template
            .replace(/{lista_produtos}/g, produtosListString)
            .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja);

        const whatsappNumber = STORE_CONFIG.podiumGamesWhatsapp.replace(/\D/g, '');
        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`, '_blank');
        bootstrap.Modal.getInstance(document.getElementById('modalSolicitarEstoque')).hide();
        showToast("Solicitação salva e mensagem gerada!", "success");
    });
}

function renderSolicitacoesEstoqueList() {
    const container = document.getElementById('solicitacoes-estoque-list-container');
    container.innerHTML = SOLICITACOES_ESTOQUE.length === 0 ? '<p class="text-muted p-2">Nenhuma solicitação de estoque encontrada.</p>' :
    [...SOLICITACOES_ESTOQUE].reverse().map(s => `
        <div class="card bg-dark-tertiary mb-2">
            <div class="card-header d-flex justify-content-between">
                <span>Solicitação #${s.id}</span>
                <span>${new Date(s.data).toLocaleString('pt-BR')}</span>
            </div>
            <div class="card-body">
                <ul class="list-unstyled">
                    ${s.produtos.map(p => `<li>${p.quantidade}x ${p.nome}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

// --- OS MODULE ---
function setupOSModule() {
    document.getElementById('formNovaOS').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('os-id').value;
        const clienteId = document.getElementById('os-cliente-select').value;
        if(!clienteId) { showToast("Selecione um cliente para a OS.", "danger"); return; }
        
        const os = {
            id: id ? parseInt(id) : getNextId(ORDENS_SERVICO),
            clienteId: parseInt(clienteId),
            status: document.getElementById('os-status').value,
            equipamentoTipo: document.getElementById('os-equip-tipo').value,
            equipamentoMarca: document.getElementById('os-equip-marca').value,
            equipamentoModelo: document.getElementById('os-equip-modelo').value,
            equipamentoSerial: document.getElementById('os-equip-serial').value,
            servicoRealizadoId: document.getElementById('os-servico-realizado-id').value ? parseInt(document.getElementById('os-servico-realizado-id').value) : null,
            problemaDescricao: document.getElementById('os-problema').value,
            diagnosticoTecnico: document.getElementById('os-diagnostico-tecnico').value,
            acessoriosInclusos: document.getElementById('os-acessorios-inclusos').value,
            observacoes: document.getElementById('os-observacoes').value,
            valorOrcamento: parseFloat(document.getElementById('os-orcamento').value) || 0,
            dataAbertura: id ? (ORDENS_SERVICO.find(o=>o.id===parseInt(id))?.dataAbertura || new Date().toISOString()) : new Date().toISOString(),
            dataConclusao: null,
            pagamentoTecnicoEfetuado: id ? (ORDENS_SERVICO.find(o=>o.id===parseInt(id))?.pagamentoTecnicoEfetuado || false) : false
        };
        if (!os.equipamentoTipo || !os.equipamentoMarca || !os.equipamentoModelo || !os.problemaDescricao || isNaN(os.valorOrcamento)) { showToast("Campos obrigatórios da OS não preenchidos.", "warning"); return; }

        if (id) { const i = ORDENS_SERVICO.findIndex(o=>o.id === parseInt(id)); if(i>-1) ORDENS_SERVICO[i]=os; else ORDENS_SERVICO.push(os); }
        else { ORDENS_SERVICO.push(os); }
        saveData('luckhouse_os', ORDENS_SERVICO);
        renderOSList();
        renderDashboardOSRecentes();
        showToast(`OS #${String(os.id).padStart(3,'0')} ${id ? 'atualizada' : 'salva'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovaOS'))?.hide();
    });
    document.getElementById('btn-search-os').addEventListener('click', filterOSList);
    document.getElementById('searchOSInput').addEventListener('keyup', filterOSList);
    document.getElementById('link-novo-cliente-from-os').addEventListener('click', (e) => { e.preventDefault(); openNewClientModal('os'); });
}

function getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]+/g,'');
    const statusClasses = {
        'aberta': 'bg-info text-dark', 'em-analise': 'bg-warning text-dark', 'aguardando-aprovacao': 'bg-primary', 
        'aprovada-em-reparo': 'bg-primary', 'aguardando-pecas': 'bg-purple', 'concluida-aguardando-retirada': 'bg-success',
        'faturada': 'bg-success-custom', 'entregue': 'bg-dark', 'cancelada': 'bg-danger', 'orcamento-reprovado': 'bg-danger'
    };
    return statusClasses[s] || 'bg-secondary';
}

function renderOSList(list = ORDENS_SERVICO) {
    const container = document.getElementById('os-list-container');
    if(!container) return;
    if (list.length === 0) { container.innerHTML = '<p class="text-muted p-2 no-os-message">Nenhuma OS encontrada.</p>'; return; }
    
    container.innerHTML = list.sort((a,b)=>b.id-a.id).map(os => {
        const cliente = CLIENTES.find(c=>c.id===os.clienteId) || {nome:'Cliente Desconhecido'};
        const canBeInvoiced = os.status === 'Concluída - Aguardando Retirada';
        return `
            <div class="list-group-item list-group-item-action bg-dark-secondary text-white mb-2 rounded shadow-sm">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1 text-primary-custom">OS #${String(os.id).padStart(3,'0')} - ${cliente.nome}</h5>
                    <span class="badge rounded-pill ${getStatusBadgeClass(os.status)}">${os.status || 'N/A'}</span>
                </div>
                <p class="mb-1"><strong>Equip:</strong> ${os.equipamentoTipo} ${os.equipamentoMarca} ${os.equipamentoModelo}</p>
                <p class="mb-1"><strong>Probl:</strong> ${os.problemaDescricao.substring(0,100)}...</p>
                <small class="text-muted">Abertura: ${new Date(os.dataAbertura).toLocaleDateString('pt-BR')} | Orçam. Cliente: ${formatCurrency(os.valorOrcamento)}</small>
                <div class="mt-2 btn-group w-100" role="group">
                    <button class="btn btn-sm btn-warning-custom" title="Editar OS" onclick="window.editOS(${os.id})"><i class="fas fa-edit me-1"></i> Editar</button>
                    <button class="btn btn-sm btn-info-custom btn-os-pdf" title="Gerar PDF da OS" data-id="${os.id}"><i class="fas fa-file-pdf me-1"></i> PDF</button>
                    <button class="btn btn-sm btn-success btn-os-wpp" title="Enviar Mensagem via WhatsApp" data-id="${os.id}"><i class="fab fa-whatsapp me-1"></i> Mensagem</button>
                </div>
                 <div class="mt-2 d-grid">
                    ${canBeInvoiced ? `<button class="btn btn-sm btn-primary-custom" onclick="window.faturarOSnoPDV(${os.id})"><i class="fas fa-dollar-sign me-1"></i> Faturar no PDV</button>` : ''}
                    <button class="btn btn-sm btn-danger-custom mt-1" onclick="window.deleteOS(${os.id})"><i class="fas fa-trash me-1"></i> Excluir</button>
                </div>
            </div>`;
    }).join('');
}

function filterOSList() {
    const term = document.getElementById('searchOSInput').value.toLowerCase();
    const filtered = ORDENS_SERVICO.filter(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId);
        return String(os.id).includes(term) ||
               (cliente && cliente.nome.toLowerCase().includes(term)) ||
               os.equipamentoTipo.toLowerCase().includes(term) ||
               os.equipamentoMarca.toLowerCase().includes(term) ||
               os.equipamentoModelo.toLowerCase().includes(term);
    });
    renderOSList(filtered);
}

function renderDashboardOSRecentes() {
    const container = document.getElementById('dashboard-os-recentes');
    if (!container) return;
    const recentes = ORDENS_SERVICO
        .filter(os => !['Entregue', 'Cancelada', 'Orçamento Reprovado', 'Faturada'].includes(os.status))
        .sort((a,b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())
        .slice(0, 5);
    if (recentes.length === 0) { container.innerHTML = '<p class="text-muted">Nenhuma OS ativa recente.</p>'; return; }
    container.innerHTML = recentes.map(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId) || { nome: 'N/A' };
        return `<a href="#" class="list-group-item list-group-item-action bg-dark-tertiary d-flex justify-content-between align-items-center" onclick="event.preventDefault(); navigateToSection('os'); setTimeout(() => window.editOS(${os.id}), 100);">
                    <span>OS #${String(os.id).padStart(3, '0')} - ${cliente.nome} (${os.equipamentoTipo})</span>
                    <span class="badge rounded-pill ${getStatusBadgeClass(os.status)}">${os.status}</span>
                </a>`;
    }).join('');
}

window.editOS = function(id) {
    const os = ORDENS_SERVICO.find(item => item.id === id);
    if (!os) { showToast("OS não encontrada.", "warning"); return; }
    const form = document.getElementById('formNovaOS');
    form.reset();
    form.querySelector('#os-id').value = os.id;
    form.querySelector('#os-cliente-select').value = os.clienteId;
    form.querySelector('#os-status').value = os.status;
    
    populateSelectFromAux('os-equip-tipo', 'tipos');
    populateSelectFromAux('os-equip-marca', 'marcas');
    populateSelectFromAux('os-equip-modelo', 'modelos');
    form.querySelector('#os-equip-tipo').value = os.equipamentoTipo;
    form.querySelector('#os-equip-marca').value = os.equipamentoMarca;
    form.querySelector('#os-equip-modelo').value = os.equipamentoModelo;

    form.querySelector('#os-equip-serial').value = os.equipamentoSerial || '';
    form.querySelector('#os-problema').value = os.problemaDescricao;
    form.querySelector('#os-diagnostico-tecnico').value = os.diagnosticoTecnico || '';
    form.querySelector('#os-acessorios-inclusos').value = os.acessoriosInclusos || '';
    form.querySelector('#os-observacoes').value = os.observacoes || '';
    form.querySelector('#os-orcamento').value = os.valorOrcamento;
    
    const servicoSelect = form.querySelector('#os-servico-realizado-id');
    servicoSelect.innerHTML = '<option value="">Nenhum/Ainda não definido</option>';
    SERVICOS.forEach(s => { servicoSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
    servicoSelect.value = os.servicoRealizadoId || '';
    
    updateTermoGarantiaPreview();
    document.getElementById('modalNovaOSLabelDynamic').textContent = `Editando OS #${String(os.id).padStart(3,'0')}`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovaOS')).show();
};

window.deleteOS = function(id) { if (confirm("Excluir esta OS?")) { ORDENS_SERVICO = ORDENS_SERVICO.filter(os => os.id !== id); saveData('luckhouse_os', ORDENS_SERVICO); renderOSList(); showToast("OS excluída.", "info"); }};

function generateAndOpenOSWhatsAppMessage(osId) {
    const os = ORDENS_SERVICO.find(o => o.id === osId);
    const cliente = os ? CLIENTES.find(c => c.id === os.clienteId) : null;
    if (!os || !cliente || !cliente.telefone) { showToast("Cliente, OS ou telefone não encontrado!", "warning"); return; }

    let template = STORE_CONFIG.templateOsCliente || '';
    let mensagem = template
        .replace(/{cliente_nome}/g, cliente.nome)
        .replace(/{os_id}/g, String(os.id).padStart(4, '0'))
        .replace(/{os_status}/g, os.status)
        .replace(/{os_equipamento}/g, `${os.equipamentoTipo} ${os.equipamentoMarca}`)
        .replace(/{os_problema}|{os-problema}/g, os.problemaDescricao) 
        .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja);

    const cleanTelefone = cliente.telefone.replace(/\D/g, '');
    const whatsappNumber = cleanTelefone.startsWith('55') ? cleanTelefone : `55${cleanTelefone}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`, '_blank');
};

window.faturarOSnoPDV = function(osId) {
    const os = ORDENS_SERVICO.find(o => o.id === osId);
    if (!os) { showToast("OS não encontrada.", "danger"); return; }

    const itemOS = {
        id: `os_${os.id}`,
        nome: `Serviço OS #${String(os.id).padStart(3,'0')} (${os.equipamentoTipo} ${os.equipamentoMarca})`,
        preco: os.valorOrcamento,
        quantidade: 1,
        tipo: 'servico_os',
        estoqueOriginal: Infinity,
        isVideogame: false,
        precoCusto: 0
    };

    if (pdvCartItems.some(item => item.id === itemOS.id)) {
        showToast("Esta OS já está no carrinho.", "warning");
        navigateToSection('pdv');
        return;
    }

    pdvCartItems.push(itemOS);
    
    populatePdvClienteSelect();
    document.getElementById('pdv-cliente-select').value = os.clienteId;
    
    navigateToSection('pdv');
    updatePdvCartUI();
    updatePdvFidelidadeUI();
    showToast(`OS #${os.id} enviada para o PDV para faturamento.`, 'success');
};


// --- PDV MODULE ---

function _prepareSaleReceiptHtml(data) {
    const { receiptId, clienteNome, itens, subtotal, desconto, total, formaPagamento, hasVideogame, logoBase64 } = data;
    
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" onerror="this.style.display='none'"/>` : `<h1 class="pdf-title" style="margin-bottom:10px;">${STORE_CONFIG.nomeLoja}</h1>`;

    let itemsTableRows = '';
    itens.forEach(item => {
        itemsTableRows += `
            <tr>
                <td>${item.quantidade}x</td>
                <td>${item.nome}</td>
                <td style="text-align: right;">${formatCurrency(item.preco * item.quantidade)}</td>
            </tr>
        `;
    });

    const garantiaTxt = hasVideogame ? `<p class="pdf-terms" style="font-size: 8pt; text-align:center; margin-top: 10px;">Garantia de ${STORE_CONFIG.diasGarantiaPadrao || 90} dias para consoles.</p>` : '';

    return `
        <div class="pdf-page" style="padding: 10mm;">
            <div class="pdf-header" style="border-bottom: 1px solid #ccc;">
                ${logoHtml}
                <div class="store-info" style="text-align:right; font-size: 8pt;">
                    <p>${STORE_CONFIG.endereco}</p>
                    <p>Tel: ${STORE_CONFIG.telefone} | CNPJ: ${STORE_CONFIG.cnpj}</p>
                </div>
            </div>
            <div style="text-align:center; margin: 15px 0;">
                <h2 style="font-size: 14pt; font-weight: bold; margin:0;">Recibo de Venda</h2>
                <p style="font-size: 9pt;">${new Date().toLocaleString('pt-BR')}</p>
            </div>
            <div class="pdf-section" style="border:none; padding:0;">
                <p><strong>Cliente:</strong> ${clienteNome}</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 10px;">
                    <thead style="border-bottom: 1px solid #333;">
                        <tr>
                            <th style="text-align: left; padding: 5px;">Qtd</th>
                            <th style="text-align: left; padding: 5px;">Descrição</th>
                            <th style="text-align: right; padding: 5px;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>${itemsTableRows}</tbody>
                </table>
                 <hr style="margin: 15px 0;">
                 <table style="width: 50%; margin-left: auto; font-size: 10pt;">
                    <tr><td>Subtotal:</td><td style="text-align: right;">${formatCurrency(subtotal)}</td></tr>
                    <tr><td>Desconto:</td><td style="text-align: right;">${formatCurrency(desconto)}</td></tr>
                    <tr><td style="font-weight: bold;">TOTAL:</td><td style="text-align: right; font-weight: bold;">${formatCurrency(total)}</td></tr>
                    <tr><td>Pagamento:</td><td style="text-align: right;">${formaPagamento}</td></tr>
                 </table>
            </div>
            ${garantiaTxt}
            <div class="pdf-barcode-area" style="margin-top: 20px;">
                <canvas id="receipt-barcode"></canvas>
            </div>
        </div>
    `;
}

async function generateSaleReceiptPdf() {
    if (pdvCartItems.length === 0) {
        showToast("Carrinho vazio.", "warning");
        return;
    }
    showToast("Gerando recibo...", "info");

    const logoBase64 = await imageToBase64(STORE_CONFIG.logoUrl);

    const clienteId = document.getElementById('pdv-cliente-select').value;
    const cliente = clienteId ? CLIENTES.find(c => c.id === parseInt(clienteId)) : null;
    const subtotal = pdvCartItems.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const discPercVal = subtotal * ( (parseFloat(document.getElementById('pdv-discount-percentage').value) || 0) / 100);
    const discPontosVal = pdvPontosDesconto.valor || 0;
    const totalDesconto = discPercVal + discPontosVal;

    const receiptData = {
        receiptId: `VENDA-${Date.now()}`,
        clienteNome: document.getElementById('pdv-receipt-client-name').value || (cliente ? cliente.nome : "Consumidor"),
        itens: pdvCartItems,
        subtotal: subtotal,
        desconto: totalDesconto,
        total: subtotal - totalDesconto,
        formaPagamento: document.getElementById('payment-method').value,
        hasVideogame: pdvCartItems.some(i => i.isVideogame),
        logoBase64: logoBase64
    };
    
    try {
        const receiptHtml = _prepareSaleReceiptHtml(receiptData);
        const printArea = document.getElementById('receipt-print-area');
        printArea.innerHTML = receiptHtml;

        JsBarcode("#receipt-barcode", receiptData.receiptId, {
            format: "CODE128", width: 2, height: 50, fontSize: 14
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(printArea.querySelector('.pdf-page'), { 
            scale: 2, useCORS: true, backgroundColor: '#ffffff'
        });
        
        if (canvas.width === 0 || canvas.height === 0) {
            throw new Error("O canvas gerado para o PDF tem dimensão zero.");
        }
        const imgData = canvas.toDataURL('image/png');
        if (!imgData || imgData === 'data:,') {
            throw new Error("Canvas gerou uma imagem vazia.");
        }

        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        const doc = new jsPDFModule('p', 'mm', 'a4');
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        doc.save(`Recibo_${receiptData.clienteNome.replace(/\s/g, '_')}.pdf`);
        
        printArea.innerHTML = '';
        showToast("Recibo gerado com sucesso!", "success");

    } catch(e) {
        showToast(`Erro ao gerar Recibo: ${e.message}`, 'danger');
        console.error("Erro em generateSaleReceiptPdf:", e);
    }
}


function setupPdvModule() {
    document.getElementById('btn-pdv-search-item').addEventListener('click', () => renderPdvItemList(document.getElementById('pdv-search-item').value));
    document.getElementById('pdv-search-item').addEventListener('keyup', () => renderPdvItemList(document.getElementById('pdv-search-item').value));
    document.getElementById('pdv-discount-percentage').addEventListener('input', updatePdvTotals);
    document.getElementById('btn-finalize-sale').addEventListener('click', finalizeSale);
    document.getElementById('btn-pdv-novo-cliente-rapido').addEventListener('click', () => openNewClientModal('pdv'));

    document.getElementById('btn-download-sale-receipt').addEventListener('click', generateSaleReceiptPdf);

    document.getElementById('formNovoItemRapidoPDV').addEventListener('submit', function(e){
        e.preventDefault();
        const nome = document.getElementById('item-rapido-nome').value;
        const preco = parseFloat(document.getElementById('item-rapido-preco').value);
        const tipo = document.getElementById('item-rapido-tipo').value;
        if (!nome || isNaN(preco) || preco <= 0) { showToast("Nome e Preço válido são obrigatórios.", "warning"); return; }
        
        let novoItem;
        if (tipo === 'produto') {
            const estoque = parseInt(document.getElementById('item-rapido-estoque').value) || 0;
            novoItem = { id: getNextId(PRODUTOS), nome, precoVenda: preco, precoCusto: 0, estoque, tipo: 'produto' };
            PRODUTOS.push(novoItem); saveData('luckhouse_produtos', PRODUTOS);
        } else {
            novoItem = { id: getNextId(SERVICOS), nome, valor: preco, custoTecnico: 0, tipo: 'servico' };
            SERVICOS.push(novoItem); saveData('luckhouse_servicos', SERVICOS);
        }
        showToast(`Item "${nome}" adicionado!`, 'success');
        window.pdvAddItemByIdAndType(novoItem.id, novoItem.tipo);
        bootstrap.Modal.getInstance(document.getElementById('modalNovoItemRapidoPDV'))?.hide();
    });

    document.getElementById('pdv-cliente-select').addEventListener('change', () => {
        const clienteId = document.getElementById('pdv-cliente-select').value;
        const cliente = clienteId ? CLIENTES.find(c => c.id === parseInt(clienteId)) : null;
        document.getElementById('pdv-receipt-client-name').value = cliente ? cliente.nome : '';
        document.getElementById('pdv-receipt-client-contact').value = cliente ? (cliente.telefone || cliente.email || '') : '';
        updatePdvFidelidadeUI();
    });

    document.getElementById('btn-resgatar-pontos').addEventListener('click', openResgatePontosModal);
}

function renderPdvItemList(searchTerm = '') {
    const listEl = document.getElementById('pdv-item-list'); if(!listEl) return;
    const term = searchTerm.toLowerCase();
    const allItems = [...PRODUTOS, ...SERVICOS];
    const filtered = searchTerm ? allItems.filter(item => item.nome.toLowerCase().includes(term)) : allItems;
    
    if (filtered.length === 0) { listEl.innerHTML = `<p class="text-muted p-2">Nenhum item encontrado.</p>`; return; }
    listEl.innerHTML = filtered.map(item => {
        const price = item.tipo === 'produto' ? item.precoVenda : item.valor;
        const disabled = item.tipo === 'produto' && item.estoque <= 0;
        return `<a href="#" class="list-group-item list-group-item-action bg-dark-tertiary ${disabled ? 'disabled' : ''}" onclick="event.preventDefault(); if(!${disabled}) window.pdvAddItemByIdAndType(${item.id}, '${item.tipo}')">
                    ${item.nome} - ${formatCurrency(price)} ${disabled ? '<span class="badge bg-danger float-end">Sem Estoque</span>' : ''}
                </a>`;
    }).join('');
}

window.pdvAddItemByIdAndType = function(itemId, itemType) {
    let itemFull = itemType === 'produto' ? PRODUTOS.find(p => p.id === itemId) : SERVICOS.find(s => s.id === itemId);
    if (!itemFull) { showToast("Item não encontrado.", "danger"); return; }
    
    const existing = pdvCartItems.find(ci => ci.id === itemFull.id && ci.tipo === itemFull.tipo);
    if(existing) { 
        if (itemType === 'produto' && existing.quantidade >= itemFull.estoque) { showToast(`Estoque máximo para "${itemFull.nome}".`, "warning"); return; }
        existing.quantidade++;
    } else { 
        pdvCartItems.push({ 
            id: itemFull.id, 
            nome: itemFull.nome, 
            preco: itemType === 'produto' ? itemFull.precoVenda : itemFull.valor, 
            quantidade: 1, 
            tipo: itemType, 
            estoqueOriginal: itemType === 'produto' ? itemFull.estoque : Infinity, 
            isVideogame: itemFull.isVideogame || false,
            precoCusto: itemFull.precoCusto || 0
        });
    }
    updatePdvCartUI();
};

function updatePdvCartUI() {
    const cartUl = document.getElementById('pdv-cart');
    if (pdvCartItems.length === 0) { cartUl.innerHTML = '<li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary text-muted">Nenhum item.</li>'; }
    else { cartUl.innerHTML = pdvCartItems.map((item, i) => `
        <li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary">
            <div>${item.nome} (x${item.quantidade}) <small class="d-block text-muted">${formatCurrency(item.preco)} cada</small></div>
            <span class="d-flex align-items-center">
                ${formatCurrency(item.preco * item.quantidade)}
                ${item.tipo !== 'servico_os' ? `
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="window.pdvDecrementItem(${i})"><i class="fas fa-minus"></i></button>
                <button class="btn btn-sm btn-outline-secondary ms-1" onclick="window.pdvIncrementItem(${i})"><i class="fas fa-plus"></i></button>
                <button class="btn btn-sm btn-danger-custom ms-2" onclick="window.pdvRemoveItem(${i})"><i class="fas fa-times"></i></button>` : ''}
            </span>
        </li>`).join('');
    }
    updatePdvTotals();
}

window.pdvIncrementItem = function(index) { const item = pdvCartItems[index]; if (item.tipo === 'produto' && item.quantidade >= item.estoqueOriginal) { showToast(`Estoque máximo.`, "warning"); return; } item.quantidade++; updatePdvCartUI(); };
window.pdvDecrementItem = function(index) { pdvCartItems[index].quantidade--; if(pdvCartItems[index].quantidade <= 0) pdvCartItems.splice(index, 1); updatePdvCartUI(); };
window.pdvRemoveItem = function(index) { pdvCartItems.splice(index, 1); updatePdvCartUI(); };

function updatePdvTotals() {
    let subtotal = pdvCartItems.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    const discPerc = parseFloat(document.getElementById('pdv-discount-percentage').value) || 0;
    const discValPercent = subtotal * (discPerc / 100);
    const discValPontos = pdvPontosDesconto.valor || 0;
    const total = subtotal - discValPercent - discValPontos;

    document.getElementById('pdv-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('pdv-discount-value').textContent = formatCurrency(discValPercent);
    document.getElementById('pdv-fidelidade-desconto').textContent = formatCurrency(discValPontos);
    document.getElementById('pdv-total').textContent = formatCurrency(total);
}

function finalizeSale() {
    if (pdvCartItems.length === 0) { showToast("Carrinho vazio.", "warning"); return; }
    
    const subtotal = pdvCartItems.reduce((s,i)=>s+(i.preco*i.quantidade),0);
    const descontoPercVal = subtotal * ( (parseFloat(document.getElementById('pdv-discount-percentage').value) || 0) / 100);
    const descontoPontos = pdvPontosDesconto.valor;
    const descontoTotal = descontoPercVal + descontoPontos;
    const total = subtotal - descontoTotal;
    const custoTotalVenda = pdvCartItems.filter(i => i.tipo === 'produto').reduce((s, i) => s + ((i.precoCusto || 0) * i.quantidade), 0);
    const clienteId = document.getElementById('pdv-cliente-select').value ? parseInt(document.getElementById('pdv-cliente-select').value) : null;

    const venda = {
        id: getNextId(VENDAS), data: new Date().toISOString(),
        clienteId: clienteId,
        receiptClientName: document.getElementById('pdv-receipt-client-name').value,
        itens: JSON.parse(JSON.stringify(pdvCartItems)),
        subtotal: subtotal,
        desconto: descontoTotal,
        pontosUsados: pdvPontosDesconto.pontos,
        total: total,
        custoTotal: custoTotalVenda,
        lucroBruto: total - custoTotalVenda,
        formaPagamento: document.getElementById('payment-method').value
    };
    VENDAS.push(venda); saveData('luckhouse_vendas', VENDAS);
    
    TRANSACOES_FINANCEIRAS.push({ id: getNextId(TRANSACOES_FINANCEIRAS), data: venda.data, descricao: `Venda #${venda.id}`, tipo: 'entrada', valor: venda.total });
    if(custoTotalVenda > 0) {
        TRANSACOES_FINANCEIRAS.push({ id: getNextId(TRANSACOES_FINANCEIRAS), data: venda.data, descricao: `Custo da Venda #${venda.id}`, tipo: 'saida', valor: custoTotalVenda });
    }
    saveData('luckhouse_transacoes', TRANSACOES_FINANCEIRAS);

    pdvCartItems.forEach(ci => {
        if (ci.tipo === 'produto') {
            const pOrig = PRODUTOS.find(p => p.id === ci.id);
            if (pOrig) pOrig.estoque -= ci.quantidade;
        } else if (ci.tipo === 'servico_os') {
            const os = ORDENS_SERVICO.find(o => o.id === parseInt(ci.id.replace('os_', '')));
            if (os) os.status = 'Faturada';
        }
    });
    saveData('luckhouse_produtos', PRODUTOS);
    saveData('luckhouse_os', ORDENS_SERVICO);

    if (clienteId) {
        const cliente = CLIENTES.find(c => c.id === clienteId);
        if (cliente) {
            cliente.pontosFidelidade = (cliente.pontosFidelidade || 0) - venda.pontosUsados;
            const pontosGanhos = Math.floor(venda.total * (STORE_CONFIG.pontosPorReal || 1));
            cliente.pontosFidelidade += pontosGanhos;
            saveData('luckhouse_clientes', CLIENTES);
        }
    }

    showToast(`Venda #${venda.id} finalizada!`, "success");
    resetPdvState();
    renderAdminDashboard();
    renderClientList();
}

function resetPdvState() {
    pdvCartItems = [];
    pdvPontosDesconto = { pontos: 0, valor: 0 };
    document.getElementById('pdv-cliente-select').value = '';
    document.getElementById('pdv-receipt-client-name').value = '';
    document.getElementById('pdv-receipt-client-contact').value = '';
    document.getElementById('pdv-discount-percentage').value = 0;
    updatePdvCartUI();
    updatePdvFidelidadeUI();
}

// --- FIDELIDADE MODULE ---
function updatePdvFidelidadeUI() {
    const fidelidadeArea = document.getElementById('pdv-fidelidade-area');
    const clienteId = document.getElementById('pdv-cliente-select').value;
    const cliente = clienteId ? CLIENTES.find(c => c.id === parseInt(clienteId)) : null;

    if (cliente && (cliente.pontosFidelidade || 0) > 0) {
        fidelidadeArea.classList.remove('d-none');
        document.getElementById('pdv-cliente-pontos').textContent = cliente.pontosFidelidade;
        document.getElementById('btn-resgatar-pontos').disabled = false;
    } else {
        fidelidadeArea.classList.add('d-none');
        document.getElementById('pdv-cliente-pontos').textContent = '0';
        document.getElementById('btn-resgatar-pontos').disabled = true;
    }
    pdvPontosDesconto = { pontos: 0, valor: 0 };
    updatePdvTotals();
}

function openResgatePontosModal() {
    const clienteId = document.getElementById('pdv-cliente-select').value;
    const cliente = CLIENTES.find(c => c.id === parseInt(clienteId));
    if (!cliente) return;
    
    const modal = document.getElementById('modalResgatarPontos');
    const { pontosParaDesconto, valorDescontoPontos } = STORE_CONFIG;
    
    document.getElementById('pontos-modal-cliente-nome').textContent = cliente.nome;
    document.getElementById('pontos-modal-saldo-atual').textContent = cliente.pontosFidelidade;
    
    const inputPontos = document.getElementById('pontos-a-resgatar');
    inputPontos.value = '';
    inputPontos.max = cliente.pontosFidelidade;
    
    document.getElementById('pontos-modal-desconto').textContent = formatCurrency(0);
    document.getElementById('pontos-modal-aviso').textContent = `Use múltiplos de ${pontosParaDesconto} pontos. Cada ${pontosParaDesconto} pontos valem ${formatCurrency(valorDescontoPontos)}.`;

    const updateDescontoPreview = () => {
        let pontos = parseInt(inputPontos.value) || 0;
        if (pontos > cliente.pontosFidelidade) {
            pontos = cliente.pontosFidelidade;
            inputPontos.value = pontos;
        }
        const resgatesPossiveis = Math.floor(pontos / pontosParaDesconto);
        const valorDesconto = resgatesPossiveis * valorDescontoPontos;
        document.getElementById('pontos-modal-desconto').textContent = formatCurrency(valorDesconto);
    };

    inputPontos.removeEventListener('input', window.lastUpdateDescontoPreview || function(){});
    window.lastUpdateDescontoPreview = updateDescontoPreview;
    inputPontos.addEventListener('input', updateDescontoPreview);

    document.getElementById('btn-aplicar-desconto-pontos').onclick = () => {
        let pontos = parseInt(inputPontos.value) || 0;
        if (pontos <= 0 || pontos > cliente.pontosFidelidade) {
            showToast("Valor de pontos inválido.", "warning");
            return;
        }
        const { pontosParaDesconto, valorDescontoPontos } = STORE_CONFIG;
        const resgatesPossiveis = Math.floor(pontos / pontosParaDesconto);
        const pontosUtilizados = resgatesPossiveis * pontosParaDesconto;
        const valorDesconto = resgatesPossiveis * valorDescontoPontos;
        
        if (valorDesconto <= 0) {
            showToast(`Você precisa de pelo menos ${pontosParaDesconto} pontos para resgatar.`, "info");
            return;
        }

        pdvPontosDesconto = { pontos: pontosUtilizados, valor: valorDesconto };
        updatePdvTotals();
        showToast(`${formatCurrency(valorDesconto)} de desconto aplicado!`, "success");
        bootstrap.Modal.getInstance(modal).hide();
    };
    
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

// --- DESPESAS MODULE (Formerly Compras) ---
function setupDespesasModule() {
    document.getElementById('formNovaDespesa').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('despesa-id').value;
        const itensDespesa = [];
        document.querySelectorAll('#despesa-itens-container .despesa-item').forEach(itemRow => {
            const nome = itemRow.querySelector('.despesa-item-nome').value;
            const quantidade = parseInt(itemRow.querySelector('.despesa-item-qtd').value);
            const custoUnitario = parseFloat(itemRow.querySelector('.despesa-item-custo').value);
            if(nome && quantidade > 0 && custoUnitario >= 0) {
                itensDespesa.push({ nome, quantidade, custoUnitario });
            }
        });

        if (itensDespesa.length === 0) {
            showToast("Adicione pelo menos um item à despesa.", "warning");
            return;
        }

        const custoTotal = itensDespesa.reduce((sum, item) => sum + (item.quantidade * item.custoUnitario), 0);
        const despesa = {
            id: id ? parseInt(id) : getNextId(DESPESAS),
            data: new Date().toISOString(),
            fornecedor: document.getElementById('despesa-fornecedor').value || 'Genérico',
            itens: itensDespesa,
            custoTotal: custoTotal
        };

        despesa.itens.forEach(itemDespesa => {
            let produto = PRODUTOS.find(p => p.nome.toLowerCase() === itemDespesa.nome.toLowerCase());
            if (produto) {
                produto.estoque += itemDespesa.quantidade;
            } else {
                PRODUTOS.push({
                    id: getNextId(PRODUTOS), nome: itemDespesa.nome, categoria: 'Geral',
                    precoCusto: itemDespesa.custoUnitario, precoVenda: itemDespesa.custoUnitario * 1.5,
                    estoque: itemDespesa.quantidade, tipo: 'produto'
                });
            }
        });
        saveData('luckhouse_produtos', PRODUTOS);

        TRANSACOES_FINANCEIRAS.push({
            id: getNextId(TRANSACOES_FINANCEIRAS), data: despesa.data,
            descricao: `Despesa #${despesa.id} (${despesa.fornecedor})`,
            tipo: 'saida', valor: despesa.custoTotal
        });
        saveData('luckhouse_transacoes', TRANSACOES_FINANCEIRAS);
        
        if (id) {
            const index = DESPESAS.findIndex(c => c.id === parseInt(id));
            if(index > -1) DESPESAS[index] = despesa;
        } else {
            DESPESAS.push(despesa);
        }
        saveData('luckhouse_despesas', DESPESAS);
        
        renderDespesasList();
        renderProductList();
        renderAdminDashboard();
        showToast(`Despesa #${despesa.id} registrada!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovaDespesa'))?.hide();
    });

    document.getElementById('btn-add-despesa-item').addEventListener('click', addDespesaItemRow);
}

function renderDespesasList() {
    const tbody = document.getElementById('despesas-list-tbody');
    tbody.innerHTML = DESPESAS.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">Nenhuma despesa registrada.</td></tr>' :
    [...DESPESAS].reverse().map(d => `
        <tr>
            <td>#${d.id}</td>
            <td>${new Date(d.data).toLocaleDateString('pt-BR')}</td>
            <td>${d.fornecedor}</td>
            <td>${d.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</td>
            <td>${formatCurrency(d.custoTotal)}</td>
            <td>
                <button class="btn btn-sm btn-danger-custom" onclick="deleteDespesa(${d.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function addDespesaItemRow(item = { nome: '', quantidade: 1, custoUnitario: 0 }) {
    const container = document.getElementById('despesa-itens-container');
    const newRow = document.createElement('div');
    newRow.className = 'row despesa-item mb-2 align-items-center';
    newRow.innerHTML = `
        <div class="col-md-5"><input type="text" class="form-control form-control-sm despesa-item-nome" placeholder="Nome do Produto/Item" value="${item.nome}" required></div>
        <div class="col-md-3"><input type="number" class="form-control form-control-sm despesa-item-qtd" placeholder="Qtd" value="${item.quantidade}" min="1" required></div>
        <div class="col-md-3"><input type="number" step="0.01" class="form-control form-control-sm despesa-item-custo" placeholder="Custo Unit." value="${item.custoUnitario}" min="0" required></div>
        <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.parentElement.remove(); updateDespesaTotalCost();">&times;</button></div>
    `;
    container.appendChild(newRow);
    newRow.querySelectorAll('input').forEach(input => input.addEventListener('input', updateDespesaTotalCost));
}

function updateDespesaTotalCost() {
    let total = 0;
    document.querySelectorAll('#despesa-itens-container .despesa-item').forEach(itemRow => {
        const quantidade = parseInt(itemRow.querySelector('.despesa-item-qtd').value) || 0;
        const custoUnitario = parseFloat(itemRow.querySelector('.despesa-item-custo').value) || 0;
        total += quantidade * custoUnitario;
    });
    document.getElementById('despesa-total-cost').textContent = formatCurrency(total);
}

function deleteDespesa(id) {
    if(confirm(`Excluir despesa #${id}? ATENÇÃO: Esta ação NÃO reverterá o estoque adicionado nem a transação financeira. A exclusão é apenas do registro.`)) {
        DESPESAS = DESPESAS.filter(c => c.id !== id);
        saveData('luckhouse_despesas', DESPESAS);
        renderDespesasList();
        showToast(`Despesa #${id} excluída.`, 'info');
    }
}


// --- ENVIO PODIUM MODULE ---
function setupEnvioPodiumModule() {
    document.getElementById('btn-gerar-ticket-podium').addEventListener('click', handleGerarTicketPodium);
    document.getElementById('btn-enviar-ticket-whatsapp').addEventListener('click', enviarTicketPodiumViaWhatsApp);
}

function renderPodiumOSList() {
    const container = document.getElementById('podium-os-list-container');
    const osProntasParaEnvio = ORDENS_SERVICO.filter(os => ['Aberta', 'Em Análise'].includes(os.status));
    if (osProntasParaEnvio.length === 0) {
        container.innerHTML = '<p class="text-muted p-2">Nenhuma OS pronta para envio.</p>';
        return;
    }
    container.innerHTML = `<ul class="list-group">${osProntasParaEnvio.map(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId);
        return `<li class="list-group-item bg-dark-tertiary">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${os.id}" id="podium-os-${os.id}">
                <label class="form-check-label" for="podium-os-${os.id}">
                    <strong>OS #${String(os.id).padStart(3, '0')}</strong> - ${cliente ? cliente.nome : 'N/A'}
                    <small class="d-block text-muted">Equip: ${os.equipamentoTipo} ${os.equipamentoMarca}</small>
                </label>
            </div></li>`;
    }).join('')}</ul>`;
}

function renderPodiumHistorico() {
    const container = document.getElementById('podium-historico-list-container');
    container.innerHTML = ENVIOS_PODIUM.length === 0 ? '<p class="text-muted p-2">Nenhum histórico de envio.</p>' :
    [...ENVIOS_PODIUM].reverse().map(envio => `
        <div class="card bg-dark-tertiary mb-2">
            <div class="card-header d-flex justify-content-between">
                <span>Envio #${envio.id}</span>
                <span>${new Date(envio.data).toLocaleString('pt-BR')}</span>
            </div>
            <div class="card-body">
                <p class="card-text mb-1"><strong>OSs Enviadas:</strong> ${envio.osIds.join(', ')}</p>
                <p class="card-text"><strong>Total de Itens:</strong> ${envio.osIds.length}</p>
            </div>
        </div>
    `).join('');
}

function getSelectedEntregas() {
    const checkedBoxes = document.querySelectorAll('#podium-os-list-container .form-check-input:checked');
    if (checkedBoxes.length === 0) {
        showToast("Selecione ao menos uma OS para o envio.", "warning");
        return null;
    }
    const osIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    return osIds.map(id => {
        const os = ORDENS_SERVICO.find(o => o.id === id);
        const cliente = CLIENTES.find(c => c.id === os?.clienteId);
        return { os, cliente };
    }).filter(e => e.os && e.cliente);
}

async function handleGerarTicketPodium() {
    const entregas = getSelectedEntregas();
    if (!entregas || entregas.length === 0) return;

    const envio = {
        id: getNextId(ENVIOS_PODIUM),
        data: new Date().toISOString(),
        osIds: entregas.map(e => e.os.id)
    };
    
    showToast("Gerando comprovante PDF...", "info");
    
    try {
        const ticketHtml = await preparePodiumTicketHtml(entregas, envio.id);
        const printAreaContainer = document.getElementById('podium-ticket-print-area-container');
        const printArea = printAreaContainer.querySelector('#podium-ticket-print-area');
        printArea.innerHTML = ticketHtml;
        printArea.style.width = '210mm';

        const canvas = await html2canvas(printArea, {
            scale: 2,
            useCORS: true
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        const doc = new jsPDFModule('p', 'mm', 'a4');
        let position = 0;

        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        doc.save(`Comprovante_Envio_Podium_${envio.id}.pdf`);

        ENVIOS_PODIUM.push(envio);
        saveData('luckhouse_envios_podium', ENVIOS_PODIUM);
        showToast("Comprovante PDF gerado!", "success");
        renderPodiumHistorico();
        printArea.innerHTML = '';

    } catch (error) {
        console.error("Erro ao gerar PDF com html2canvas:", error);
        showToast(`Erro ao gerar PDF: ${error.message}`, "danger");
    }
}


async function enviarTicketPodiumViaWhatsApp() {
    const entregas = getSelectedEntregas();
    if (!entregas) return;

    const targetWhatsapp = STORE_CONFIG.whatsappEnvioTicket;
    if (!targetWhatsapp) {
        showToast("WhatsApp para envio de tickets não configurado!", "danger");
        return;
    }

    let message = `*COMPROVANTE DE ENVIO - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
    message += `*De:* ${STORE_CONFIG.nomeLoja}\n`;
    message += `*Para:* Podium Games\n\n`;
    message += `Itens enviados para análise/reparo:\n`;
    
    entregas.forEach(entrega => {
        message += `\n----------------------------------\n`;
        message += `*OS Ref.:* #${String(entrega.os.id).padStart(3, '0')}\n`;
        message += `*Cliente Final:* ${entrega.cliente.nome}\n`;
        message += `*Equipamento:* ${entrega.os.equipamentoTipo} ${entrega.os.equipamentoMarca} ${entrega.os.equipamentoModelo}\n`;
        message += `*Serial:* ${entrega.os.equipamentoSerial || 'N/A'}\n`;
        message += `*Problema:* ${entrega.os.problemaDescricao}\n`;
    });
    
    const cleanTelefone = targetWhatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanTelefone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

async function preparePodiumTicketHtml(entregas, envioId) {
    let html = `<div style="font-family: monospace; font-size: 10pt; color: #000; width: 100%;">`;
    html += `<h3 style="text-align: center; margin-bottom: 5px;">COMPROVANTE DE ENVIO</h3>`;
    html += `<p style="text-align: center; font-size: 9pt;">Envio #${envioId} | Data: ${new Date().toLocaleString('pt-BR')}</p><hr>`;
    html += `<p><strong>Remetente:</strong> ${STORE_CONFIG.nomeLoja}</p>`;
    html += `<p><strong>Recebedor:</strong> Podium Games</p><hr>`;
    
    const barcodeValue = `ENV-${String(envioId).padStart(5, '0')}`;
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, barcodeValue, { format: "CODE128", displayValue: true, fontSize: 10, height: 30, textMargin: 0 });
    html += `<div style="text-align:center; margin: 10px 0;"><img src="${canvas.toDataURL('image/png')}" /></div><hr>`;

    entregas.forEach((entrega) => {
        html += `<div style="margin-top: 10px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">`;
        html += `<p><strong>OS Ref.:</strong> #${String(entrega.os.id).padStart(3, '0')}</p>`;
        html += `<p><strong>Cliente Final:</strong> ${entrega.cliente.nome}</p>`;
        html += `<p><strong>Equip.:</strong> ${entrega.os.equipamentoTipo} ${entrega.os.equipamentoMarca} ${entrega.os.equipamentoModelo}</p>`;
        html += `<p><strong>Serial:</strong> ${entrega.os.equipamentoSerial || 'N/A'}</p>`;
        html += `<p><strong>Problema:</strong> ${entrega.os.problemaDescricao}</p>`;
        html += `</div>`;
    });
    html += `<div style="margin-top: 25px; page-break-before: auto;">`;
    html += `<p><strong>Ass. Recebedor:</strong></p>`;
    html += `<div style="border-bottom: 1px solid #000; height: 40px; margin-top: 5px;"></div>`;
    html += `</div>`;
    
    html += `</div>`;
    return html;
}

// --- ADMIN AREA ---
function renderAdminDashboard() {
    if (CURRENT_USER.role !== 'admin' || document.querySelector('#admin-area').classList.contains('d-none')) return;
    
    const faturamentoBruto = TRANSACOES_FINANCEIRAS.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
    const custosOperacionais = TRANSACOES_FINANCEIRAS.filter(t => t.tipo === 'saida' && (t.descricao.toLowerCase().includes('técnico') || t.descricao.toLowerCase().includes('despesa'))).reduce((sum, t) => sum + t.valor, 0);
    const custoVendas = TRANSACOES_FINANCEIRAS.filter(t => t.tipo === 'saida' && t.descricao.toLowerCase().includes('custo da venda')).reduce((sum, t) => sum + t.valor, 0);
    const lucroLiquido = faturamentoBruto - custosOperacionais - custoVendas;

    document.getElementById('admin-faturamento-total').textContent = formatCurrency(faturamentoBruto);
    document.getElementById('admin-custo-vendas-total').textContent = formatCurrency(custoVendas);
    document.getElementById('admin-custos-total').textContent = formatCurrency(custosOperacionais);
    document.getElementById('admin-lucro-total').textContent = formatCurrency(lucroLiquido);
    
    renderSalesChart();
    renderContasAPagar();
    renderContasAReceber();
    renderFluxoDeCaixa();
}

function renderSalesChart() {
    const canvas = document.getElementById('salesChartCanvas');
    if (!canvas || !ChartJS) return;
    const ultimasVendas = VENDAS.slice(-10);
    const labels = ultimasVendas.map(v => `V#${v.id}`);
    const data = {
        labels,
        datasets: [{
            label: 'Valor da Venda (R$)',
            data: ultimasVendas.map(v => v.total),
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1
        }]
    };
    
    const isLightTheme = document.body.classList.contains('light-theme');
    const tickColor = isLightTheme ? '#000' : '#fff';

    const options = {
        scales: {
            y: { ticks: { color: tickColor }, grid: { color: isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' } },
            x: { ticks: { color: tickColor }, grid: { color: isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' } }
        },
        plugins: {
            legend: { labels: { color: tickColor } }
        }
    };
    
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new ChartJS(canvas, { type: 'bar', data, options });
}

function renderContasAPagar() {
    const tbody = document.getElementById('payable-list-tbody');
    const pagamentosPendentes = ORDENS_SERVICO.filter(os => 
        os.servicoRealizadoId && !os.pagamentoTecnicoEfetuado && ['Concluída - Aguardando Retirada', 'Faturada', 'Entregue'].includes(os.status)
    );
    if (pagamentosPendentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum pagamento pendente.</td></tr>';
        return;
    }
    tbody.innerHTML = pagamentosPendentes.map(os => {
        const servico = SERVICOS.find(s => s.id === os.servicoRealizadoId);
        const cliente = CLIENTES.find(c => c.id === os.clienteId);
        if (!servico || servico.custoTecnico <= 0) return '';
        return `<tr>
            <td>${String(os.id).padStart(3, '0')}</td>
            <td>${servico.nome}</td>
            <td>${cliente ? cliente.nome : 'N/A'}</td>
            <td>${formatCurrency(servico.custoTecnico)}</td>
            <td><span class="badge bg-warning text-dark">Pendente</span></td>
            <td><button class="btn btn-sm btn-success-custom" onclick="marcarComoPago(${os.id})">Marcar Pago</button></td>
        </tr>`;
    }).join('');
}

window.marcarComoPago = (osId) => {
    const os = ORDENS_SERVICO.find(o => o.id === osId);
    const servico = os ? SERVICOS.find(s => s.id === os.servicoRealizadoId) : null;
    if (!os || !servico || servico.custoTecnico <= 0) { showToast("Erro ao processar pagamento.", "danger"); return; }
    
    if (confirm(`Confirmar pagamento de ${formatCurrency(servico.custoTecnico)} para a OS #${os.id}?`)) {
        os.pagamentoTecnicoEfetuado = true;
        const transacao = {
            id: getNextId(TRANSACOES_FINANCEIRAS), data: new Date().toISOString(),
            descricao: `Pagamento Técnico OS #${os.id} (${servico.nome})`,
            tipo: 'saida', valor: servico.custoTecnico
        };
        TRANSACOES_FINANCEIRAS.push(transacao);
        saveData('luckhouse_transacoes', TRANSACOES_FINANCEIRAS);
        saveData('luckhouse_os', ORDENS_SERVICO);
        showToast("Pagamento registrado com sucesso!", "success");
        renderAdminDashboard();
    }
}

function renderContasAReceber() {
    const container = document.getElementById('receivable-list-container');
    const osAReceber = ORDENS_SERVICO.filter(os => os.status === 'Concluída - Aguardando Retirada');
    if (osAReceber.length === 0) {
        container.innerHTML = '<p class="text-muted p-2">Nenhuma conta a receber de OS.</p>';
        return;
    }
    container.innerHTML = osAReceber.map(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId) || {nome: 'N/A'};
        return `<div class="list-group-item bg-dark-tertiary d-flex justify-content-between align-items-center">
            <span>OS #${String(os.id).padStart(3, '0')} - ${cliente.nome}</span>
            <strong class="text-success">${formatCurrency(os.valorOrcamento)}</strong>
        </div>`;
    }).join('');
}

function renderFluxoDeCaixa() {
    const tbody = document.getElementById('cashflow-list-tbody');
    if (TRANSACOES_FINANCEIRAS.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhuma transação.</td></tr>';
        return;
    }
    tbody.innerHTML = [...TRANSACOES_FINANCEIRAS].sort((a,b) => new Date(b.data) - new Date(a.data)).map(t => {
        const isEntrada = t.tipo === 'entrada';
        return `<tr>
            <td>${new Date(t.data).toLocaleString('pt-BR')}</td>
            <td>${t.descricao}</td>
            <td><span class="badge ${isEntrada ? 'bg-success' : 'bg-danger'}">${isEntrada ? 'Entrada' : 'Saída'}</span></td>
            <td class="${isEntrada ? 'text-success-custom' : 'text-danger-custom'}">${formatCurrency(t.valor)}</td>
        </tr>`;
    }).join('');
}

function exportVendasCSV() {
    if (VENDAS.length === 0) { showToast("Nenhuma venda para exportar.", "info"); return; }
    let csvContent = "ID Venda;Data;Cliente;Itens;Subtotal;Desconto;Pontos Usados;Total;Custo Produtos;Lucro Bruto;Forma Pagamento\n";
    VENDAS.forEach(v => {
        const itensString = v.itens.map(item => `${item.quantidade}x ${item.nome}`).join(' | ');
        const row = [ v.id, `"${new Date(v.data).toLocaleString('pt-BR')}"`, `"${v.receiptClientName || ''}"`,
                      `"${itensString}"`, v.subtotal.toFixed(2), v.desconto.toFixed(2), v.pontosUsados || 0, v.total.toFixed(2),
                      v.custoTotal.toFixed(2), v.lucroBruto.toFixed(2), `"${v.formaPagamento}"` ].join(';');
        csvContent += row + "\n";
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// --- BACKUP & RESTORE MODULE ---
function setupBackupRestoreModule() {
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('btn-reset-data').addEventListener('click', resetAllDataWarning);
}

function exportData() {
    const dataToExport = {
        config: STORE_CONFIG, clientes: CLIENTES, produtos: PRODUTOS, servicos: SERVICOS,
        os: ORDENS_SERVICO, vendas: VENDAS, cadastros_aux: CADASTROS_AUXILIARES, transacoes: TRANSACOES_FINANCEIRAS,
        despesas: DESPESAS, envios_podium: ENVIOS_PODIUM, solicitacoes_estoque: SOLICITACOES_ESTOQUE
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `luckhouse_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Backup exportado com sucesso!", "success");
}

function importData(event) {
    const file = event.target.files[0];
    if (file && confirm("IMPORTANTE: Isso substituirá todos os dados atuais. Deseja continuar?")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.config && imported.clientes && imported.os) {
                    saveData('luckhouse_config', imported.config || {});
                    saveData('luckhouse_clientes', imported.clientes || []);
                    saveData('luckhouse_produtos', imported.produtos || []);
                    saveData('luckhouse_servicos', imported.servicos || []);
                    saveData('luckhouse_os', imported.os || []);
                    saveData('luckhouse_vendas', imported.vendas || []);
                    saveData('luckhouse_cadastros_aux', imported.cadastros_aux || { tipos: [], marcas: [], modelos: [] });
                    saveData('luckhouse_transacoes', imported.transacoes || []);
                    saveData('luckhouse_despesas', imported.despesas || imported.compras || []);
                    saveData('luckhouse_envios_podium', imported.envios_podium || []);
                    saveData('luckhouse_solicitacoes_estoque', imported.solicitacoes_estoque || []);
                    
                    showToast("Dados importados! A página será recarregada.", "success");
                    setTimeout(() => location.reload(), 1500);
                } else { showToast("Arquivo de backup inválido.", "danger"); }
            } catch (err) { showToast("Erro ao processar backup: " + err.message, "danger"); }
            finally { event.target.value = null; }
        };
        reader.readAsText(file);
    }
}

function resetAllDataWarning() {
    if (prompt("ATENÇÃO! Para apagar TODOS os dados, digite 'DELETAR TUDO':") === "DELETAR TUDO") {
        Object.keys(localStorage).filter(k => k.startsWith('luckhouse_')).forEach(k => localStorage.removeItem(k));
        showToast("TODOS OS DADOS FORAM APAGADOS!", "danger");
        setTimeout(() => location.reload(), 2000);
    } else { showToast("Ação cancelada.", "info"); }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("Iniciando Luckhouse Games System v4.0 (Final)...");
    try {
        const el = id => document.getElementById(id);
        el('currentYear').textContent = new Date().getFullYear();
        el('footerCurrentYear').textContent = new Date().getFullYear();
        
        loadAllData();
        setupTheme();
        
        el('formLogin').addEventListener('submit', handleLogin);
        el('logout-button').addEventListener('click', handleLogout);
        el('menu-toggle').addEventListener('click', () => el('wrapper').classList.toggle('toggled'));
        
        document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navigateToSection(this.dataset.target, this);
                if (window.innerWidth < 768) el('wrapper').classList.remove('toggled');
            });
        });
        document.querySelectorAll('.dashboard-card').forEach(card => {
            card.addEventListener('click', function() {
                if(this.id === 'card-nova-os') {
                    document.getElementById('formNovaOS').reset();
                    document.getElementById('modalNovaOSLabelDynamic').textContent = 'Nova Ordem de Serviço';
                    bootstrap.Modal.getOrCreateInstance(el('modalNovaOS')).show();
                } else if (this.dataset.target) {
                    navigateToSection(this.dataset.target);
                }
            });
        });
        
        // Setup de todos os módulos
        setupConfiguracoesModule();
        setupClientesModule();
        setupWhatsappPdfModule();
        setupProdutosModule();
        setupSolicitarEstoqueModule();
        setupOSModule();
        setupPdvModule();
        setupDespesasModule();
        setupEnvioPodiumModule();
        setupBackupRestoreModule();

        el('modalNovaOS').addEventListener('show.bs.modal', () => {
             populateSelectFromAux('os-equip-tipo', 'tipos');
             populateSelectFromAux('os-equip-marca', 'marcas');
             populateSelectFromAux('os-equip-modelo', 'modelos');
             const servicoSelect = document.getElementById('os-servico-realizado-id');
             servicoSelect.innerHTML = '<option value="">Nenhum/Ainda não definido</option>';
             SERVICOS.forEach(s => { servicoSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
        });
        
        el('modalNovaDespesa').addEventListener('show.bs.modal', () => {
             document.getElementById('formNovaDespesa').reset();
             document.getElementById('despesa-itens-container').innerHTML = '';
             addDespesaItemRow();
             updateDespesaTotalCost();
        });

        document.querySelectorAll('.modal').forEach(modal => {
             modal.addEventListener('hidden.bs.modal', function() {
                 const form = this.querySelector('form');
                 if (form && form.id !== 'formPdfData') form.reset();
             });
        });

        el('btn-export-vendas-csv').addEventListener('click', exportVendasCSV);
        el('btn-novo-cliente-modal').addEventListener('click', () => openNewClientModal(''));
        el('btn-nova-os-modal').addEventListener('click', () => {
             document.getElementById('formNovaOS').reset();
             document.getElementById('modalNovaOSLabelDynamic').textContent = 'Nova Ordem de Serviço';
        });
        el('btn-nova-despesa-modal').addEventListener('click', () => {
             document.getElementById('formNovaDespesa').reset();
             document.getElementById('modalNovaDespesaLabel').textContent = 'Registrar Nova Despesa';
        });

        checkLoginState();
    } catch (error) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", error);
        document.body.innerHTML = `<div class='vh-100 d-flex flex-column align-items-center justify-content-center text-center'><h1 class='text-danger'>Erro Crítico na Aplicação.</h1><p>Limpe os dados do site (cache/localStorage) e tente novamente.</p><p class="text-muted small mt-3">Detalhe: ${error.message}</p></div>`;
    }
});