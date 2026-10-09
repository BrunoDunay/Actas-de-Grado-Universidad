(() => {
  'use strict';

  const STORE_KEY = 'acta-unade-v1';
  const PAGE_MM = { w: 215.9, h: 279.4 };
  // proporción del óvalo de la foto en el acta: 49 × 66 mm
  const PHOTO_PX = { w: 588, h: 792 };
  const NBSP = ' ';

  // RVOE de cada carrera: [número de acuerdo, grado, fecha de otorgamiento]
  const CARRERAS = [
    ['20231731', 'Licenciatura en Ingeniería Industrial y Logística', '19/6/2023'],
    ['20231732', 'Licenciatura en Ingeniería en Ciencia de Datos e Inteligencia Artificial', '19/6/2023'],
    ['20231733', 'Licenciatura en Mercadotecnia Digital', '19/6/2023'],
    ['20231734', 'Licenciatura en Administración y Dirección de Empresas', '19/6/2023'],
    ['20231735', 'Licenciatura en Derecho', '19/6/2023'],
    ['20231736', 'Licenciatura en Ciencias de la Educación', '19/6/2023'],
    ['20231737', 'Doctorado en Educación, Altas Capacidades y Tecnologías Disruptivas', '19/6/2023'],
    ['20231738', 'Maestría en Innovación Educativa y Altas Capacidades', '19/6/2023'],
    ['20231739', 'Maestría en Negocios Digitales e Innovación', '19/6/2023'],
    ['20231740', 'Maestría en Dirección y Administración de Empresas', '19/6/2023'],
    ['20231741', 'Maestría en Calidad y Logística', '19/6/2023'],
    ['20231742', 'Maestría en Administración de Enfermería', '19/6/2023'],
    ['20231743', 'Maestría en Ética y Derechos Humanos', '19/6/2023'],
    ['20241055', 'Maestría en Dirección y Administración de Empresas', '23/5/2024'],
    ['20241056', 'Maestría en Política y Gestión Pública', '23/5/2024'],
    ['20241057', 'Maestría en Negocios Digitales e Innovación', '23/5/2024'],
    ['20241058', 'Maestría en Educación e Innovación para el Aprendizaje', '23/5/2024'],
    ['20261381', 'Maestría en Administración y Gestión de Servicios de Salud', '27/3/2026'],
    ['20261382', 'Doctorado en Derecho', '27/3/2026'],
  ].map(([rvoe, grado, fecha]) => ({
    rvoe, grado, fecha, acuerdo: `${rvoe.slice(0, 4)}-${rvoe.slice(4)}`,
  }));

  const $ = (id) => document.getElementById(id);
  const form = $('form');
  const page = $('page');
  const scaler = $('scaler');
  const preview = $('preview');
  const statusEl = $('status');
  const inputs = [...form.querySelectorAll('[data-f]')];
  const defaults = Object.fromEntries(inputs.map((el) => [el.dataset.f, readInput(el)]));

  const photo = { img: null, dataUrl: null };
  let sign = null; // { dataUrl, w, h }

  function readInput(el) {
    return el.type === 'checkbox' ? el.checked : el.value.trim();
  }

  function writeInput(el, value) {
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value ?? '';
  }

  function getData() {
    return Object.fromEntries(inputs.map((el) => [el.dataset.f, readInput(el)]));
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', isError);
  }

  /* ---------- vista previa ---------- */

  function render() {
    const data = getData();
    page.querySelectorAll('[data-pv]').forEach((el) => {
      el.textContent = data[el.dataset.pv] || NBSP;
    });
    $('pvVobo').hidden = !data.vobo;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch { /* almacenamiento no disponible: se sigue sin guardar */ }
  }

  function fitPreview() {
    const scale = Math.min(1, preview.clientWidth / page.offsetWidth);
    scaler.style.transform = `scale(${scale})`;
    preview.style.height = `${page.offsetHeight * scale}px`;
  }

  function restore() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY));
    } catch { /* datos guardados ilegibles: se usan los valores por defecto */ }
    if (!saved) return;
    inputs.forEach((el) => {
      if (el.dataset.f in saved) writeInput(el, saved[el.dataset.f]);
    });
  }

  /* ---------- carreras ---------- */

  const field = (name) => inputs.find((el) => el.dataset.f === name);

  [...CARRERAS]
    .sort((a, b) => a.grado.localeCompare(b.grado, 'es') || a.rvoe.localeCompare(b.rvoe))
    .forEach((c) => $('carrera').add(new Option(`${c.grado} · ${c.acuerdo}`, c.rvoe)));

  // si el grado no cabe holgado en un renglón, se reparte en dos lo más parejo posible
  function splitGrado(grado) {
    const fld = page.querySelector('[data-pv="grado"]');
    const cs = getComputedStyle(fld);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const width = (t) => ctx.measureText(t).width;
    const room = (fld.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.9;
    if (width(grado) <= room) return [grado, ''];

    const words = grado.split(' ');
    let best = [grado, ''];
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const diff = Math.abs(width(lines[0]) - width(lines[1]));
      if (diff < bestDiff) [best, bestDiff] = [lines, diff];
    }
    return best;
  }

  function applyCarrera(c) {
    const [grado, grado2] = splitGrado(c.grado);
    writeInput(field('carrera'), c.rvoe);
    writeInput(field('grado'), grado);
    writeInput(field('grado2'), grado2);
    writeInput(field('acuerdo'), c.acuerdo);
    writeInput(field('fechaAcuerdo'), c.fecha);
  }

  /* ---------- imágenes ---------- */

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPhoto() {
    const { img } = photo;
    const pv = $('pvPhoto');
    const hasPhoto = !!img;
    pv.hidden = !hasPhoto;
    $('pvPhotoEmpty').hidden = hasPhoto;
    $('photoControls').hidden = !hasPhoto;
    $('photoClear').hidden = !hasPhoto;
    if (!hasPhoto) {
      photo.dataUrl = null;
      pv.removeAttribute('src');
      return;
    }

    const { w, h } = PHOTO_PX;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();

    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * Number($('photoZoom').value);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // el deslizador va de -1 a 1 y recorre todo el sobrante de la imagen
    const dx = ((w - dw) / 2) * (1 + Number($('photoX').value));
    const dy = ((h - dh) / 2) * (1 + Number($('photoY').value));
    ctx.drawImage(img, dx, dy, dw, dh);

    if ($('photoGray').checked) {
      const pixels = ctx.getImageData(0, 0, w, h);
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      ctx.putImageData(pixels, 0, 0);
    }

    photo.dataUrl = canvas.toDataURL('image/png');
    pv.src = photo.dataUrl;
  }

  function renderSign() {
    const pv = $('pvSign');
    pv.hidden = !sign;
    $('signClear').hidden = !sign;
    if (sign) pv.src = sign.dataUrl;
    else pv.removeAttribute('src');
  }

  function clearPhoto() {
    photo.img = null;
    $('photoInput').value = '';
    $('photoZoom').value = 1;
    $('photoX').value = 0;
    $('photoY').value = 0;
    renderPhoto();
  }

  function dataUrlToBytes(dataUrl) {
    const bin = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /* ---------- exportación ---------- */

  function fileBaseName(data) {
    const name = (data.nombre || '').replace(/[\\/:*?"<>|]/g, '').trim().toUpperCase();
    return name ? `${name} - ACTA GRADO` : 'ACTA GRADO';
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildPdfBlob() {
    await document.fonts.ready;
    const canvas = await html2canvas(page, {
      scale: 3,
      backgroundColor: '#ffffff',
      // la vista previa está escalada; el clon se captura a tamaño real
      onclone: (doc) => {
        doc.getElementById('scaler').style.transform = 'none';
        doc.getElementById('page').style.boxShadow = 'none';
      },
    });
    const pdf = new jspdf.jsPDF({ unit: 'mm', format: [PAGE_MM.w, PAGE_MM.h], compress: true });
    pdf.setProperties({ title: fileBaseName(getData()) });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_MM.w, PAGE_MM.h);
    return pdf.output('blob');
  }

  async function buildDocxBlob() {
    const D = docx;
    const data = getData();
    const tw = (mm) => Math.round(mm * 56.6929);
    const px = (mm) => Math.round((mm * 96) / 25.4);

    const logoBytes = new Uint8Array(await (await fetch('assets/logo-unade.png')).arrayBuffer());
    const logoEl = $('pvLogo');
    const logoMm = { w: 62, h: (62 * logoEl.naturalHeight) / logoEl.naturalWidth };

    const text = (t, extra = {}) => new D.TextRun({ text: t, font: 'Calibri', size: 24, ...extra });
    const valueStyle = { font: 'Century Gothic', size: 19, underline: { type: D.UnderlineType.SINGLE } };
    // campo en línea: el subrayado se alarga con espacios duros a cada lado
    const field = (v, pad) => new D.TextRun({
      text: v ? NBSP.repeat(pad) + v + NBSP.repeat(pad) : NBSP.repeat(pad * 2 + 8),
      ...valueStyle,
    });
    const colW = 136;
    const lineTabs = [
      { type: D.TabStopType.CENTER, position: tw(colW / 2) },
      { type: D.TabStopType.RIGHT, position: tw(colW - 0.5) },
    ];
    // campo de renglón completo: tabuladores subrayados a ambos lados del valor
    const lineField = (v, spacing) => new D.Paragraph({
      tabStops: lineTabs,
      spacing,
      children: [new D.TextRun({ children: [new D.Tab(), v || '', new D.Tab()], ...valueStyle })],
    });
    const para = (children, opts = {}) => new D.Paragraph({ children, ...opts });

    const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: none, bottom: none, left: none, right: none };
    const cell = (mm, children) => new D.TableCell({
      width: { size: tw(mm), type: D.WidthType.DXA },
      borders: noBorders,
      children,
    });

    // sin foto queda una rayita al pie del espacio, como guía para pegarla a mano
    const photoCell = [photo.dataUrl
      ? para([new D.ImageRun({
        type: 'png',
        data: dataUrlToBytes(photo.dataUrl),
        transformation: { width: px(49), height: px(66) },
      })], { spacing: { before: tw(41) } })
      : para([text('_'.repeat(5), { size: 16, color: 'B5B5B5' })], { indent: { left: tw(20.5) }, spacing: { before: tw(41 + 62) } })];

    const bodyCell = [
      para([text('ACTA DE GRADO')], {
        alignment: D.AlignmentType.CENTER,
        spacing: { before: tw(29), after: tw(8) },
      }),
      para([
        text('En '), field(data.lugar, 2), text(', a las '), field(data.hora, 5),
        text(' horas del día '), field(data.dia, 6), text(' del mes'),
      ], { spacing: { after: tw(5.5) } }),
      para([
        text('de '), field(data.mes, 12), text(' de '), field(data.anio, 8),
        text(', de conformidad con'),
      ], { spacing: { after: tw(4) } }),
      lineField(data.fundamento, { after: tw(5) }),
      para([text('establecido en el reglamento institucional vigente, se procede a expedir la presente acta para obtener el grado de:')], {
        alignment: D.AlignmentType.JUSTIFIED,
        spacing: { after: tw(1.5) },
      }),
      lineField(data.grado, { after: tw(6.5) }),
      lineField(data.grado2, { after: tw(12) }),
      para([text('Con Reconocimiento de Validez Oficial de la S.E.P.,')]),
      para([
        text('según acuerdo No. '), field(data.acuerdo, 4), text(' de fecha '),
        field(data.fechaAcuerdo, 8), text(', a favor de:'),
      ], { spacing: { after: tw(11) } }),
      lineField(data.nombre, { after: tw(12) }),
      para([text('Quien demostró cumplir con los estudios correspondientes y aprobó')], {
        alignment: D.AlignmentType.DISTRIBUTE,
      }),
      para([
        text('conforme '),
        new D.TextRun({ children: [NBSP + (data.conforme || ''), new D.Tab()], ...valueStyle }),
      ], { tabStops: [lineTabs[1]] }),
    ];

    const signChildren = [];
    if (sign) {
      const fit = Math.min(60 / sign.w, 24 / sign.h);
      signChildren.push(new D.ImageRun({
        type: 'png',
        data: dataUrlToBytes(sign.dataUrl),
        transformation: { width: px(sign.w * fit), height: px(sign.h * fit) },
      }));
    }
    const centered = { alignment: D.AlignmentType.CENTER, indent: { left: tw(5) } };

    const doc = new D.Document({
      title: fileBaseName(data),
      sections: [{
        properties: {
          page: {
            size: { width: tw(PAGE_MM.w), height: tw(PAGE_MM.h) },
            margin: { top: tw(13), bottom: tw(10), left: tw(9), right: tw(10.9) },
          },
        },
        children: [
          para([
            new D.ImageRun({
              type: 'png',
              data: logoBytes,
              transformation: { width: px(logoMm.w), height: px(logoMm.h) },
            }),
            new D.TextRun({
              children: [new D.Tab(), data.encabezado || ''],
              font: 'Times New Roman', size: 24, bold: true,
            }),
          ], {
            indent: { left: tw(5) },
            tabStops: [{ type: D.TabStopType.RIGHT, position: tw(189) }],
          }),
          new D.Table({
            width: { size: tw(60 + colW), type: D.WidthType.DXA },
            columnWidths: [tw(60), tw(colW)],
            layout: D.TableLayoutType.FIXED,
            borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            rows: [new D.TableRow({ children: [cell(60, photoCell), cell(colW, bodyCell)] })],
          }),
          para([text('En virtud de lo anterior se procedió a tomar la protesta de ley.')], {
            indent: { left: tw(47.5) },
            spacing: { before: tw(22) },
          }),
          para(signChildren, { ...centered, spacing: { before: tw(sign ? 6 : 22) } }),
          para(data.vobo ? [new D.TextRun({ text: 'Vo.Bo.', font: 'Century Gothic', size: 15 })] : [], centered),
          para([text('_'.repeat(24))], { ...centered, spacing: { before: 0, after: tw(3) } }),
          para([new D.TextRun({ text: data.firmante || '', font: 'Century Gothic', size: 19 })], centered),
        ],
      }],
    });

    return D.Packer.toBlob(doc);
  }

  async function exportWith(button, builder, ext) {
    const data = getData();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Generando…';
    try {
      const blob = await builder();
      download(blob, `${fileBaseName(data)}.${ext}`);
      const required = { nombre: 'nombre', grado: 'grado', dia: 'día', mes: 'mes', anio: 'año' };
      const missing = Object.keys(required).filter((k) => !data[k]).map((k) => required[k]);
      setStatus(missing.length
        ? `Archivo generado. Ojo: quedaron vacíos ${missing.join(', ')}.`
        : 'Archivo generado.');
    } catch (err) {
      console.error(err);
      setStatus(`No se pudo generar el archivo: ${err.message}`, true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  /* ---------- eventos ---------- */

  // estos dos van antes del 'input' del formulario, que es el que redibuja
  field('carrera').addEventListener('input', (e) => {
    const c = CARRERAS.find((x) => x.rvoe === e.target.value);
    if (c) applyCarrera(c);
  });
  field('acuerdo').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    const c = CARRERAS.find((x) => x.rvoe === digits);
    if (c) applyCarrera(c);
    else writeInput(field('carrera'), '');
  });

  form.addEventListener('input', (e) => {
    if (e.target.matches('[data-f]')) render();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  $('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo.img = await loadImage(file);
      renderPhoto();
      setStatus('');
    } catch (err) {
      setStatus(err.message, true);
    }
  });
  ['photoZoom', 'photoX', 'photoY', 'photoGray'].forEach((id) => $(id).addEventListener('input', renderPhoto));
  $('photoClear').addEventListener('click', clearPhoto);

  $('signInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(file);
      // se normaliza a PNG para poder incrustarla igual en Word
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      sign = { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
      renderSign();
      setStatus('');
    } catch (err) {
      setStatus(err.message, true);
    }
  });
  $('signClear').addEventListener('click', () => {
    sign = null;
    $('signInput').value = '';
    renderSign();
  });

  $('btnPdf').addEventListener('click', (e) => exportWith(e.currentTarget, buildPdfBlob, 'pdf'));
  $('btnDocx').addEventListener('click', (e) => exportWith(e.currentTarget, buildDocxBlob, 'docx'));
  $('btnPrint').addEventListener('click', () => window.print());

  $('btnNew').addEventListener('click', () => {
    inputs.filter((el) => el.dataset.f === 'nombre').forEach((el) => writeInput(el, ''));
    clearPhoto();
    render();
    setStatus('Se borraron el nombre y la foto; revisa que el resto de los datos aplique al nuevo sustentante.');
  });
  $('btnReset').addEventListener('click', () => {
    inputs.forEach((el) => writeInput(el, defaults[el.dataset.f]));
    clearPhoto();
    sign = null;
    $('signInput').value = '';
    renderSign();
    render();
    setStatus('Formulario reiniciado.');
  });

  window.addEventListener('resize', fitPreview);

  restore();
  render();
  renderPhoto();
  renderSign();
  fitPreview();

  window.ActaApp = { buildPdfBlob, buildDocxBlob };
})();
