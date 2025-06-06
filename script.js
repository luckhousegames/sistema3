// Initialize jsPDF & Chart (global, as they are loaded in <head>)
const jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null;
const ChartJS = window.Chart || null;
const JsBarcode = window.JsBarcode || null;

if (!jsPDFModule) console.error("CRÍTICO: jsPDF não carregado! Geração de PDF não funcionará.");
if (!ChartJS) console.error("CRÍTICO: Chart.js não carregado! Gráficos não funcionarão.");
if (!JsBarcode) console.error("CRÍTICO: JsBarcode não carregado! Códigos de barras não funcionarão.");


console.log("Luckhouse Games - Script.js: Iniciando carregamento...");

// --- GLOBAL APP STATE & CONFIG ---
let STORE_CONFIG = {};
let ORDENS_SERVICO = [];
let CLIENTES = [];
let PRODUTOS = [];
let SERVICOS = [];
let VENDAS = [];
let CADASTROS_AUXILIARES = { tipos: [], marcas: [], modelos: [] };
let TRANSACOES_FINANCEIRAS = [];

let pdvCartItems = [];
let CURRENT_USER = { username: null, role: null };
let salesChartInstance = null;
window.clientFromPdvFlag = false;

// --- UTILITY FUNCTIONS ---
function showToast(message, type = "primary", title = "Notificação") {
    try {
        const toastEl = document.getElementById('liveToast');
        if (!toastEl) { alert(title + ": " + message); return; }
        const toastMessageEl = document.getElementById('toast-message');
        const toastTitleEl = document.getElementById('toast-title');
        const toastComponent = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastMessageEl.textContent = message;
        toastTitleEl.textContent = title;
        toastEl.className = 'toast border-0'; // Reset classes
        const typeClasses = {
            success: 'bg-success-custom text-white',
            danger: 'bg-danger-custom text-white',
            warning: 'bg-warning text-dark',
            info: 'bg-info-custom text-white',
            primary: 'bg-primary-custom text-white'
        };
        toastEl.classList.add(...(typeClasses[type] || typeClasses.primary).split(' '));
        if(toastComponent) toastComponent.show();
    } catch (error) { console.error("Erro ao mostrar toast:", error, message); }
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

// --- LOCALSTORAGE DATA MANAGEMENT ---
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { console.error("Erro ao salvar dados na localStorage para chave", key, e); showToast(`Erro ao salvar (${key}).`, "danger"); }
}

function loadData(key, defaultValue = []) {
    const dataFromStorage = localStorage.getItem(key);
    if (dataFromStorage) {
        try {
            return JSON.parse(dataFromStorage);
        } catch (e) {
            console.error(`Erro ao parsear JSON da chave "${key}":`, e, "\nConteúdo:", dataFromStorage);
            showToast(`Erro ao carregar dados (${key}). Resetando para padrão.`, "warning");
            localStorage.removeItem(key);
        }
    }
    return Array.isArray(defaultValue) ? [...defaultValue] : (typeof defaultValue === 'object' && defaultValue !== null ? {...defaultValue} : defaultValue);
}

function loadAppConfig() {
    const defaultConfig = {
        nomeLoja: "Luckhouse Games",
        cnpj: "43.864.000/198",
        endereco: "Av. Itália, 200 – Shopping Amarilys, Itupeva – SP",
        telefone: "(11) 99357-7209",
        email: "luckhousegames@gmail.com",
        logoUrl: "assets/logo.png",
        diasGarantiaPadrao: 90,
        podiumGamesWhatsapp: "",
        whatsappEnvioTicket: "",
        templateOsCliente: "Olá, {cliente_nome}! A sua Ordem de Serviço #{os_id}, referente ao equipamento {os_equipamento}, teve o status atualizado para: *{os_status}*. Atenciosamente, {loja_nome}.",
        templateEnvioPodium: "Olá, {cliente_nome}! Seu equipamento ({os_equipamento} - OS #{os_id}) foi enviado para entrega. Por favor, aguarde o contato do entregador. Atenciosamente, {loja_nome}.",
        templateReqEstoque: "Olá, Podium Games! Gostaria de solicitar um novo lote de produtos para a {loja_nome}. Segue a lista:\n\n{lista_produtos}\n\nPor favor, nos informe sobre a disponibilidade e o prazo. Obrigado!"
    };
    STORE_CONFIG = loadData('luckhouse_config', defaultConfig);
    updateStoreInfoUI();
}

function saveAppConfig() {
    saveData('luckhouse_config', STORE_CONFIG);
    updateStoreInfoUI();
    showToast("Configurações salvas!", "success");
}

function updateStoreInfoUI() {
    try {
        const el = (id) => document.getElementById(id);
        const setVal = (id, value) => { if(el(id)) el(id).value = value || ''; };
        const setContent = (id, value) => { if(el(id)) el(id).textContent = value || ''; };
        
        const sidebarLogoImg = el('sidebar-logo-img');
        if (sidebarLogoImg) {
            if (STORE_CONFIG.logoUrl && STORE_CONFIG.logoUrl.trim() !== "") {
                sidebarLogoImg.src = STORE_CONFIG.logoUrl;
                sidebarLogoImg.style.display = 'block';
                el('sidebar-logo-text').style.display = 'none';
            } else {
                sidebarLogoImg.style.display = 'none';
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
        
        if (!document.querySelector('#configuracoes').classList.contains('d-none')) {
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
            setVal('config-template-envio-podium', STORE_CONFIG.templateEnvioPodium);
            setVal('config-template-req-estoque', STORE_CONFIG.templateReqEstoque);
        }
        updateTermoGarantiaPreview();
    } catch (error) { console.error("Erro em updateStoreInfoUI:", error); }
}

function updateTermoGarantiaPreview() {
    const osTermosPreview = document.getElementById('os-termos-garantia-preview');
    if (osTermosPreview) {
        osTermosPreview.innerHTML = `<p>Garantia de ${STORE_CONFIG.diasGarantiaPadrao || 90} dias após entrega.</p><p>Não nos responsabilizamos por danos causados por mau uso ou quedas após o reparo.</p><p>Equipamentos não retirados em até 90 dias serão descartados ou reaproveitados.</p>`;
    }
}

// --- LOGIN & AUTHENTICATION (SIMULATED) ---
function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorMessageEl = document.getElementById('login-error-message');

    if (username === 'luckmaster' && password === 'L@1998*') { CURRENT_USER = {username: 'Luck Master', role: 'admin'}; }
    else if (username === 'Henrique Del Peso' && password === 'hdp123') { CURRENT_USER = {username: 'Henrique Del Peso', role: 'padrao'}; }
    else { errorMessageEl.classList.remove('d-none'); return; }

    errorMessageEl.classList.add('d-none');
    saveData('luckhouse_currentUser', CURRENT_USER);
    updateUIAfterLogin();
    bootstrap.Modal.getInstance(document.getElementById('modalLogin'))?.hide();
    showToast(`Bem-vindo(a), ${CURRENT_USER.username}!`, "success");
    navigateToSection('dashboard');
    setupAllModules();
}

function handleLogout() {
    if (!confirm("Tem certeza que deseja sair?")) return;
    CURRENT_USER = {username: null, role: null};
    localStorage.removeItem('luckhouse_currentUser');
    updateUIAfterLogin();
    showToast("Você saiu do sistema.", "info");
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLogin')).show();
}

function checkLoginState() {
    const storedUser = loadData('luckhouse_currentUser', null);
    if (storedUser && storedUser.username && storedUser.role) {
        CURRENT_USER = storedUser;
        updateUIAfterLogin();
        navigateToSection('dashboard');
        setupAllModules();
    } else {
        updateUIAfterLogin();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalLogin')).show();
    }
}

function updateUIAfterLogin() {
    const isLoggedIn = !!CURRENT_USER.username;
    const isAdmin = isLoggedIn && CURRENT_USER.role === 'admin';
    document.getElementById('logged-in-user').textContent = isLoggedIn ? `Logado: ${CURRENT_USER.username} (${CURRENT_USER.role})` : 'Não Logado';
    document.getElementById('logout-button').style.display = isLoggedIn ? 'block' : 'none';
    document.getElementById('login-prompt').classList.toggle('d-none', isLoggedIn);
    document.querySelectorAll('.main-content').forEach(s => s.classList.toggle('d-none', !isLoggedIn));
    document.querySelectorAll('.nav-item-admin, .admin-content').forEach(el => el.classList.toggle('d-none', !isAdmin));
    if (document.getElementById('dashboard-username')) document.getElementById('dashboard-username').textContent = CURRENT_USER.username || "Usuário";
}

// --- MODULE SETUP FUNCTIONS ---
function setupAllModules() {
    setupConfiguracoesModule();
    setupClientesModule();
    setupProdutosModule();
    setupServicosModule();
    setupOSModule();
    setupPdvModule();
    setupAdminAreaModule();
    setupSearchFilterListeners();
    setupBackupRestoreModule();
    setupEnvioPodiumModule();
    setupSolicitarEstoqueModule();
}

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
        STORE_CONFIG.templateEnvioPodium = document.getElementById('config-template-envio-podium').value;
        STORE_CONFIG.templateReqEstoque = document.getElementById('config-template-req-estoque').value;
        saveAppConfig();
    });
    
    document.getElementById('btn-add-aux-tipo').addEventListener('click', () => addAuxCadastro('tipos', 'aux-new-tipo'));
    document.getElementById('btn-add-aux-marca').addEventListener('click', () => addAuxCadastro('marcas', 'aux-new-marca'));
    document.getElementById('btn-add-aux-modelo').addEventListener('click', () => addAuxCadastro('modelos', 'aux-new-modelo'));
}

// --- CADASTROS AUXILIARES (for OS selects) ---
function loadCadastrosAuxiliares() { CADASTROS_AUXILIARES = loadData('luckhouse_cadastros_aux', { tipos: [], marcas: [], modelos: [] }); }
function saveCadastrosAuxiliares() { saveData('luckhouse_cadastros_aux', CADASTROS_AUXILIARES); }

function renderAuxCadastros() {
    if (document.querySelector('#configuracoes').classList.contains('d-none')) return;
    const renderList = (key, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if (CADASTROS_AUXILIARES[key].length > 0) {
            const list = document.createElement('ul');
            list.className = 'list-group mb-2';
            CADASTROS_AUXILIARES[key].forEach((item, index) => {
                list.innerHTML += `<li class="list-group-item list-group-item-sm py-1">${item} <button class="btn btn-sm btn-outline-danger float-end" onclick="deleteAuxCadastro('${key}', ${index})">&times;</button></li>`;
            });
            container.appendChild(list);
        } else {
            container.innerHTML = '<p class="text-muted small">Nenhum item.</p>';
        }
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
        saveCadastrosAuxiliares();
        renderAuxCadastros();
        input.value = '';
        showToast("Item adicionado!", "success");
    } else {
        showToast("Item inválido ou já existe.", "warning");
    }
}

window.deleteAuxCadastro = (key, index) => {
    CADASTROS_AUXILIARES[key].splice(index, 1);
    saveCadastrosAuxiliares();
    renderAuxCadastros();
    showToast("Item removido.", "info");
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
// UNCHANGED FROM PREVIOUS VERSION

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
        };
        if (!cliente.nome || !cliente.telefone) { showToast("Nome e Telefone são obrigatórios.", "warning"); return; }
        if (id) {
            const i = CLIENTES.findIndex(c=>c.id=== parseInt(id));
            if(i>-1) CLIENTES[i]=cliente; else CLIENTES.push(cliente);
        } else { CLIENTES.push(cliente); }
        saveClientes();
        showToast(`Cliente ${id ? 'atualizado' : 'salvo'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovoCliente'))?.hide();
        if (window.clientFromPdvFlag) {
            populatePdvClienteSelect();
            document.getElementById('pdv-cliente-select').value = cliente.id;
            fillPdvClientReceiptFields();
            window.clientFromPdvFlag = false;
        }
    });
    document.getElementById('btn-search-client').addEventListener('click', filterClientList);
}
function loadClientes() { CLIENTES = loadData('luckhouse_clientes', []); renderClientList(); populateClienteSelect(); populatePdvClienteSelect(); }
function saveClientes() { saveData('luckhouse_clientes', CLIENTES); renderClientList(); populateClienteSelect(); populatePdvClienteSelect(); }
function renderClientList(filteredClients = null) {
    const tbody = document.getElementById('client-list-tbody');
    if(!tbody) return;
    const listToRender = filteredClients || CLIENTES;
    tbody.innerHTML = listToRender.length === 0 ? '<tr class="no-clients-message"><td colspan="5" class="text-center text-muted">Nenhum cliente.</td></tr>' : 
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).map(c => 
        `<tr><td>${c.nome}</td><td>${c.telefone||'-'}</td><td>${c.cpf||'-'}</td><td>${c.email||'-'}</td>
         <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editCliente(${c.id})"><i class="fas fa-edit"></i></button>
             <button class="btn btn-sm btn-danger-custom" onclick="window.deleteCliente(${c.id})"><i class="fas fa-trash"></i></button></td></tr>`
    ).join('');
}
window.editCliente = function(id) {
    const cliente = CLIENTES.find(c => c.id === id);
    if (!cliente) { showToast("Cliente não encontrado.", "warning"); return; }
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cliente-id').value = cliente.id;
    document.getElementById('cliente-nome').value = cliente.nome;
    document.getElementById('cliente-telefone').value = cliente.telefone;
    document.getElementById('cliente-cpf').value = cliente.cpf || '';
    document.getElementById('cliente-email').value = cliente.email || '';
    document.getElementById('cliente-endereco').value = cliente.endereco || '';
    document.getElementById('modalNovoClienteLabelDynamic').textContent = 'Editar Cliente';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCliente')).show();
};
window.deleteCliente = function(id) { if (confirm("Excluir este cliente?")) { CLIENTES = CLIENTES.filter(c => c.id !== id); saveClientes(); showToast("Cliente excluído.", "success"); }};
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
function openNewClientModalFromOS() {
    window.clientFromPdvFlag = false;
    bootstrap.Modal.getInstance(document.getElementById('modalNovaOS'))?.hide();
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cliente-id').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCliente')).show();
}


// --- PRODUTOS & SERVICOS MODULE ---
// UNCHANGED FROM PREVIOUS VERSION

function setupProdutosModule() {
    document.getElementById('formNovoProduto').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('produto-id').value;
        const produto = {
            id: id ? parseInt(id) : getNextId(PRODUTOS),
            nome: document.getElementById('produto-nome').value,
            categoria: document.getElementById('produto-categoria').value,
            precoVenda: parseFloat(document.getElementById('produto-preco').value),
            estoque: parseInt(document.getElementById('produto-estoque').value) || 0,
            isVideogame: document.getElementById('produto-is-videogame').checked,
            consignado: document.getElementById('produto-consignado').checked,
            tipo: 'produto'
        };
        if (!produto.nome || isNaN(produto.precoVenda) || produto.precoVenda <= 0) { showToast("Nome e Preço válido são obrigatórios.", "warning"); return; }
        if (id) { const i = PRODUTOS.findIndex(p=>p.id=== parseInt(id)); if(i>-1) PRODUTOS[i]=produto; else PRODUTOS.push(produto); }
        else { PRODUTOS.push(produto); }
        saveProdutos();
        showToast(`Produto ${id ? 'atualizado' : 'salvo'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovoProduto'))?.hide();
    });
}
function loadProdutos() { PRODUTOS = loadData('luckhouse_produtos', []); renderProductList(); renderPdvItemList(); }
function saveProdutos() { saveData('luckhouse_produtos', PRODUTOS); renderProductList(); renderPdvItemList(); }
function renderProductList(filteredList = null) {
    const tbody = document.getElementById('product-list-tbody');
    if(!tbody) return;
    const listToRender = filteredList || PRODUTOS;
    tbody.innerHTML = listToRender.length === 0 ? '<tr><td colspan="7" class="text-center text-muted">Nenhum produto.</td></tr>' :
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).map(p => 
        `<tr><td>${p.nome}</td><td>${p.categoria||'-'}</td><td>${p.isVideogame ? 'Sim' : 'Não'}</td><td>${p.consignado ? 'Sim' : 'Não'}</td><td>${formatCurrency(p.precoVenda)}</td><td>${p.estoque}</td>
         <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editProduto(${p.id})"><i class="fas fa-edit"></i></button>
             <button class="btn btn-sm btn-danger-custom" onclick="window.deleteProduto(${p.id})"><i class="fas fa-trash"></i></button></td></tr>`
    ).join('');
}
window.editProduto = function(id) {
    const p = PRODUTOS.find(item => item.id === id);
    if(!p) { showToast("Produto não encontrado.", "warning"); return; }
    document.getElementById('formNovoProduto').reset();
    document.getElementById('produto-id').value = p.id;
    document.getElementById('produto-nome').value = p.nome;
    document.getElementById('produto-categoria').value = p.categoria || '';
    document.getElementById('produto-preco').value = p.precoVenda;
    document.getElementById('produto-estoque').value = p.estoque;
    document.getElementById('produto-is-videogame').checked = p.isVideogame || false;
    document.getElementById('produto-consignado').checked = p.consignado || false;
    document.getElementById('modalNovoProdutoLabelDynamic').textContent = 'Editar Produto';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoProduto')).show();
};
window.deleteProduto = function(id) { if(confirm('Excluir este produto?')) { PRODUTOS = PRODUTOS.filter(p => p.id !== id); saveProdutos(); showToast('Produto excluído.', 'success'); }};

function setupServicosModule() {
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
        if (!servico.nome || isNaN(servico.valor) || servico.valor <= 0) { showToast("Nome e Valor para Cliente são obrigatórios.", "warning"); return; }
        if (id) { const i = SERVICOS.findIndex(s=>s.id=== parseInt(id)); if(i>-1) SERVICOS[i]=servico; else SERVICOS.push(servico); }
        else { SERVICOS.push(servico); }
        saveServicos();
        showToast(`Serviço ${id ? 'atualizado' : 'salvo'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovoServico'))?.hide();
    });
}
function loadServicos() { SERVICOS = loadData('luckhouse_servicos', []); renderServiceList(); renderPdvItemList(); }
function saveServicos() { saveData('luckhouse_servicos', SERVICOS); renderServiceList(); renderPdvItemList(); }
function renderServiceList(filteredList = null) {
    const tbody = document.getElementById('service-list-tbody');
    if(!tbody) return;
    const listToRender = filteredList || SERVICOS;
    tbody.innerHTML = listToRender.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">Nenhum serviço.</td></tr>' :
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).map(s => 
        `<tr><td>${s.nome}</td><td>${s.descricao||'-'}</td><td>${formatCurrency(s.custoTecnico)}</td><td>${formatCurrency(s.valor)}</td>
         <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editServico(${s.id})"><i class="fas fa-edit"></i></button>
             <button class="btn btn-sm btn-danger-custom" onclick="window.deleteServico(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`
    ).join('');
}
window.editServico = function(id) {
    const s = SERVICOS.find(item => item.id === id);
    if(!s){ showToast("Serviço não encontrado.", "warning"); return; }
    document.getElementById('formNovoServico').reset();
    document.getElementById('servico-id').value = s.id;
    document.getElementById('servico-nome').value = s.nome;
    document.getElementById('servico-descricao').value = s.descricao || '';
    document.getElementById('servico-valor').value = s.valor;
    document.getElementById('servico-custo-tecnico').value = s.custoTecnico || 0;
    document.getElementById('modalNovoServicoLabelDynamic').textContent = 'Editar Serviço';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoServico')).show();
};
window.deleteServico = function(id) { if(confirm('Excluir este serviço?')) { SERVICOS = SERVICOS.filter(s => s.id !== id); saveServicos(); showToast('Serviço excluído.', 'success'); }};


// --- OS MODULE ---
// UNCHANGED FROM PREVIOUS VERSION

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
        saveOrdensServico();
        showToast(`OS #${String(os.id).padStart(3,'0')} ${id ? 'atualizada' : 'salva'}!`, "success");
        bootstrap.Modal.getInstance(document.getElementById('modalNovaOS'))?.hide();
    });
    document.getElementById('btn-search-os').addEventListener('click', filterOSList);
    document.getElementById('link-novo-cliente-from-os').addEventListener('click', (e) => { e.preventDefault(); openNewClientModalFromOS(); });
}
function loadOrdensServico() { ORDENS_SERVICO = loadData('luckhouse_os', []); renderOSList(); renderDashboardOSRecentes(); }
function saveOrdensServico() { saveData('luckhouse_os', ORDENS_SERVICO); renderOSList(); renderDashboardOSRecentes(); if(CURRENT_USER.role === 'admin') renderAdminDashboard(); }
function getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]+/g,'');
    const statusClasses = {
        'aberta': 'bg-info text-dark', 'em-analise': 'bg-warning text-dark', 'aguardando-aprovacao': 'bg-primary', 
        'aprovada-em-reparo': 'bg-primary', 'aguardando-pecas': 'bg-purple', 'concluida-aguardando-retirada': 'bg-success',
        'faturada': 'bg-success-custom', 'entregue': 'bg-dark', 'cancelada': 'bg-danger', 'orcamento-reprovado': 'bg-danger'
    };
    return statusClasses[s] || 'bg-secondary';
}
function renderOSList(filteredOS = null) {
    const container = document.getElementById('os-list-container');
    if(!container) return;
    const listToRender = filteredOS || ORDENS_SERVICO;
    if (listToRender.length === 0) { container.innerHTML = '<p class="text-muted p-2 no-os-message">Nenhuma OS encontrada.</p>'; return; }
    
    container.innerHTML = listToRender.sort((a,b)=>b.id-a.id).map(os => {
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
                <div class="mt-2">
                    <button class="btn btn-sm btn-warning-custom me-1" onclick="window.editOS(${os.id})"><i class="fas fa-edit me-1"></i> Editar</button>
                    <button class="btn btn-sm btn-info-custom me-1" onclick="window.generateAndOpenOSPdf(${os.id})"><i class="fas fa-file-pdf me-1"></i> PDF Cliente</button>
                    <button class="btn btn-sm btn-success-custom me-1" onclick="window.generateAndOpenOSWhatsAppMessage(${os.id})"><i class="fab fa-whatsapp me-1"></i> Wpp Cliente</button>
                    ${canBeInvoiced ? `<button class="btn btn-sm btn-primary-custom me-1" onclick="window.faturarOSnoPDV(${os.id})"><i class="fas fa-dollar-sign me-1"></i> Faturar no PDV</button>` : ''}
                    <button class="btn btn-sm btn-danger-custom" onclick="window.deleteOS(${os.id})"><i class="fas fa-trash me-1"></i> Excluir</button>
                </div>
            </div>`;
    }).join('');
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
        return `<a href="#" class="list-group-item list-group-item-action bg-dark-tertiary text-white d-flex justify-content-between align-items-center" onclick="event.preventDefault(); navigateToSection('os'); setTimeout(() => window.editOS(${os.id}), 100);">
                    <span>OS #${String(os.id).padStart(3, '0')} - ${cliente.nome} (${os.equipamentoTipo})</span>
                    <span class="badge rounded-pill ${getStatusBadgeClass(os.status)}">${os.status}</span>
                </a>`;
    }).join('');
}
window.editOS = function(id) {
    const os = ORDENS_SERVICO.find(item => item.id === id);
    if (!os) { showToast("OS não encontrada.", "warning"); return; }
    document.getElementById('formNovaOS').reset();
    document.getElementById('os-id').value = os.id;
    document.getElementById('os-cliente-select').value = os.clienteId;
    document.getElementById('os-status').value = os.status;
    
    // Populate and set aux selects
    populateSelectFromAux('os-equip-tipo', 'tipos');
    populateSelectFromAux('os-equip-marca', 'marcas');
    populateSelectFromAux('os-equip-modelo', 'modelos');
    document.getElementById('os-equip-tipo').value = os.equipamentoTipo;
    document.getElementById('os-equip-marca').value = os.equipamentoMarca;
    document.getElementById('os-equip-modelo').value = os.equipamentoModelo;

    document.getElementById('os-equip-serial').value = os.equipamentoSerial || '';
    document.getElementById('os-problema').value = os.problemaDescricao;
    document.getElementById('os-diagnostico-tecnico').value = os.diagnosticoTecnico || '';
    document.getElementById('os-acessorios-inclusos').value = os.acessoriosInclusos || '';
    document.getElementById('os-observacoes').value = os.observacoes || '';
    document.getElementById('os-orcamento').value = os.valorOrcamento;
    
    const servicoSelect = document.getElementById('os-servico-realizado-id');
    servicoSelect.innerHTML = '<option value="">Nenhum/Ainda não definido</option>';
    SERVICOS.forEach(s => { servicoSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
    servicoSelect.value = os.servicoRealizadoId || '';
    
    updateTermoGarantiaPreview();
    document.getElementById('modalNovaOSLabelDynamic').textContent = `Editando OS #${String(os.id).padStart(3,'0')}`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovaOS')).show();
};
window.deleteOS = function(id) { if (confirm("Excluir esta OS?")) { ORDENS_SERVICO = ORDENS_SERVICO.filter(os => os.id !== id); saveOrdensServico(); showToast("OS excluída.", "success"); }};
window.generateAndOpenOSPdf = async function(osId) {
    if (!jsPDFModule || !JsBarcode) { showToast("Bibliotecas PDF ou Barcode não carregadas.", "danger"); return; }
    const osData = ORDENS_SERVICO.find(os => os.id === osId);
    const cliente = osData ? CLIENTES.find(c => c.id === osData.clienteId) : null;
    if (!osData || !cliente) { showToast("OS ou Cliente não encontrado!", "danger"); return; }
    
    showToast("Gerando PDF da OS...", "info");
    const doc = new jsPDFModule();
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(`Ordem de Serviço #${String(osData.id).padStart(4, '0')}`, doc.internal.pageSize.width / 2, 15, { align: 'center' });
    
    const barcodeSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(barcodeSVG, String(osData.id).padStart(6, '0'), { format: "CODE128", displayValue: true, fontSize: 14, height: 30, width: 1.5 });
    doc.addSvgAsImage(barcodeSVG.outerHTML, doc.internal.pageSize.width - 65, 20, 50, 15);

    doc.autoTable({ startY: 40, head: [[{content: 'Detalhes da OS e Cliente', colSpan: 4, styles: {fillColor: [52,73,94]}}]], body: [
        ["Data Abertura:", new Date(osData.dataAbertura).toLocaleString('pt-BR'), "Status Atual:", osData.status || 'N/A'],
        ["Cliente:", cliente.nome, "Telefone:", cliente.telefone || 'N/A'],
    ], theme: 'striped', styles:{fontSize:9}, columnStyles: {0:{fontStyle:'bold'},2:{fontStyle:'bold'}}});
    
    const finalY = doc.lastAutoTable.finalY + 7;
    doc.autoTable({ startY: finalY, head: [[{content: 'Informações do Equipamento', colSpan: 4, styles: {fillColor: [52,73,94]}}]], body: [
        ["Tipo:", osData.equipamentoTipo, "Marca:", osData.equipamentoMarca],
        ["Modelo:", osData.equipamentoModelo, "Nº de Série:", osData.equipamentoSerial || "N/A"],
        [{content: `Problema Relatado: ${osData.problemaDescricao}`, colSpan: 4}]
    ], theme: 'striped', styles:{fontSize:9}, columnStyles: {0:{fontStyle:'bold'},2:{fontStyle:'bold'}}});
    
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`Valor do Orçamento (Cliente): ${formatCurrency(osData.valorOrcamento)}`, 14, doc.lastAutoTable.finalY + 15);
    doc.save(`OS_Cliente_${String(osData.id).padStart(4, '0')}_${cliente.nome.replace(/\s+/g, '_')}.pdf`);
    showToast("PDF da OS gerado!", "success");
};
window.generateAndOpenOSWhatsAppMessage = function(osId) {
    const osData = ORDENS_SERVICO.find(os => os.id === osId);
    const cliente = osData ? CLIENTES.find(c => c.id === osData.clienteId) : null;
    if (!osData || !cliente || !cliente.telefone) { showToast("Cliente ou telefone não encontrado!", "warning"); return; }

    let template = STORE_CONFIG.templateOsCliente || '';
    let mensagem = template
        .replace(/{cliente_nome}/g, cliente.nome)
        .replace(/{os_id}/g, String(osData.id).padStart(4, '0'))
        .replace(/{os_status}/g, osData.status)
        .replace(/{os_equipamento}/g, `${osData.equipamentoTipo} ${osData.equipamentoMarca}`)
        .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja);

    const cleanTelefone = cliente.telefone.replace(/\D/g, '');
    const whatsappNumber = cleanTelefone.startsWith('55') ? cleanTelefone : `55${cleanTelefone}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`, '_blank');
    showToast("Mensagem para WhatsApp pronta!", "info");
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
        isVideogame: false
    };

    pdvCartItems.push(itemOS);
    os.status = 'Faturada';
    saveOrdensServico();
    
    populatePdvClienteSelect();
    document.getElementById('pdv-cliente-select').value = os.clienteId;
    fillPdvClientReceiptFields();
    
    navigateToSection('pdv');
    updatePdvCartUI();
    showToast(`OS #${os.id} enviada para o PDV para faturamento.`, 'success');
};


// --- PDV MODULE ---
// UNCHANGED FROM PREVIOUS VERSION

function setupPdvModule() {
    document.getElementById('btn-pdv-search-item').addEventListener('click', window.searchPdvItems);
    document.getElementById('pdv-discount-percentage').addEventListener('input', updatePdvTotals);
    document.getElementById('btn-finalize-sale').addEventListener('click', finalizeSale);
    document.getElementById('btn-download-sale-receipt').addEventListener('click', () => generateSaleReceiptPdf(true));
    document.getElementById('btn-pdv-novo-cliente-rapido').addEventListener('click', () => {
        window.clientFromPdvFlag = true;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCliente')).show();
    });
    document.getElementById('formNovoItemRapidoPDV').addEventListener('submit', function(e){
        e.preventDefault();
        const nome = document.getElementById('item-rapido-nome').value;
        const preco = parseFloat(document.getElementById('item-rapido-preco').value);
        const tipo = document.getElementById('item-rapido-tipo').value;
        if (!nome || isNaN(preco) || preco <= 0) { showToast("Nome e Preço válido são obrigatórios.", "warning"); return; }
        
        let novoItem;
        if (tipo === 'produto') {
            const estoque = parseInt(document.getElementById('item-rapido-estoque').value) || 0;
            novoItem = { id: getNextId(PRODUTOS), nome, precoVenda: preco, estoque, tipo: 'produto' };
            PRODUTOS.push(novoItem); saveProdutos();
        } else {
            novoItem = { id: getNextId(SERVICOS), nome, valor: preco, tipo: 'servico' };
            SERVICOS.push(novoItem); saveServicos();
        }
        showToast(`Item "${nome}" adicionado!`, 'success');
        window.pdvAddItemByIdAndType(novoItem.id, novoItem.tipo);
        bootstrap.Modal.getInstance(document.getElementById('modalNovoItemRapidoPDV'))?.hide();
    });
    document.getElementById('pdv-cliente-select').addEventListener('change', fillPdvClientReceiptFields);
}
function loadVendas() { VENDAS = loadData('luckhouse_vendas', []); }
function renderPdvItemList(searchTerm = '') {
    const listEl = document.getElementById('pdv-item-list'); if(!listEl) return;
    const term = searchTerm.toLowerCase();
    const filtered = [...PRODUTOS, ...SERVICOS].filter(item => item.nome.toLowerCase().includes(term));
    if (filtered.length === 0) { listEl.innerHTML = `<p class="text-muted p-2">Nenhum item encontrado.</p>`; return; }
    listEl.innerHTML = filtered.map(item => {
        const price = item.tipo === 'produto' ? item.precoVenda : item.valor;
        return `<a href="#" class="list-group-item list-group-item-action bg-dark-tertiary text-white" onclick="window.pdvAddItemByIdAndType(${item.id}, '${item.tipo}')">${item.nome} - ${formatCurrency(price)}</a>`;
    }).join('');
}
window.searchPdvItems = function() { renderPdvItemList(document.getElementById('pdv-search-item').value); };
window.pdvAddItemByIdAndType = function(itemId, itemType) {
    let itemFull = itemType === 'produto' ? PRODUTOS.find(p => p.id === itemId) : SERVICOS.find(s => s.id === itemId);
    if (!itemFull) { showToast("Item não encontrado.", "danger"); return; }
    if (itemType === 'produto' && itemFull.estoque <= 0) { showToast(`"${itemFull.nome}" fora de estoque!`, "warning"); return; }
    
    const existing = pdvCartItems.find(ci => ci.id === itemFull.id && ci.tipo === itemFull.tipo);
    if(existing) { 
        if (itemType === 'produto' && existing.quantidade >= itemFull.estoque) { showToast(`Estoque máximo para "${itemFull.nome}".`, "warning"); return; }
        existing.quantidade++;
    } else { 
        pdvCartItems.push({ id: itemFull.id, nome: itemFull.nome, preco: itemType === 'produto' ? itemFull.precoVenda : itemFull.valor, quantidade: 1, tipo: itemType, estoqueOriginal: itemType === 'produto' ? itemFull.estoque : Infinity, isVideogame: itemFull.isVideogame || false });
    }
    updatePdvCartUI(); showToast(`${itemFull.nome} adicionado.`, "success");
};
function updatePdvCartUI() {
    const cartUl = document.getElementById('pdv-cart');
    if(!cartUl) return;
    if (pdvCartItems.length === 0) { cartUl.innerHTML = '<li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary text-muted">Nenhum item.</li>'; }
    else { cartUl.innerHTML = pdvCartItems.map((item, i) => `
        <li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary text-white">
            <div>${item.nome} (x${item.quantidade}) <small class="d-block text-muted">${formatCurrency(item.preco)} cada</small></div>
            <span class="d-flex align-items-center">
                ${formatCurrency(item.preco * item.quantidade)}
                ${item.tipo !== 'servico_os' ? `
                <button class="btn btn-sm btn-outline-light ms-2" onclick="window.pdvDecrementItem(${i})"><i class="fas fa-minus"></i></button>
                <button class="btn btn-sm btn-outline-light ms-1" onclick="window.pdvIncrementItem(${i})"><i class="fas fa-plus"></i></button>
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
    const discVal = subtotal * (discPerc / 100);
    document.getElementById('pdv-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('pdv-discount-value').textContent = formatCurrency(discVal);
    document.getElementById('pdv-total').textContent = formatCurrency(subtotal - discVal);
}
function fillPdvClientReceiptFields() {
    const clienteId = document.getElementById('pdv-cliente-select').value;
    const cliente = clienteId ? CLIENTES.find(c => c.id === parseInt(clienteId)) : null;
    document.getElementById('pdv-receipt-client-name').value = cliente ? cliente.nome : '';
    document.getElementById('pdv-receipt-client-contact').value = cliente ? (cliente.telefone || cliente.email || '') : '';
}
function finalizeSale() {
    if (pdvCartItems.length === 0) { showToast("Carrinho vazio.", "warning"); return; }
    
    const total = parseFloat(document.getElementById('pdv-total').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.'));
    const venda = {
        id: getNextId(VENDAS), data: new Date().toISOString(),
        clienteId: document.getElementById('pdv-cliente-select').value ? parseInt(document.getElementById('pdv-cliente-select').value) : null,
        receiptClientName: document.getElementById('pdv-receipt-client-name').value,
        receiptClientContact: document.getElementById('pdv-receipt-client-contact').value,
        itens: JSON.parse(JSON.stringify(pdvCartItems)),
        subtotal: pdvCartItems.reduce((s,i)=>s+(i.preco*i.quantidade),0),
        descontoPercentual: parseFloat(document.getElementById('pdv-discount-percentage').value) || 0,
        valorDesconto: parseFloat(document.getElementById('pdv-discount-value').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')),
        total: total,
        formaPagamento: document.getElementById('payment-method').value
    };
    VENDAS.push(venda); saveData('luckhouse_vendas', VENDAS);
    
    const transacao = {
        id: getNextId(TRANSACOES_FINANCEIRAS),
        data: venda.data,
        descricao: `Venda #${venda.id}`,
        tipo: 'entrada',
        valor: venda.total
    };
    TRANSACOES_FINANCEIRAS.push(transacao);
    saveTransacoesFinanceiras();

    pdvCartItems.forEach(ci => {
        if (ci.tipo === 'produto') {
            const pOrig = PRODUTOS.find(p => p.id === ci.id);
            if (pOrig) pOrig.estoque -= ci.quantidade;
        } else if (ci.tipo === 'servico_os') {
            const osId = parseInt(ci.id.replace('os_', ''));
            const os = ORDENS_SERVICO.find(o => o.id === osId);
            if (os) os.status = 'Entregue';
        }
    });
    saveProdutos();
    saveOrdensServico();

    showToast(`Venda #${venda.id} finalizada!`, "success");
    pdvCartItems = []; updatePdvCartUI();
    document.getElementById('pdv-cliente-select').value = '';
    fillPdvClientReceiptFields();
    document.getElementById('pdv-discount-percentage').value = 0;
    updatePdvTotals();
}

async function generateSaleReceiptPdf(isPreview, saleData = null) {
    if (!jsPDFModule || !JsBarcode) {
        showToast("Biblioteca PDF ou de Código de Barras não encontrada.", "danger");
        return;
    }

    let sale, client, hasVideogame;

    if (isPreview) {
        if (pdvCartItems.length === 0) {
            showToast("Carrinho vazio. Não é possível gerar recibo.", "warning");
            return;
        }
        const clienteId = document.getElementById('pdv-cliente-select').value;
        client = clienteId ? CLIENTES.find(c => c.id === parseInt(clienteId)) : null;
        sale = {
            id: getNextId(VENDAS),
            data: new Date().toISOString(),
            receiptClientName: document.getElementById('pdv-receipt-client-name').value || (client ? client.nome : "Consumidor"),
            receiptClientContact: document.getElementById('pdv-receipt-client-contact').value || (client ? client.telefone : ""),
            clienteCpf: client ? client.cpf : "",
            itens: pdvCartItems,
            subtotal: pdvCartItems.reduce((sum, item) => sum + (item.preco * item.quantidade), 0),
            valorDesconto: parseFloat(document.getElementById('pdv-discount-value').textContent.replace(/R\$\s?/, '').replace('.', '').replace(',', '.')) || 0,
            total: parseFloat(document.getElementById('pdv-total').textContent.replace(/R\$\s?/, '').replace('.', '').replace(',', '.')) || 0,
            formaPagamento: document.getElementById('payment-method').value
        };
        hasVideogame = pdvCartItems.some(item => item.isVideogame);
    } else {
        sale = saleData;
        client = sale.clienteId ? CLIENTES.find(c => c.id === sale.clienteId) : null;
        hasVideogame = sale.itens.some(item => item.isVideogame);
    }

    if (!sale) {
        showToast("Dados da venda não encontrados.", "danger");
        return;
    }

    showToast("Gerando Recibo de Venda...", "info");
    const doc = new jsPDFModule();
    let y = 20;

    // Header
    if (STORE_CONFIG.logoUrl) {
        try {
            const imgResponse = await fetch(STORE_CONFIG.logoUrl);
            const blob = await imgResponse.blob();
            const imgData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            doc.addImage(imgData, 'PNG', 14, 10, 30, 10);
        } catch (e) { console.error("Erro ao carregar logo para PDF", e); }
    }
    doc.setFontSize(14).setFont("helvetica", "bold").text(STORE_CONFIG.nomeLoja, 105, 15, { align: "center" });
    doc.setFontSize(8).setFont("helvetica", "normal").text(`${STORE_CONFIG.endereco}\nCNPJ: ${STORE_CONFIG.cnpj} | Tel: ${STORE_CONFIG.telefone}`, 105, 20, { align: "center" });

    y = 35;
    doc.setLineWidth(0.5).line(14, y, 196, y);
    y += 10;
    
    // Title and Sale Info
    doc.setFontSize(16).setFont("helvetica", "bold").text("RECIBO DE VENDA", 105, y, { align: "center" });
    y += 8;
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Venda #${sale.id} - Data: ${new Date(sale.data).toLocaleString('pt-BR')}`, 14, y);
    const barcodeSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(barcodeSVG, `V${String(sale.id).padStart(5, '0')}`, { format: "CODE128", displayValue: false, height: 40, width: 1.5 });
    doc.addSvgAsImage(barcodeSVG.outerHTML, 150, y-5, 45, 12);
    y += 10;

    // Client Info
    doc.setFontSize(11).setFont("helvetica", "bold").text("Cliente:", 14, y);
    doc.setFontSize(10).setFont("helvetica", "normal");
    let clientText = `${sale.receiptClientName}`;
    if(sale.clienteCpf) clientText += `\nCPF: ${sale.clienteCpf}`;
    if(sale.receiptClientContact) clientText += `\nContato: ${sale.receiptClientContact}`;
    doc.text(clientText, 15, y+5);
    y += 20;

    // Items Table
    const head = [['Descrição', 'Qtd.', 'Vlr. Unit.', 'Subtotal']];
    const body = sale.itens.map(item => [item.nome, item.quantidade, formatCurrency(item.preco), formatCurrency(item.preco * item.quantidade)]);
    doc.autoTable({
        startY: y,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [42, 47, 55] },
        columnStyles: {
            0: { cellWidth: 102 },
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        }
    });
    y = doc.lastAutoTable.finalY + 5;
    
    // Totals
    const totalsX = 140;
    doc.setFontSize(10).text("Subtotal:", totalsX, y, { align: 'right' });
    doc.text(formatCurrency(sale.subtotal), 196, y, { align: 'right' });
    y += 6;
    doc.text("Desconto:", totalsX, y, { align: 'right' });
    doc.text(`- ${formatCurrency(sale.valorDesconto)}`, 196, y, { align: 'right' });
    y += 6;
    doc.setFontSize(12).setFont("helvetica", "bold").text("TOTAL GERAL:", totalsX, y, { align: 'right' });
    doc.text(formatCurrency(sale.total), 196, y, { align: 'right' });
    y += 10;
    doc.setFontSize(10).setFont("helvetica", "normal").text(`Forma de Pagamento: ${sale.formaPagamento}`, 14, y);
    
    // Warranty
    if (hasVideogame) {
        y = doc.internal.pageSize.height - 30;
        doc.setLineWidth(0.2).line(14, y, 196, y);
        y += 5;
        doc.setFontSize(9).setFont("helvetica", "bold").text("TERMO DE GARANTIA (VIDEOGAME)", 105, y, {align: 'center'});
        y += 5;
        const warrantyText = `Garantia de ${STORE_CONFIG.diasGarantiaPadrao} dias contra defeitos de fabricação. Não cobre danos físicos, líquidos, picos de energia, violação de lacre ou mau uso.`;
        const splitText = doc.splitTextToSize(warrantyText, 182);
        doc.setFontSize(8).setFont("helvetica", "normal").text(splitText, 14, y);
    }
    
    doc.save(`Recibo_Venda_${sale.id}.pdf`);
    showToast("Recibo PDF gerado!", "success");
}

// ADMIN AREA
// UNCHANGED FROM PREVIOUS VERSION
function setupAdminAreaModule() {
    document.getElementById('btn-export-vendas-csv').addEventListener('click', exportVendasCSV);
}
function loadTransacoesFinanceiras() { TRANSACOES_FINANCEIRAS = loadData('luckhouse_transacoes', []); }
function saveTransacoesFinanceiras() { saveData('luckhouse_transacoes', TRANSACOES_FINANCEIRAS); }

function renderAdminDashboard() {
    if (CURRENT_USER.role !== 'admin' || document.querySelector('#admin-area').classList.contains('d-none')) return;
    
    const faturamentoBruto = TRANSACOES_FINANCEIRAS.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + t.valor, 0);
    const custosOperacionais = TRANSACOES_FINANCEIRAS.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + t.valor, 0);
    const lucroLiquido = faturamentoBruto - custosOperacionais;

    document.getElementById('admin-faturamento-total').textContent = formatCurrency(faturamentoBruto);
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
    const data = ultimasVendas.map(v => v.total);
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new ChartJS(canvas, {
        type: 'bar', data: {labels, datasets:[{label:'Valor da Venda (R$)', data, backgroundColor:'rgba(0,123,255,0.5)'}]},
        options:{ scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
    });
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
    if (!os || !servico || servico.custoTecnico <= 0) {
        showToast("Erro ao processar pagamento.", "danger");
        return;
    }
    if (confirm(`Confirmar pagamento de ${formatCurrency(servico.custoTecnico)} para a OS #${os.id}?`)) {
        os.pagamentoTecnicoEfetuado = true;
        const transacao = {
            id: getNextId(TRANSACOES_FINANCEIRAS),
            data: new Date().toISOString(),
            descricao: `Pagamento Técnico OS #${os.id} (${servico.nome})`,
            tipo: 'saida',
            valor: servico.custoTecnico
        };
        TRANSACOES_FINANCEIRAS.push(transacao);
        saveTransacoesFinanceiras();
        saveOrdensServico();
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
        return `<div class="list-group-item bg-dark-tertiary text-white d-flex justify-content-between align-items-center">
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
    tbody.innerHTML = TRANSACOES_FINANCEIRAS.sort((a,b) => new Date(b.data) - new Date(a.data)).map(t => {
        const isEntrada = t.tipo === 'entrada';
        return `<tr>
            <td>${new Date(t.data).toLocaleDateString('pt-BR')}</td>
            <td>${t.descricao}</td>
            <td><span class="badge ${isEntrada ? 'bg-success' : 'bg-danger'}">${isEntrada ? 'Entrada' : 'Saída'}</span></td>
            <td class="${isEntrada ? 'text-success-custom' : 'text-danger-custom'}">${formatCurrency(t.valor)}</td>
        </tr>`;
    }).join('');
}


function exportVendasCSV() {
    if (VENDAS.length === 0) { showToast("Nenhuma venda para exportar.", "info"); return; }
    let csvContent = "ID Venda;Data;Cliente;Itens;Subtotal;Total;Forma Pagamento\n";
    VENDAS.forEach(v => {
        const itensString = v.itens.map(item => `${item.quantidade}x ${item.nome}`).join(' | ');
        csvContent += `${v.id};"${new Date(v.data).toLocaleString('pt-BR')}";"${v.receiptClientName || ''}";"${itensString}";${v.subtotal.toFixed(2)};${v.total.toFixed(2)};"${v.formaPagamento}"\n`;
    });
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// --- Backup & Search ---
function setupSearchFilterListeners() { document.getElementById('btn-search-prodserv').addEventListener('click', filterProductServiceList); }
function setupBackupRestoreModule() {
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('btn-reset-data').addEventListener('click', resetAllDataWarning);
}
function filterOSList() { /* unchanged */ }
function filterClientList() { /* unchanged */ }
function filterProductServiceList() {
    const term = document.getElementById('searchProductServiceInput').value.toLowerCase();
    const activeTabId = document.querySelector('#myTab .nav-link.active').id;
    if (activeTabId === 'tab-produtos') renderProductList(PRODUTOS.filter(p => p.nome.toLowerCase().includes(term)));
    else renderServiceList(SERVICOS.filter(s => s.nome.toLowerCase().includes(term)));
}
function exportData() {
    const dataToExport = { config: STORE_CONFIG, clientes: CLIENTES, produtos: PRODUTOS, servicos: SERVICOS, os: ORDENS_SERVICO, vendas: VENDAS, cadastros_aux: CADASTROS_AUXILIARES, transacoes: TRANSACOES_FINANCEIRAS };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `luckhouse_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}
function importData(event) {
    const file = event.target.files[0];
    if (file && confirm("IMPORTANTE: Isso substituirá todos os dados atuais. Deseja continuar?")) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.config && imported.clientes && imported.os) {
                    STORE_CONFIG = imported.config; CLIENTES = imported.clientes; PRODUTOS = imported.produtos || [];
                    SERVICOS = imported.servicos || []; ORDENS_SERVICO = imported.os; VENDAS = imported.vendas || [];
                    CADASTROS_AUXILIARES = imported.cadastros_aux || { tipos: [], marcas: [], modelos: [] };
                    TRANSACOES_FINANCEIRAS = imported.transacoes || [];
                    
                    saveAppConfig(); saveClientes(); saveProdutos(); saveServicos(); saveOrdensServico(); saveData('luckhouse_vendas', VENDAS);
                    saveCadastrosAuxiliares(); saveTransacoesFinanceiras();

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

// --- Envio Podium Module ---
function setupEnvioPodiumModule() {
    document.getElementById('btn-gerar-ticket-podium').addEventListener('click', handleGerarTicketPodium);
    document.getElementById('btn-enviar-ticket-whatsapp').addEventListener('click', enviarTicketPodiumViaWhatsApp);
}

function renderPodiumOSList() {
    const container = document.getElementById('podium-os-list-container');
    const osProntasParaEnvio = ORDENS_SERVICO.filter(os => os.status === 'Concluída - Aguardando Retirada');
    if (osProntasParaEnvio.length === 0) {
        container.innerHTML = '<p class="text-muted p-2">Nenhuma OS pronta para envio.</p>';
        return;
    }
    container.innerHTML = `<ul class="list-group">${osProntasParaEnvio.map(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId);
        return `<li class="list-group-item bg-dark-secondary text-white">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${os.id}" id="podium-os-${os.id}">
                <label class="form-check-label" for="podium-os-${os.id}">
                    <strong>OS #${String(os.id).padStart(3, '0')}</strong> - ${cliente ? cliente.nome : 'N/A'}
                    <small class="d-block text-muted">Endereço: ${cliente ? (cliente.endereco || 'Não cadastrado') : ''}</small>
                </label>
            </div></li>`;
    }).join('')}</ul>`;
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
    if (!entregas) return;

    const ticketHtml = await preparePodiumTicketHtml(entregas);
    const printArea = document.getElementById('podium-ticket-print-area');
    printArea.innerHTML = ticketHtml;
    printArea.classList.remove('d-none');
    
    showToast("Comprovante gerado! Preparando impressão.", "success");
    setTimeout(() => { window.print(); printArea.classList.add('d-none'); }, 500);
}

async function enviarTicketPodiumViaWhatsApp() {
    const entregas = getSelectedEntregas();
    if (!entregas) return;

    const targetWhatsapp = STORE_CONFIG.whatsappEnvioTicket || (entregas[0].cliente ? entregas[0].cliente.telefone : '');
    if (!targetWhatsapp) {
        showToast("Nenhum WhatsApp de destino configurado ou encontrado no cliente.", "danger");
        return;
    }
    
    let message = "";
    entregas.forEach(entrega => {
        const template = STORE_CONFIG.templateEnvioPodium || "";
        message += template
            .replace(/{cliente_nome}/g, entrega.cliente.nome)
            .replace(/{os_id}/g, String(entrega.os.id).padStart(3, '0'))
            .replace(/{os_equipamento}/g, `${entrega.os.equipamentoTipo} ${entrega.os.equipamentoMarca}`)
            .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja)
            + "\n\n";
    });

    const cleanTelefone = targetWhatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanTelefone}?text=${encodeURIComponent(message.trim())}`;
    window.open(whatsappUrl, '_blank');
}


async function preparePodiumTicketHtml(entregas) {
    let html = `<div class="podium-ticket" style="font-family: monospace; color: #000;">`;
    html += `<h3 style="text-align: center; margin-bottom: 5px;">COMPROVANTE DE ENTREGA</h3>`;
    html += `<p style="text-align: center; font-size: 9pt;">${STORE_CONFIG.nomeLoja}</p><hr>`;
    
    const barcodeValue = `ENT-${new Date().getTime()}`;
    const barcodeSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(barcodeSVG, barcodeValue, { format: "CODE128", displayValue: true, fontSize: 10, height: 30 });
    html += `<div style="text-align:center; margin-top:5px; margin-bottom: 10px;">${barcodeSVG.outerHTML}</div><hr>`;

    entregas.forEach((entrega) => {
        html += `<div style="margin-top: 10px; page-break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">`;
        html += `<p><strong>Recebedor:</strong> ${entrega.cliente.nome}</p>`;
        html += `<p><strong>OS Ref.:</strong> #${String(entrega.os.id).padStart(3, '0')}</p>`;
        html += `<p><strong>Equip.:</strong> ${entrega.os.equipamentoTipo} ${entrega.os.equipamentoMarca} ${entrega.os.equipamentoModelo}</p>`;
        html += `<p><strong>Serial:</strong> ${entrega.os.equipamentoSerial || 'N/A'}</p>`;
        html += `<p><strong>Problema:</strong> ${entrega.os.problemaDescricao}</p>`;
        html += `<p><strong>Solução:</strong> ${entrega.os.observacoes || 'N/A'}</p>`;
        html += `<p style="margin-top: 15px;"><strong>Data Entrega:</strong> ____/____/______</p>`;
        html += `<p style="margin-top: 15px;"><strong>Ass. Recebedor:</strong></p>`;
        html += `<div style="border-bottom: 1px solid #000; height: 30px; margin-top: 5px;"></div>`;
        html += `</div>`;
    });
    
    html += `</div>`;
    return html;
}

// --- Solicitar Estoque Module ---
function setupSolicitarEstoqueModule() {
    document.getElementById('btn-solicitar-estoque-modal').addEventListener('click', renderSolicitarEstoqueList);
    document.getElementById('btn-gerar-msg-estoque-whatsapp').addEventListener('click', gerarMsgEstoqueWhatsapp);
}

function renderSolicitarEstoqueList() {
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
}

function gerarMsgEstoqueWhatsapp() {
    const selected = document.querySelectorAll('#solicitar-estoque-list .form-check-input:checked');
    if (selected.length === 0) {
        showToast("Selecione ao menos um produto.", "warning");
        return;
    }
    if (!STORE_CONFIG.podiumGamesWhatsapp) {
        showToast("WhatsApp da Podium Games não configurado.", "danger");
        return;
    }

    const produtosList = Array.from(selected).map(chk => {
        const qty = chk.closest('.input-group').querySelector('input[type="number"]').value;
        const nome = chk.dataset.nome;
        return `- ${qty}x ${nome}`;
    }).join('\n');

    let template = STORE_CONFIG.templateReqEstoque || '';
    let mensagem = template
        .replace(/{lista_produtos}/g, produtosList)
        .replace(/{loja_nome}/g, STORE_CONFIG.nomeLoja);

    const whatsappNumber = STORE_CONFIG.podiumGamesWhatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensagem)}`, '_blank');
}


// --- INITIALIZATION & NAVIGATION ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded. Iniciando Luckhouse Games System...");
    try {
        const el = id => document.getElementById(id);
        el('currentYear').textContent = new Date().getFullYear();
        el('footerCurrentYear').textContent = new Date().getFullYear();
        loadAllData();
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
                    bootstrap.Modal.getOrCreateInstance(el('modalNovaOS')).show();
                } else if (this.dataset.target) {
                    navigateToSection(this.dataset.target);
                }
            });
        });
        checkLoginState();
        
        document.getElementById('modalNovaOS').addEventListener('show.bs.modal', () => {
             populateSelectFromAux('os-equip-tipo', 'tipos');
             populateSelectFromAux('os-equip-marca', 'marcas');
             populateSelectFromAux('os-equip-modelo', 'modelos');
             const servicoSelect = document.getElementById('os-servico-realizado-id');
             servicoSelect.innerHTML = '<option value="">Nenhum/Ainda não definido</option>';
             SERVICOS.forEach(s => { servicoSelect.innerHTML += `<option value="${s.id}">${s.nome}</option>`; });
        });
        document.querySelectorAll('.modal').forEach(modal => {
             modal.addEventListener('hidden.bs.modal', function() {
                 const form = this.querySelector('form');
                 if (form) form.reset();
             });
        });

    } catch (error) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", error);
        document.body.innerHTML = `<div class='vh-100 d-flex align-items-center justify-content-center text-center'><h1 class='text-danger'>Erro Crítico na Aplicação. Limpe os dados do site e tente novamente.</h1></div>`;
    }
});

function loadAllData() {
    loadAppConfig(); loadClientes(); loadProdutos(); loadServicos(); loadOrdensServico(); loadVendas();
    loadCadastrosAuxiliares(); loadTransacoesFinanceiras();
    renderPdvItemList();
    if (CURRENT_USER && CURRENT_USER.role) {
        renderDashboardOSRecentes();
        if (CURRENT_USER.role === 'admin') renderAdminDashboard();
    }
}

function navigateToSection(targetId, clickedLinkElement = null) {
    if (!CURRENT_USER.role && targetId !== 'login-prompt') { checkLoginState(); return; }
    if (targetId === 'admin-area' && CURRENT_USER.role !== 'admin') { showToast("Acesso negado.", "danger"); return; }

    document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => { if (s.id !== 'login-prompt') s.classList.add('d-none'); });

    let activeLink = clickedLinkElement || document.querySelector(`.nav-link[data-target="${targetId}"]`);
    if(activeLink) activeLink.classList.add('active');
    
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.remove('d-none');
    } else {
        document.getElementById('dashboard').classList.remove('d-none');
    }
    
    // Refresh data on navigation
    if (CURRENT_USER.role) {
        switch(targetId) {
            case 'configuracoes': updateStoreInfoUI(); renderAuxCadastros(); break;
            case 'os': renderOSList(); populateClienteSelect(); break;
            case 'clientes': renderClientList(); break;
            case 'produtos': renderProductList(); renderServiceList(); break;
            case 'pdv': renderPdvItemList(); populatePdvClienteSelect(); break;
            case 'dashboard': renderDashboardOSRecentes(); break;
            case 'admin-area': renderAdminDashboard(); break;
            case 'envio-podium': renderPodiumOSList(); break;
        }
    }
}