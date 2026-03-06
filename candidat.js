function cloneWithValues(node) {
  const clone = node.cloneNode(true);
  const originals = node.querySelectorAll('input, textarea, select');
  const clones = clone.querySelectorAll('input, textarea, select');

  originals.forEach((orig, i) => {
    const c = clones[i];
    if (!c) return;

    if (orig.tagName === 'INPUT') {
      if (orig.type === 'checkbox' || orig.type === 'radio') c.checked = orig.checked;
      else c.value = orig.value;
    } else if (orig.tagName === 'TEXTAREA') {
      c.value = orig.value;
    } else if (orig.tagName === 'SELECT') {
      c.value = orig.value;
    }
  });

  return clone;
}

function convertTextareasForPdf(root) {
  root.querySelectorAll('textarea').forEach((ta) => {
    ta.style.height = 'auto';
    ta.style.overflow = 'hidden';
    ta.style.resize = 'none';
    ta.style.height = ta.scrollHeight + 'px';

    const cs = window.getComputedStyle(ta);
    const block = document.createElement('div');
    const rect = ta.getBoundingClientRect();

    block.textContent = ta.value || '';
    block.style.whiteSpace = 'pre-wrap';
    block.style.overflowWrap = 'break-word';
    block.style.wordBreak = 'break-word';
    block.style.boxSizing = 'border-box';
    block.style.width = rect.width && rect.width > 0 ? rect.width + 'px' : '100%';
    block.style.minHeight = ta.scrollHeight + 'px';
    block.style.padding = cs.padding;
    block.style.border = cs.border;
    block.style.borderRadius = cs.borderRadius;
    block.style.background = cs.backgroundColor;
    block.style.color = cs.color;
    block.style.font = cs.font;
    block.style.lineHeight = cs.lineHeight;

    ta.replaceWith(block);
  });
}

function convertChecksForPdf(root) {
  root.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach((cb) => {
    const marker = document.createElement('span');
    marker.style.display = 'inline-flex';
    marker.style.alignItems = 'center';
    marker.style.justifyContent = 'center';
    marker.style.width = '16px';
    marker.style.minWidth = '16px';
    marker.style.height = '16px';
    marker.style.marginRight = '8px';
    marker.style.boxSizing = 'border-box';
    marker.style.borderRadius = cb.type === 'radio' ? '50%' : '3px';
    marker.style.border = cb.checked ? '1px solid #1f8a58' : '1px solid #8b8b8b';
    marker.style.backgroundColor = cb.checked ? '#1f8a58' : 'transparent';
    marker.style.verticalAlign = 'middle';
    cb.replaceWith(marker);
  });
}

function clearEmptyPlaceholdersForPdf(root) {
  root.querySelectorAll('input, textarea').forEach((field) => {
    const value = (field.value || '').trim();
    if (!value) field.removeAttribute('placeholder');
  });
}

function getJsPDFCtor() {
  return window.jspdf?.jsPDF || window.jsPDF || window.jsPDF?.jsPDF || window.jspdf?.default?.jsPDF;
}

async function generatePdf() {
  let wrapper = null;
  try {
    const jsPDF = getJsPDFCtor();
    if (!window.html2canvas) throw new Error('html2canvas introuvable');
    if (!jsPDF) throw new Error('jsPDF introuvable');

    const form = document.getElementById('formMateriel');
    if (!form) throw new Error('Formulaire introuvable');

    const formClone = cloneWithValues(form);
    formClone.style.boxShadow = 'none';
    formClone.style.margin = '0';
    formClone.style.padding = '20px';
    formClone.style.width = '1000px';
    formClone.style.backgroundColor = '#c9d9e8';

    wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-99999px';
    wrapper.style.top = '-99999px';
    wrapper.style.width = '1040px';
    wrapper.appendChild(formClone);
    document.body.appendChild(wrapper);

    clearEmptyPlaceholdersForPdf(formClone);
    convertTextareasForPdf(formClone);
    convertChecksForPdf(formClone);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const pages = Array.from(formClone.querySelectorAll('.pdf-page'));
    if (pages[1]) {
      // Page 2: occupy A4 height and breathe more in PDF export only.
      pages[1].style.minHeight = '1380px';
      pages[1].style.display = 'flex';
      pages[1].style.flexDirection = 'column';
      const expWrap = pages[1].querySelector('.exp-table-wrap');
      if (expWrap) expWrap.style.marginBottom = '16px';
      const notesExp = pages[1].querySelector('textarea[name="notes_experience"]');
      if (notesExp) {
        notesExp.style.minHeight = '180px';
        notesExp.style.flex = '1';
      }
    }

    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: false });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const usableWidth = pdfWidth - margin * 2;
    const usableHeight = pdfHeight - margin * 2;

    const targets = pages.length ? pages : [formClone];
    for (let i = 0; i < targets.length; i++) {
      const page = targets[i];
      const canvas = await html2canvas(page, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#c9d9e8',
        logging: false,
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight
      });

      const ratio = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
      const drawWidth = canvas.width * ratio;
      const drawHeight = canvas.height * ratio;
      const x = margin + (usableWidth - drawWidth) / 2;
      const y = margin + (usableHeight - drawHeight) / 2;
      const imgData = canvas.toDataURL('image/png', 1.0);

      if (i > 0) pdf.addPage();
      pdf.setFillColor(201, 217, 232);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      pdf.addImage(imgData, 'PNG', x, y, drawWidth, drawHeight, undefined, 'FAST');
    }

    pdf.save('Fiche_Renseignements_Candidat.pdf');
  } catch (error) {
    console.error('Erreur PDF:', error);
    alert('Erreur lors de la generation du PDF: ' + error.message);
  } finally {
    if (wrapper) wrapper.remove();
  }
}

function limitExpTableTextareasToThreeLines() {
  const maxLines = 3;
  const areas = document.querySelectorAll('.exp-table textarea');
  if (!areas.length) return;

  const clamp = (el) => {
    const normalized = el.value.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    if (lines.length <= maxLines) return;
    el.value = lines.slice(0, maxLines).join('\n');
  };

  areas.forEach((el) => {
    el.addEventListener('input', () => clamp(el));
    el.addEventListener('paste', () => {
      requestAnimationFrame(() => clamp(el));
    });
  });
}

limitExpTableTextareasToThreeLines();
const btnPDF = document.getElementById('btnDownloadPDF');
if (btnPDF) btnPDF.addEventListener('click', generatePdf);

window.generatePdf = generatePdf;
