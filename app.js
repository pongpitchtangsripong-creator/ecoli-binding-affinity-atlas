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
}

function atom(model, selection) {
  return model.selectedAtoms(selection)[0];
}

function contactLine(viewer, a, b, color, label) {
  if (!a || !b) return;
  viewer.addLine({start:{x:a.x,y:a.y,z:a.z}, end:{x:b.x,y:b.y,z:b.z}, color, dashed:true, dashLength:.28, gapLength:.18, linewidth:2});
  const d = Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
  viewer.addLabel(`${label}  ${d.toFixed(2)} Å`, {
    position:{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},
    fontColor:color, backgroundColor:'rgba(255,255,255,.86)', borderColor:color,
    borderThickness:1, fontSize:11, inFront:true
  });
}

function drawInteractions(key) {
  const viewer = viewers[key], model = models[key];
  if (!viewer || !model) return;
  if (key === 'cam') {
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O2'}), atom(model,{chain:'F',resi:2061,atom:'N1'}), '#16AFC6', 'polar contact');
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O4'}), atom(model,{chain:'F',resi:2505,atom:'OP2'}), '#16AFC6', 'polar contact');
    contactLine(viewer, atom(model,{resn:'CLM',atom:'O5'}), atom(model,{chain:'F',resi:2452,atom:'N3'}), '#249D8F', 'close contact');
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#249D8F',opacity:.18},{chain:'F',resi:2452});
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#16AFC6',opacity:.12},{chain:'F',resi:[2061,2062,2505]});
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#E5A323',opacity:.10},{chain:'F',resi:[2451,2503,2504,2506]});
    viewer.addLabel('C2452 stacking zone',{fontColor:'#249D8F',backgroundColor:'rgba(255,255,255,.88)',borderColor:'#249D8F',borderThickness:1,fontSize:12,inFront:true},{chain:'F',resi:2452});
    viewer.addLabel('G2505 polar zone',{fontColor:'#16AFC6',backgroundColor:'rgba(255,255,255,.88)',borderColor:'#16AFC6',borderThickness:1,fontSize:12,inFront:true},{chain:'F',resi:2505});
    viewer.zoomTo({resn:'CLM'});
    viewer.zoom(.82);
  } else if (key === 'cef') {
    const ser = atom(model,{resi:307,atom:'OG'});
    const ligandAtoms = model.selectedAtoms({resn:'LIG'});
    if (ser && ligandAtoms.length) {
      const nearest = ligandAtoms.reduce((best,a)=>Math.hypot(a.x-ser.x,a.y-ser.y,a.z-ser.z)<Math.hypot(best.x-ser.x,best.y-ser.y,best.z-ser.z)?a:best,ligandAtoms[0]);
      contactLine(viewer, nearest, ser, '#D96868', 'pose proximity to Ser307');
    }
    viewer.addSurface($3Dmol.SurfaceType.VDW,{color:'#9FA1FF',opacity:.14},{resi:[307,310,359,361,494,495,496,497]});
    viewer.addLabel('catalytic zone',{fontColor:'#D96868',backgroundColor:'rgba(255,255,255,.88)',borderColor:'#D96868',borderThickness:1,fontSize:12,inFront:true},{resi:307});
    viewer.zoomTo({resn:'LIG'});
    viewer.zoom(.86);
  } else if (key === 'trna') {
    viewer.addLabel('A-site tRNA',{fontColor:COLORS.substrate,backgroundColor:'rgba(255,255,255,.88)',borderColor:COLORS.substrate,borderThickness:1,fontSize:12,inFront:true},{chain:'Y'});
    viewer.addLabel('P-site tRNA',{fontColor:COLORS.substrate,backgroundColor:'rgba(255,255,255,.88)',borderColor:COLORS.substrate,borderThickness:1,fontSize:12,inFront:true},{chain:'Z'});
    viewer.zoomTo({chain:['Y','Z']});
  }
  viewer.render();
}

function activate(key) {
  activeCase = key;
  interactionsVisible = false;
  const interactionButton = document.getElementById('toggle-interactions');
  interactionButton.setAttribute('aria-pressed','false');
  interactionButton.textContent = 'Interactions';
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
  event.currentTarget.textContent = interactionsVisible ? 'Hide interactions' : 'Interactions';
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
