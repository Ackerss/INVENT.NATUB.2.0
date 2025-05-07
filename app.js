/* ========= CONFIG ========= */
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwy_aKGV9xAd9sBJRGG66LohrR3s0l_DbDCnOveCEHaE_RGjNqgTHbkiBX8ngks3-nO/exec'; // Mantido o último URL funcional
const APP_VERSION = '29-abr-2025 - Melhorias UI/UX e Funcionais';
const ENVIO_DELAY_MS = 500;

/* ========= VARS ========= */
const ITENS_KEY = 'inv_granel_itens_v4'; // Nova chave para refletir edições
const NOME_USUARIO_KEY = 'inventarioGranelUsuario';
let nomeUsuario = '', enviando = false, letraPoteSel = 'Nenhuma', itens = [], MAPA = {};
let editandoItemId = null; // Para controlar se estamos editando um item

/* refs DOM */
const $ = id => document.getElementById(id);
const codigoInp=$('codigoProduto'), nomeDiv=$('nomeProdutoDisplay'),
      taraInp=$('pesoTaraKg'),
      pesoComPoteInp=$('pesoComPoteKg'),
      pesoExtraInp=$('pesoExtraKg'),
      btnReg=$('registrarItemBtn'), textoBotaoRegistrar=$('textoBotaoRegistrar'),
      tbody=$('listaItensBody'),
      letras=$('botoesTaraContainer'),
      statusDiv=$('statusEnvio'), statusMensagem=$('statusMensagem'),
      progressBarContainer=$('progressBarContainer'), progressBar=$('progressBar'),
      nomeDisp=$('nomeUsuarioDisplay'), modal=$('modalNomeUsuario'),
      overlay=$('overlayNomeUsuario'), inpNome=$('inputNomeUsuario'),
      spanLetra=$('letraPoteSelecionado'), enviarTodosBtn=$('enviarTodosBtn'),
      textoBotaoEnviar=$('textoBotaoEnviar'),
      contadorPendentes=$('contadorPendentes'), totalizadorPendentes=$('totalizadorPendentes'),
      btnLimpar=$('limparSessaoLocalBtn'),
      btnAlterarNome=$('alterarNomeBtn'), salvaNmBtn=$('salvarNomeUsuarioBtn'),
      closeModalNomeBtn=$('closeModalNomeBtn'),
      calculoPesoLiquidoDisplay=$('calculoPesoLiquidoDisplay');

// Referências para mensagens de erro dos campos
const codigoProdutoError = $('codigoProdutoError');
const pesoTaraKgError = $('pesoTaraKgError');
const pesoComPoteKgError = $('pesoComPoteKgError');
const pesoExtraKgError = $('pesoExtraKgError');


/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  console.log('App carregado:', APP_VERSION);
  setupEventListeners();
  carregaLocais();
  await carregaPotes();
  renderizaLista();
  verificaNomeUsuario();
  updateBotaoRegistrar();
  selecionaBotaoNenhuma();
  limpaMensagensErro(); // Limpa erros ao carregar
});

/* ---------- Setup Eventos ---------- */
function setupEventListeners() {
  // Modal Nome
  salvaNmBtn.addEventListener('click', salvaNome);
  inpNome.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Done') salvaNome(); });
  nomeDisp.addEventListener('click', abrirModalNome);
  btnAlterarNome.addEventListener('click', abrirModalNome);
  closeModalNomeBtn.addEventListener('click', fecharModalNome);
  overlay.addEventListener('click', fecharModalNome); // Fechar ao clicar no overlay

  // Navegação Enter/Go
  const goKeys = ['Enter','Go','Next','Done','Send'];
  codigoInp.addEventListener('keydown', e => { if (goKeys.includes(e.key)) { e.preventDefault(); taraInp.focus(); taraInp.select();} });
  taraInp.addEventListener('keydown', e => { if (goKeys.includes(e.key)) { e.preventDefault(); pesoComPoteInp.focus(); pesoComPoteInp.select();} });
  pesoComPoteInp.addEventListener('keydown', e => { if (goKeys.includes(e.key)) { e.preventDefault(); pesoExtraInp.focus(); pesoExtraInp.select();}});
  pesoExtraInp.addEventListener('keydown', e => { if (goKeys.includes(e.key)) { e.preventDefault(); btnReg.click(); }});

  // Inputs e validação
  [codigoInp, taraInp, pesoComPoteInp, pesoExtraInp].forEach(inp => {
    inp.addEventListener('input', () => {
      limpaErroCampo(inp.id + 'Error'); // Limpa erro específico ao digitar
      if (inp === pesoComPoteInp || inp === taraInp || inp === pesoExtraInp) {
        atualizaDisplayCalculoPeso();
      }
    });
    // Validação de entrada para campos numéricos
    if (inp.type === 'number') {
        inp.addEventListener('keypress', permiteApenasNumerosSeparador);
    }
  });


  // Input Código Produto (Blur) -> Busca Tara Automática
  codigoInp.addEventListener('blur', buscaTaraAutomatica);

  // Botões Tara Rápida (Dinâmicos)
  letras.addEventListener('click', handleTaraRapidaClick);
  const btnNenhumaFixo = document.querySelector('.tara-button[data-letra="Nenhuma"]');
  if (btnNenhumaFixo) {
      btnNenhumaFixo.addEventListener('click', handleTaraRapidaClick);
  }

  // Input Tara Manual -> Desmarca botão rápido
  taraInp.addEventListener('input', handleTaraManualInput);

  // Botão Registrar/Salvar Item Localmente
  btnReg.addEventListener('click', handleRegistrarOuSalvarItem);

  // Botão Enviar Todos
  enviarTodosBtn.addEventListener('click', enviarTodos);

  // Botão Limpar Locais
  btnLimpar.addEventListener('click', limparItensLocais);

  // Habilita/Desabilita botão Registrar ao digitar
  [codigoInp, pesoComPoteInp].forEach(el => el.addEventListener('input', updateBotaoRegistrar));
}

/* ---------- Nome Usuário ---------- */
function verificaNomeUsuario() {
  nomeUsuario = localStorage.getItem(NOME_USUARIO_KEY) || '';
  if (!nomeUsuario) { abrirModalNome(); } else { mostrarNome(); updateBotaoRegistrar(); }
}
function abrirModalNome() {
  inpNome.value = nomeUsuario; overlay.classList.add('active'); modal.classList.add('active'); inpNome.focus(); inpNome.select();
}
function fecharModalNome() {
    overlay.classList.remove('active');
    modal.classList.remove('active');
}
function salvaNome() {
  const n = inpNome.value.trim(); if (!n) { mostraMensagemErroCampo(inpNome, 'Por favor, digite seu nome.'); return; }
  limpaErroCampo(inpNome); // Limpa erro se houver
  nomeUsuario = n; localStorage.setItem(NOME_USUARIO_KEY, n); mostrarNome(); fecharModalNome(); updateBotaoRegistrar();
}
function mostrarNome() {
  nomeDisp.textContent = `Usuário: ${nomeUsuario}`;
}

/* ---------- Carregar Potes (Produtos) ---------- */
async function carregaPotes() {
  try { const response = await fetch('potes.json'); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); MAPA = data.reduce((map, pote) => { map[pote.codigo] = pote; return map; }, {}); console.log('Potes carregados:', Object.keys(MAPA).length); geraBotoesTara(); } catch (error) { console.error("Erro ao carregar potes.json:", error); letras.innerHTML = '<span class="text-red-500">Erro ao carregar potes.</span>'; }
}

/* ---------- Gerar Botões de Tara Rápida ---------- */
function geraBotoesTara() {
    letras.innerHTML = ''; const potesUnicos = {}; Object.values(MAPA).forEach(p => { if (p.letra && p.tara !== undefined && p.letra !== 'Nenhuma' && !potesUnicos[p.letra]) { potesUnicos[p.letra] = p.tara; } }); Object.keys(potesUnicos).sort().forEach(letra => { const tara = potesUnicos[letra]; const btn = document.createElement('button'); btn.className = 'tara-button'; btn.dataset.taraKg = tara; btn.dataset.letra = letra; btn.textContent = letra; letras.appendChild(btn); });
}

/* ---------- Funções de Tara ---------- */
function handleTaraRapidaClick(event) {
    const btn = event.target.closest('.tara-button');
    if (!btn) return;

    desmarcaBotoesTara();
    btn.classList.add('selected');
    taraInp.value = parseFloat(btn.dataset.taraKg).toFixed(3);
    limpaErroCampo(pesoTaraKgError); // Limpa erro se houver
    letraPoteSel = btn.dataset.letra;
    spanLetra.textContent = `(${letraPoteSel})`;

    if (letraPoteSel === 'Nenhuma') {
        pesoComPoteInp.value = '0.000'; // Define Peso COM POTE como 0
        pesoComPoteInp.classList.add('input-auto-filled'); // Estilo para indicar auto-preenchimento
        limpaErroCampo(pesoComPoteKgError);
        pesoExtraInp.focus();
        pesoExtraInp.select();
        updateBotaoRegistrar();
    } else {
        pesoComPoteInp.classList.remove('input-auto-filled');
        pesoComPoteInp.focus();
        pesoComPoteInp.select();
    }
    atualizaDisplayCalculoPeso();
}

function handleTaraManualInput() {
    desmarcaBotoesTara(); letraPoteSel = 'Manual'; spanLetra.textContent = '(Manual)';
    pesoComPoteInp.classList.remove('input-auto-filled'); // Remove estilo se tara for manual
    if (!taraInp.value.trim()) { selecionaBotaoNenhuma(); }
    atualizaDisplayCalculoPeso();
}
function desmarcaBotoesTara() {
    letras.querySelectorAll('.tara-button.selected').forEach(b => b.classList.remove('selected')); const btnNenhumaFixo = document.querySelector('.tara-button[data-letra="Nenhuma"]'); if(btnNenhumaFixo) btnNenhumaFixo.classList.remove('selected');
}
function selecionaBotaoNenhuma() {
    desmarcaBotoesTara(); const btnNenhumaFixo = document.querySelector('.tara-button[data-letra="Nenhuma"]'); if(btnNenhumaFixo) { btnNenhumaFixo.classList.add('selected'); taraInp.value = parseFloat(btnNenhumaFixo.dataset.taraKg).toFixed(3); letraPoteSel = 'Nenhuma'; spanLetra.textContent = '(Nenhuma)'; }
    atualizaDisplayCalculoPeso();
}

/* ---------- Busca Tara Automática ---------- */
function buscaTaraAutomatica() {
  const codigo = codigoInp.value.trim();
  limpaErroCampo(codigoProdutoError); // Limpa erro do código ao sair do campo
  const produto = MAPA[codigo];
  if (produto) {
    nomeDiv.textContent = produto.Nome || 'Produto sem nome';
    if (!taraInp.value.trim() || letraPoteSel === 'Nenhuma') {
        if (produto.tara !== undefined && produto.tara !== null) {
            taraInp.value = parseFloat(produto.tara).toFixed(3);
            desmarcaBotoesTara();
            const btnLetra = letras.querySelector(`.tara-button[data-letra="${produto.letra}"]`);
            if (btnLetra) { btnLetra.classList.add('selected'); letraPoteSel = produto.letra; spanLetra.textContent = `(${produto.letra})`; }
            else { if(produto.letra === 'Nenhuma') { selecionaBotaoNenhuma(); } else { letraPoteSel = 'Manual'; spanLetra.textContent = '(Manual)'; } }
        } else { selecionaBotaoNenhuma(); }
    }
  } else {
    if(codigo) nomeDiv.textContent = 'Produto não cadastrado'; // Feedback se código não encontrado
    else nomeDiv.textContent = '';
  }
  updateBotaoRegistrar();
  atualizaDisplayCalculoPeso();
}

/* ---------- Estado Botão Registrar/Salvar ---------- */
function updateBotaoRegistrar() {
  const podeRegistrar = nomeUsuario && codigoInp.value.trim() && pesoComPoteInp.value.trim();
  btnReg.disabled = !podeRegistrar;
  textoBotaoRegistrar.textContent = editandoItemId !== null ? 'Salvar Alterações' : 'Registrar Item Localmente';
}

/* ---------- Armazenamento Local ---------- */
function carregaLocais() { itens = JSON.parse(localStorage.getItem(ITENS_KEY) || '[]'); }
function salvaLocais() { localStorage.setItem(ITENS_KEY, JSON.stringify(itens)); renderizaLista(); }
function limparItensLocais() { if (enviando) { alert("Aguarde o término do envio atual."); return; } if (itens.length === 0) { mostraStatus('Nenhum item para limpar.', 'info'); return; } if (confirm(`Apagar ${itens.length} registro(s) locais?`)) { itens = []; salvaLocais(); mostraStatus('Registros locais limpos.', 'success'); } }

/* ---------- Validação e Feedback de Erro ---------- */
function permiteApenasNumerosSeparador(event) {
    const charCode = event.which ? event.which : event.keyCode;
    const currentValue = event.target.value;
    // Permite backspace, delete, tab, escape, enter, setas
    if (charCode === 8 || charCode === 46 || charCode === 9 || charCode === 27 || charCode === 13 || (charCode >= 35 && charCode <= 40)) {
        return;
    }
    // Permite . ou , como separador decimal (apenas um)
    if ((charCode === 46 || charCode === 44) && currentValue.indexOf('.') === -1 && currentValue.indexOf(',') === -1) {
        return;
    }
    // Permite apenas números
    if (charCode < 48 || charCode > 57) {
        event.preventDefault();
    }
}
function mostraMensagemErroCampo(campoIdOuElemento, mensagem) {
    const el = typeof campoIdOuElemento === 'string' ? $(campoIdOuElemento) : campoIdOuElemento;
    if (el) el.textContent = mensagem;

    // Adiciona classe de erro ao input correspondente se o ID do erro for ex: 'nomeInputError'
    const inputId = (typeof campoIdOuElemento === 'string' ? campoIdOuElemento : campoIdOuElemento.id).replace('Error', '');
    const inputEl = $(inputId);
    if (inputEl) inputEl.classList.add('input-error');
}
function limpaErroCampo(campoIdOuElemento) {
    const el = typeof campoIdOuElemento === 'string' ? $(campoIdOuElemento) : campoIdOuElemento;
    if (el) el.textContent = '';
    const inputId = (typeof campoIdOuElemento === 'string' ? campoIdOuElemento : campoIdOuElemento.id).replace('Error', '');
    const inputEl = $(inputId);
    if (inputEl) inputEl.classList.remove('input-error');
}
function limpaMensagensErro() {
    [codigoProdutoError, pesoTaraKgError, pesoComPoteKgError, pesoExtraKgError].forEach(el => limpaErroCampo(el));
}
function validaCamposFormulario() {
    limpaMensagensErro();
    let isValid = true;
    if (!codigoInp.value.trim()) {
        mostraMensagemErroCampo(codigoProdutoError, 'Código é obrigatório.');
        isValid = false;
    }
    const taraVal = parseFloat(taraInp.value.replace(',', '.'))
    if (isNaN(taraVal) && taraInp.value.trim() !== "") { // Permite tara vazia (será 0)
        mostraMensagemErroCampo(pesoTaraKgError, 'Tara inválida.');
        isValid = false;
    }
    const pesoComPoteVal = parseFloat(pesoComPoteInp.value.replace(',', '.'));
    if (isNaN(pesoComPoteVal) || pesoComPoteInp.value.trim() === "") {
        mostraMensagemErroCampo(pesoComPoteKgError, 'Peso com pote é obrigatório.');
        isValid = false;
    }
    const pesoExtraVal = parseFloat(pesoExtraInp.value.replace(',', '.'));
     if (isNaN(pesoExtraVal) && pesoExtraInp.value.trim() !== "") { // Permite extra vazio (será 0)
        mostraMensagemErroCampo(pesoExtraKgError, 'Peso extra inválido.');
        isValid = false;
    }
    return isValid;
}

/* ---------- Cálculo e Display Peso Líquido (Preview) ---------- */
function atualizaDisplayCalculoPeso() {
    const tara = parseFloat(taraInp.value.replace(',', '.')) || 0;
    const pesoComPote = parseFloat(pesoComPoteInp.value.replace(',', '.')) || 0;
    const pesoExtra = parseFloat(pesoExtraInp.value.replace(',', '.')) || 0;

    if (pesoComPoteInp.value.trim() === "") {
        calculoPesoLiquidoDisplay.textContent = "";
        return;
    }

    const pesoLiquidoPote = pesoComPote - tara;
    const pesoLiquidoTotal = +(pesoLiquidoPote + pesoExtra).toFixed(3);

    calculoPesoLiquidoDisplay.textContent = `Peso Líquido Calculado: ${pesoLiquidoTotal.toFixed(3)} kg`;
}


/* ---------- Registrar ou Salvar Item Localmente ---------- */
function handleRegistrarOuSalvarItem() {
    if (!validaCamposFormulario()) {
        mostraStatus('Verifique os erros no formulário.', 'error');
        return;
    }

    const codigo = codigoInp.value.trim();
    let taraInput = parseFloat(taraInp.value.replace(',', '.')) || 0;
    const pesoComPote = parseFloat(pesoComPoteInp.value.replace(',', '.')) || 0;
    const pesoExtra = parseFloat(pesoExtraInp.value.replace(',', '.')) || 0;

    let taraCalculo = taraInput;
    let letraPoteCalculo = letraPoteSel;

    if (pesoComPote === 0 && pesoComPoteInp.classList.contains('input-auto-filled')) { // Verifica se foi auto-preenchido com 0
        taraCalculo = 0;
        letraPoteCalculo = 'Nenhuma';
    }

    const pesoLiquidoPote = pesoComPote - taraCalculo;
    const pesoLiquidoTotal = +(pesoLiquidoPote + pesoExtra).toFixed(3);

    if (pesoLiquidoTotal <= 0 && pesoExtra <= 0 && pesoComPote > 0) {
        mostraMensagemErroCampo(pesoComPoteKgError, 'Peso Líquido Total zerado ou negativo.');
        return;
    } else if (pesoLiquidoTotal <= 0 && pesoExtra <= 0 && pesoComPote === 0 && codigoInp.value.trim()) {
        mostraMensagemErroCampo(pesoExtraKgError, 'Nenhum peso registrado (pote ou extra).');
        return;
    }

    const produtoInfo = MAPA[codigo] || {};
    const itemData = {
        timestamp: new Date().toISOString(), usuario: nomeUsuario,
        codigo: codigo, nomeProduto: produtoInfo.Nome || 'PRODUTO NÃO CADASTRADO',
        pesoLiquido: pesoLiquidoTotal, tara: taraCalculo, pesoComPote: pesoComPote,
        pesoExtra: pesoExtra, letraPote: letraPoteCalculo,
        statusEnvio: null // null, 'sucesso', 'falha'
    };

    if (editandoItemId !== null) {
        // Salvar alterações
        const index = itens.findIndex(item => item.id === editandoItemId);
        if (index > -1) {
            itens[index] = { ...itens[index], ...itemData, id: editandoItemId }; // Mantém o ID original
            mostraStatus('Item atualizado localmente!', 'success');
        }
        editandoItemId = null; // Reseta modo de edição
    } else {
        // Registrar novo item
        itemData.id = Date.now();
        itens.push(itemData);
        mostraStatus('Item registrado localmente!', 'success');
    }

    salvaLocais();
    limparFormulario();
    codigoInp.focus();
    updateBotaoRegistrar();
}

function limparFormulario() {
    codigoInp.value = ''; taraInp.value = ''; pesoComPoteInp.value = ''; pesoExtraInp.value = '';
    nomeDiv.textContent = '';
    calculoPesoLiquidoDisplay.textContent = "";
    pesoComPoteInp.classList.remove('input-auto-filled');
    selecionaBotaoNenhuma();
    editandoItemId = null; // Garante que saiu do modo edição
    textoBotaoRegistrar.textContent = 'Registrar Item Localmente';
    btnReg.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    btnReg.classList.add('bg-green-600', 'hover:bg-green-700');
    limpaMensagensErro();
}

/* ---------- Edição de Itens ---------- */
function iniciarEdicaoItem(id) {
    const itemParaEditar = itens.find(item => item.id === id);
    if (!itemParaEditar) return;

    editandoItemId = id;

    codigoInp.value = itemParaEditar.codigo;
    taraInp.value = itemParaEditar.tara.toFixed(3);
    pesoComPoteInp.value = itemParaEditar.pesoComPote.toFixed(3);
    pesoExtraInp.value = itemParaEditar.pesoExtra.toFixed(3);
    nomeDiv.textContent = itemParaEditar.nomeProduto; // Atualiza nome do produto

    // Seleciona botão de tara correto
    desmarcaBotoesTara();
    letraPoteSel = itemParaEditar.letraPote;
    const btnLetra = document.querySelector(`.tara-button[data-letra="${letraPoteSel}"]`);
    if (btnLetra) {
        btnLetra.classList.add('selected');
    } else { // Se for 'Manual' ou letra não encontrada
        letraPoteSel = 'Manual'; // Garante que seja 'Manual' se não houver botão
    }
    spanLetra.textContent = `(${letraPoteSel})`;
    pesoComPoteInp.classList.remove('input-auto-filled');


    textoBotaoRegistrar.textContent = 'Salvar Alterações';
    btnReg.classList.remove('bg-green-600', 'hover:bg-green-700');
    btnReg.classList.add('bg-yellow-500', 'hover:bg-yellow-600'); // Cor diferente para salvar
    updateBotaoRegistrar(); // Habilita o botão
    codigoInp.focus();
    atualizaDisplayCalculoPeso();
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola para o topo
}


/* ---------- Renderizar Lista de Pendentes ---------- */
function renderizaLista() {
  tbody.innerHTML = '';
  totalizadorPendentes.textContent = `Total de Itens: ${itens.length}`;

  if (itens.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">Nenhum item local pendente.</td></tr>';
    enviarTodosBtn.disabled = true;
    return;
  }

  enviarTodosBtn.disabled = enviando;

  [...itens].reverse().forEach((item) => {
    const tr = document.createElement('tr');
    if (item.statusEnvio === 'falha') tr.classList.add('bg-red-100'); // Destaca falhas

    // Formata para mostrar apenas a hora
    const horaFormatada = new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
      <td class="border px-1 py-1 sm:px-2">${item.codigo}</td>
      <td class="border px-1 py-1 sm:px-2 text-right">${item.pesoLiquido.toFixed(3)}</td>
      <td class="border px-1 py-1 sm:px-2 text-right">${item.tara.toFixed(3)} (${item.letraPote})</td>
      <td class="border px-1 py-1 sm:px-2 text-xs text-center">${horaFormatada}</td>
      <td class="border px-1 py-1 sm:px-2 text-center">
        <button class="text-blue-500 hover:text-blue-700 p-1 mr-1" data-edit-id="${item.id}" title="Editar este item">
          <i class="fas fa-edit"></i>
        </button>
        <button class="text-red-500 hover:text-red-700 p-1" data-delete-id="${item.id}" title="Excluir este item">
          <i class="fas fa-trash-alt"></i>
        </button>
        ${item.statusEnvio === 'falha' ? '<i class="fas fa-exclamation-triangle text-yellow-500 item-status-icon" title="Falha no último envio"></i>' : ''}
      </td>
    `;
    tr.querySelector(`button[data-edit-id="${item.id}"]`).addEventListener('click', () => iniciarEdicaoItem(item.id));
    tr.querySelector(`button[data-delete-id="${item.id}"]`).addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row) row.classList.add('fade-out');
        // Pequeno delay para a animação antes de realmente excluir
        setTimeout(() => excluirItem(item.id), 280);
    });
    tbody.appendChild(tr);
  });
}

function excluirItem(id) {
    if (enviando) { alert("Aguarde o término do envio atual."); return; }
    const itemIndex = itens.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        // Não precisa de confirm() aqui se a animação já deu um feedback
        itens.splice(itemIndex, 1);
        salvaLocais(); // Isso vai re-renderizar a lista
        // mostraStatus('Item excluído localmente.', 'info'); // Opcional, a remoção visual já é um feedback
    }
}


/* ---------- Envio para Google Apps Script ---------- */
async function enviarTodos() {
  if (enviando || itens.length === 0) return;

  const itensParaEnviarAgora = itens.filter(item => item.statusEnvio !== 'sucesso'); // Envia apenas os não enviados ou com falha

  if (itensParaEnviarAgora.length === 0) {
      mostraStatus('Nenhum item pendente ou com falha para enviar.', 'info');
      return;
  }


  enviando = true;
  enviarTodosBtn.disabled = true;
  textoBotaoEnviar.textContent = 'Enviando...';
  btnLimpar.disabled = true;
  btnReg.disabled = true;

  progressBarContainer.style.display = 'block';
  progressBar.style.width = '0%';

  let enviadosComSucessoCount = 0;
  let falhasCount = 0;

  for (let i = 0; i < itensParaEnviarAgora.length; i++) {
    const item = itensParaEnviarAgora[i];
    const progresso = Math.round(((i + 1) / itensParaEnviarAgora.length) * 100);
    mostraStatus(`Enviando ${i + 1}/${itensParaEnviarAgora.length}: Código ${item.codigo}...`, 'sending', 0, progresso);

    try {
      const resultadoEnvio = await enviarItem(item);
       if (resultadoEnvio && resultadoEnvio.result === 'success' && resultadoEnvio.idLocal == item.id) {
           enviadosComSucessoCount++;
           // Marca como sucesso no array original 'itens'
           const indexOriginal = itens.findIndex(original => original.id === item.id);
           if (indexOriginal > -1) itens[indexOriginal].statusEnvio = 'sucesso';
       } else {
           throw new Error(resultadoEnvio.message || 'Resposta inesperada do servidor.');
       }
    } catch (error) {
      console.error('Falha ao enviar item:', item.id, error);
      falhasCount++;
      const indexOriginal = itens.findIndex(original => original.id === item.id);
      if (indexOriginal > -1) itens[indexOriginal].statusEnvio = 'falha';
      mostraStatus(`Falha item ${item.codigo}: ${error.message}`, 'error', 5000, progresso); // Mostra erro específico
      await new Promise(resolve => setTimeout(resolve, ENVIO_DELAY_MS * 1.5)); // Pausa maior em erro
    }
    if (i < itensParaEnviarAgora.length - 1) {
      await new Promise(resolve => setTimeout(resolve, ENVIO_DELAY_MS));
    }
  }

  salvaLocais(); // Salva os status de envio atualizados

  enviando = false;
  btnLimpar.disabled = false;
  updateBotaoRegistrar();
  textoBotaoEnviar.textContent = 'Enviar Pendentes';
  progressBarContainer.style.display = 'none';


  if (falhasCount === 0 && enviadosComSucessoCount > 0) {
    mostraStatus(`Todos os ${enviadosComSucessoCount} itens foram enviados com sucesso!`, 'success');
  } else if (falhasCount > 0 && enviadosComSucessoCount > 0) {
    mostraStatus(`${enviadosComSucessoCount} itens enviados, ${falhasCount} falharam.`, 'error');
  } else if (falhasCount > 0 && enviadosComSucessoCount === 0) {
    mostraStatus(`Falha ao enviar todos os ${falhasCount} itens.`, 'error');
  } else if (enviadosComSucessoCount === 0 && falhasCount === 0 && itensParaEnviarAgora.length > 0) {
     mostraStatus('Nenhum item processado. Verifique.', 'info');
  } else {
     mostraStatus('Não havia itens para enviar.', 'info');
  }
}

async function enviarItem(item) {
  const formData = new FormData();
  formData.append('timestamp', item.timestamp); formData.append('usuario', item.usuario);
  formData.append('codigo', item.codigo); formData.append('nomeProduto', item.nomeProduto);
  formData.append('pesoLiquido', item.pesoLiquido); formData.append('tara', item.tara);
  formData.append('pesoComPote', item.pesoComPote); formData.append('pesoExtra', item.pesoExtra);
  formData.append('letraPote', item.letraPote); formData.append('idLocal', item.id);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: formData });
    let responseData = {}; const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) { responseData = await response.json(); }
    else { const textResponse = await response.text(); console.error("Resposta não JSON:", response.status, textResponse); throw new Error(`Erro ${response.status}: Resposta inválida.`); }
    if (!response.ok) { console.error('Erro HTTP:', response.status, responseData); throw new Error(responseData.message || `Erro de rede ${response.status}`); }
    if(responseData.result !== 'success') { console.error('Script Erro:', responseData); throw new Error(responseData.message || `Erro script.`); }
    console.log('Sucesso script idLocal', item.id, ':', responseData); return responseData;
  } catch (error) { console.error("Falha fetch/processamento idLocal:", item.id, error); return { result: 'error', message: error.message, idLocal: item.id }; }
}

/* ---------- UI Feedback (Status) ---------- */
let statusTimeout;
function mostraStatus(mensagem, tipo = 'info', duracaoMs = 4000, progresso = -1) {
  clearTimeout(statusTimeout);
  statusMensagem.textContent = mensagem;
  statusDiv.className = `status-base status-${tipo}`;
  statusDiv.style.display = 'block';

  if (progresso >= 0) {
    progressBarContainer.style.display = 'block';
    progressBar.style.width = `${progresso}%`;
  } else {
    progressBarContainer.style.display = 'none';
  }

  if (tipo !== 'sending' && duracaoMs > 0) {
    statusTimeout = setTimeout(() => {
      statusDiv.style.display = 'none'; statusMensagem.textContent = ''; statusDiv.className = 'status-base'; progressBarContainer.style.display = 'none';
    }, duracaoMs);
  }
}
