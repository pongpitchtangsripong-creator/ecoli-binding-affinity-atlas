const COLORS = { drug: '#D96868', target: '#9FA1FF', substrate: '#249D8F' };
const cases = {
  cam: { viewerId: 'viewer-cam', file: 'structures/50S_ecoli_chloramphenicol_bound.pdb', format: 'pdb' },
  trna: { viewerId: 'viewer-trna', file: 'structures/8G6Y.cif', format: 'cif' },
  cef: { viewerId: 'viewer-cef', file: 'structures/PBP3_ecoli_cefuroxime_docked.pdb', format: 'pdb' },
  'pbp-native': { viewerId: 'viewer-pbp-native', file: 'structures/PBP3_ecoli_apo.pdb', format: 'pdb' }
};

let activeCase = 'cam';
const viewers = {};
const models = {};
const loaded = {};
let interactionsVisible = false;

const interactionDetails = {
  cam: {
    title: 'Visible CAM contacts — atom-to-atom labels',
    note: 'Distances are measured directly from the experimental 4V7T coordinates. Dashed cylinders show geometry, not covalent bonds.',
    items: [
      ['CLM O2 ··· G2061 N1 — 3.05 Å', 'Polar contact'],
      ['CLM O4 ··· G2505 OP2 — 2.88 Å', 'Polar contact to the rRNA phosphate'],
      ['CLM O5 ··· C2452 N3 — 3.03 Å', 'Close contact beside the C2452 stacking zone']
    ]
  },
  cef: {
    title: 'Visible CEF contacts — computational pose',
    note: 'These distances come from the displayed geometric docking pose, not an experimental cefuroxime–E. coli PBP3 structure. The red line marks the proposed acylation direction.',
    items: [
      ['CEF C10 ··· Ser307 Oγ — 2.11 Å', 'β-lactam carbonyl carbon toward the catalytic nucleophile'],
      ['CEF O3 ··· Asn361 ND2 — 2.99 Å', 'Polar contact in the catalytic pocket'],
      ['CEF C8 ··· Lys310 Nζ — 3.30 Å', 'Close pose contact; Lys310 supports catalysis']
    ]
  },
  trna: {
    title: 'Native ribosomal binding interface',
    note: 'A- and P-site tRNAs make an extensive RNA/protein interface rather than one discrete drug-like bond. The viewer labels the two tRNAs and their placement in the ribosome.',
    items: []
  },
  'pbp-native': {
    title: 'Native PBP3 substrate — illustrative path only',
    note: 'No atomistic E. coli PBP3–stem-peptide pose is present in this model, so drawing precise bond lines would be misleading. The green path marks the proposed substrate route near Ser307.',
    items: []
  }
};

function backgroundColor() {
  return matchMedia('(prefers-color-scheme: dark)').matches ? '#1b242c' : '#f4f6f8';
}

async function loadCase(key) {
  if (loaded[key]) { viewers[key].resize(); return; }
  const spec = cases[key];
  const element = document.getElementById(spec.viewerId);
  const viewer = $3Dmol.createViewer(element, { backgroundColor: backgroundColor(), antialias: true });
  viewers[key] = viewer;
  try {
    const response = await fetch(spec.file);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = await response.text();
    element.querySelector('.loading')?.remove();
    const model = viewer.addModel(text, spec.format);
    models[key] = model;
    styleCase(key, false);
    loaded[key] = true;
  } catch (error) {
    element.innerHTML = `<div class="loading">Could not load model: ${error.message}</div>`;
  }
}

function styleCase(key, siteView) {
  const viewer = viewers[key];
  const model = models[key];
  if (!viewer || !model) return;
  viewer.removeAllShapes();
  viewer.removeAllLabels();
  if (viewer.removeAllSurfaces) viewer.removeAllSurfaces();
  model.setStyle({}, {});

  if (key === 'cam') {
    model.setStyle({not:{resn:'CLM'}}, {cartoon:{color:COLORS.target, opacity:siteView ? .22 : .78}});
    model.setStyle({resn:'CLM'}, {stick:{color:COLORS.drug, radius:.24}, sphere:{color:COLORS.drug, scale:.28}});
    if (siteView) viewer.addStyle({within:{distance:5.0, sel:{resn:'CLM'}}, not:{resn:'CLM'}}, {stick:{colorscheme:'Jmol', radius:.13}});
    viewer.zoomTo(siteView ? {resn:'CLM'} : {});
  }

  if (key === 'trna') {
    model.setStyle({}, {cartoon:{color:COLORS.target, opacity:siteView ? .18 : .60}});
    model.setStyle({chain:['Y','Z']}, {cartoon:{color:COLORS.substrate, opacity:1}, stick:{color:COLORS.substrate, radius:.09}});
    model.setStyle({chain:'X'}, {stick:{color:'#7f8993', radius:.10}});
    viewer.zoomTo(siteView ? {chain:['Y','Z']} : {});
  }

  if (key === 'cef') {
    model.setStyle({not:{resn:'LIG'}}, {cartoon:{color:COLORS.target, opacity:siteView ? .30 : .88}});
    model.setStyle({resn:'LIG'}, {stick:{color:COLORS.drug, radius:.22}, sphere:{color:COLORS.drug, scale:.25}});
    viewer.addStyle({resi:[307,310,359,361,494,495,496,497]}, {stick:{colorscheme:'Jmol', radius:.14}});
    viewer.zoomTo(siteView ? {resn:'LIG'} : {});
  }

  if (key === 'pbp-native') {
    model.setStyle({}, {cartoon:{color:COLORS.target, opacity:siteView ? .36 : .88}});
    viewer.addStyle({resi:[307,310,359,361,494,495,496,497]}, {stick:{colorscheme:'Jmol', radius:.14}});
    const atoms = model.selectedAtoms({resi:[307,310,359,361,494,495,496,497]});
    const center = atoms.length ? atoms.reduce((p,a)=>({x:p.x+a.x/atoms.length,y:p.y+a.y/atoms.length,z:p.z+a.z/atoms.length}),{x:0,y:0,z:0}) : {x:0,y:0,z:0};
    const pts = [
      {x:center.x-7,y:center.y+3,z:center.z+1},
      {x:center.x-4,y:center.y+1.7,z:center.z+.3},
      {x:center.x-1,y:center.y+.7,z:center.z-.2},
      {x:center.x+2,y:center.y-.1,z:center.z+.4},
      {x:center.x+5,y:center.y-1.0,z:center.z+1.2}
    ];
    pts.forEach((p,i)=>{
      viewer.addSphere({center:p,radius:.75,color:COLORS.substrate,opacity:.95});
      if(i) viewer.addCylinder({start:pts[i-1],end:p,radius:.26,color:COLORS.substrate,opacity:.9});
    });
    viewer.addLabel('illustrative stem-peptide path', {position:pts[2],fontColor:COLORS.substrate,backgroundColor:'transparent',fontSize:12});
    viewer.zoomTo(siteView ? {resi:[307,310,359,361,494,495,496,497]} : {});
  }
  viewer.render();
  if (interactionsVisible) drawInteractions(key);
  else renderInteractionDetails(key);
}

function atom(model, selection) {
  return model.selectedAtoms(selection)[0];
}

function contactLine(viewer, a, b, color, label) {
  if (!a || !b) return;
  const start = {x:a.x,y:a.y,z:a.z};
  const end = {x:b.x,y:b.y,z:b.z};
  const segments = 7;
  for (let i = 0; i < segments; i += 2) {
    const t1 = i / segments;
    const t2 = Math.min((i + 1) / segments, 1);
    viewer.addCylinder({
      start:{x:start.x+(end.x-start.x)*t1,y:start.y+(end.y-start.y)*t1,z:start.z+(end.z-start.z)*t1},
      end:{x:start.x+(end.x-start.x)*t2,y:start.y+(end.y-start.y)*t2,z:start.z+(end.z-start.z)*t2},
      radius:.105,
      color,
      opacity:1
    });
  }
  viewer.addSphere({center:start,radius:.16,color,opacity:1});
  viewer.addSphere({center:end,radius:.16,color,opacity:1});
  const d = Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
  viewer.addLabel(`${label}  •  ${d.toFixed(2)} Å`, {
    position:{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},
    fontColor:'#17212b', backgroundColor:'#ffffff', backgroundOpacity:.94, borderColor:color,
    borderThickness:2, fontSize:15, inFront:true
  });
}

function renderInteractionDetails(key) {
  const panel = document.getElementById('interaction-details');
  if (!interactionsVisible) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const detail = interactionDetails[key];
  const items = detail.items.length
    ? `<ul>${detail.items.map(([pair,type]) => `<li>${pair}<span class="contact-type">${type}</span></li>`).join('')}</ul>`
    : '';
  panel.innerHTML = `<h3>${detail.title}</h3><p>${detail.note}</p>${items}`;
  panel.hidden = false;
}

function drawInteractions(key) {
  const viewer = viewers[key], model = models[key];
  if (!viewer || !model) return;
  if (key === 'cam') {
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O2'}), atom(model,{chain:'F',resi:2061,atom:'N1'}), '#16AFC6', 'CLM O2 ··· G2061 N1');
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O4'}), atom(model,{chain:'F',resi:2505,atom:'OP2'}), '#16AFC6', 'CLM O4 ··· G2505 OP2');
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O5'}), atom(model,{chain:'F',resi:2452,atom:'N3'}), '#249D8F', 'CLM O5 ··· C2452 N3');
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#249D8F',opacity:.18},{chain:'F',resi:2452});
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#16AFC6',opacity:.12},{chain:'F',resi:[2061,2062,2505]});
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#E5A323',opacity:.10},{chain:'F',resi:[2451,2503,2504,2506]});
    viewer.addLabel('C2452 • stacking zone',{fontColor:'#17212b',backgroundColor:'#ffffff',backgroundOpacity:.94,borderColor:'#249D8F',borderThickness:2,fontSize:15,inFront:true},{chain:'F',resi:2452});
    viewer.addLabel('A2062 • adjacent pocket wall',{fontColor:'#17212b',backgroundColor:'#ffffff',backgroundOpacity:.94,borderColor:'#E5A323',borderThickness:2,fontSize:15,inFront:true},{chain:'F',resi:2062});
    viewer.addLabel('G2505 • phosphate contact',{fontColor:'#17212b',backgroundColor:'#ffffff',backgroundOpacity:.94,borderColor:'#16AFC6',borderThickness:2,fontSize:15,inFront:true},{chain:'F',resi:2505});
    viewer.zoomTo({resn:'CLM'});
    viewer.zoom(.82);
  } else if (key === 'cef') {
    const ser = atom(model,{resi:307,atom:'OG'});
    contactLine(viewer, atom(model,{resn:'LIG',atom:'C10'}), ser, '#D96868', 'CEF C10 ··· Ser307 Oγ');
    contactLine(viewer, atom(model,{resn:'LIG',atom:'O3'}), atom(model,{resi:361,atom:'ND2'}), '#16AFC6', 'CEF O3 ··· Asn361 ND2');
    contactLine(viewer, atom(model,{resn:'LIG',atom:'C8'}), atom(model,{resi:310,atom:'NZ'}), '#E5A323', 'CEF C8 ··· Lys310 Nζ');
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#9FA1FF',opacity:.14},{resi:[307,310,359,361,494,495,496,497]});
    viewer.addLabel('Ser307 • catalytic nucleophile',{fontColor:'#17212b',backgroundColor:'#ffffff',backgroundOpacity:.94,borderColor:'#D96868',borderThickness:2,fontSize:15,inFront:true},{resi:307});
    viewer.addLabel('Ser307 + Thr497 • oxyanion-hole backbone',{fontColor:'#17212b',backgroundColor:'#ffffff',backgroundOpacity:.94,borderColor:'#9FA1FF',borderThickness:2,fontSize:14,inFront:true},{resi:497,atom:'N'});
    viewer.zoomTo({resn:'LIG'});
    viewer.zoom(.86);
  } else if (key === 'trna') {
    viewer.addLabel('A-site tRNA',{fontColor:COLORS.substrate,backgroundColor:'rgba(255,255,255,.88)',borderColor:COLORS.substrate,borderThickness:1,fontSize:12,inFront:true},{chain:'Y'});
    viewer.addLabel('P-site tRNA',{fontColor:COLORS.substrate,backgroundColor:'rgba(255,255,255,.88)',borderColor:COLORS.substrate,borderThickness:1,fontSize:12,inFront:true},{chain:'Z'});
    viewer.zoomTo({chain:['Y','Z']});
  }
  renderInteractionDetails(key);
  viewer.render();
}

function activate(key) {
  activeCase = key;
  interactionsVisible = false;
  const interactionButton = document.getElementById('toggle-interactions');
  interactionButton.setAttribute('aria-pressed','false');
  interactionButton.textContent = 'Show interactions';
  renderInteractionDetails(key);
  document.querySelectorAll('[role="tab"][data-case]').forEach(button => {
    const selected = button.dataset.case === key;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
  });
  document.querySelector('.explorer').scrollIntoView({behavior:'smooth', block:'start'});
  loadCase(key);
}

document.querySelectorAll('[role="tab"][data-case]').forEach(button => button.addEventListener('click', () => activate(button.dataset.case)));
document.querySelectorAll('.affinity-chart [data-case]').forEach(button => button.addEventListener('click', () => activate(button.dataset.case)));
document.getElementById('focus-overview').addEventListener('click', () => styleCase(activeCase, false));
document.getElementById('focus-site').addEventListener('click', () => styleCase(activeCase, true));
document.getElementById('toggle-interactions').addEventListener('click', event => {
  interactionsVisible = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', interactionsVisible ? 'true' : 'false');
  event.currentTarget.textContent = interactionsVisible ? 'Hide interactions' : 'Show interactions';
  styleCase(activeCase, interactionsVisible);
});
document.getElementById('toggle-spin').addEventListener('click', event => {
  const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  event.currentTarget.textContent = enabled ? 'Stop rotation' : 'Auto-rotate';
  Object.values(viewers).forEach(viewer => viewer.spin(enabled ? 'y' : false));
});

addEventListener('resize', () => Object.values(viewers).forEach(viewer => viewer.resize()));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  Object.values(viewers).forEach(viewer => { viewer.setBackgroundColor(backgroundColor()); viewer.render(); });
});

loadCase('cam');
