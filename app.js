
let map; let layers = {}; let layersControl;
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('password').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
function handleLogin() {
    const pwd = document.getElementById('password').value;
    const hash = CryptoJS.SHA256(pwd).toString();
    if (hash === PWD_HASH) { unlockMap(); } else { document.getElementById('error-message').style.display = 'block'; }
}
function unlockMap() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('map-container').classList.add('visible');
    initMap();
}
function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' }).addTo(map);
    layersControl = L.control.layers({}, {}, { collapsed: false }).addTo(map);
    loadData();
    document.getElementById('close-table').addEventListener('click', () => {
        document.getElementById('attribute-table-container').classList.add('collapsed');
        document.getElementById('map-container').classList.remove('table-open');
    });
}
function loadData() {
    if (typeof mapData === 'undefined') return;
    const bounds = L.latLngBounds();
    mapData.layers.forEach(layer => {
        const sym = layer.symbology;
        layers[layer.name] = { featureMap: {} };
        const geojsonLayer = L.geoJSON(layer.data, {
            style: (f) => {
                let s = { weight: 3, opacity: 0.8, color: sym.color || "#00d2ff" };
                if (sym.type === "unique") {
                    let v = String(f.properties[sym.field] || "").trim();
                    if (v.endsWith('.0')) v = v.substring(0, v.length - 2);
                    if (sym.values[v]) s.color = sym.values[v].color;
                }
                return s;
            },
            onEachFeature: (f, l) => {
                const id = f.properties.OBJECTID || f.properties.FID || f.id;
                layers[layer.name].featureMap[id] = l;
                let popup = '<div style="padding:8px; color:black; min-width:200px; background:white;">';
                popup += '<h3 style="margin:0 0 8px 0; font-size:13px; color:#0056b3; border-bottom:2px solid #0056b3;">' + layer.name + '</h3>';
                Object.keys(f.properties).forEach(function(k) {
                    var val = f.properties[k] !== null ? f.properties[k] : "";
                    popup += '<div style="margin-bottom:4px; font-size:11px; line-height:1.2;">';
                    popup += '<b style="color:#333; display:inline-block; width:90px;">' + k + ':</b>';
                    popup += '<span style="color:#000;">' + val + '</span>';
                    popup += '</div>';
                });
                popup += '<div style="margin-top:10px; padding-top:5px; border-top:1px solid #eee;">';
                popup += '<a href="' + layer.shp_link + '" target="_blank" style="color:#0078A8; font-weight:bold; font-size:11px; text-decoration:none;">💾 Descargar SHP</a>';
                popup += '</div></div>';
                l.bindPopup(popup, { maxWidth: 300 });
                l.on('dblclick', (e) => { L.DomEvent.stopPropagation(e); openTable(layer.name, id); });
            }
        }).addTo(map);
        if (geojsonLayer.getBounds().isValid()) bounds.extend(geojsonLayer.getBounds());
        layers[layer.name].layer = geojsonLayer;
        layersControl.addOverlay(geojsonLayer, `<div class="layer-row"><span>${layer.name}</span><span onclick="openTable('${layer.name}')" style="cursor:pointer">📊</span></div>`);
    });
    if (bounds.isValid()) map.fitBounds(bounds);
    updateSidePanel();
    // Abrir tabla automáticamente para la primera capa
    if (mapData.layers.length > 0) openTable(mapData.layers[0].name);
    map.on('overlayadd', updateSidePanel); map.on('overlayremove', updateSidePanel);
}
function updateSidePanel() {
    const container = document.getElementById('legend-content');
    container.innerHTML = ''; let has = false;
    mapData.layers.forEach(ld => {
        const lyr = layers[ld.name]?.layer;
        if (lyr && map.hasLayer(lyr)) {
            has = true;
            container.innerHTML += `<div class="layer-group-header">📍 ${ld.name}</div>`;
            const render = (st, t) => {
                if (!st || !st.groups) return;
                let h = `<div class="stats-header">${st.title || t}</div>`;
                Object.entries(st.groups).forEach(([lbl, val]) => {
                    let col = (ld.symbology.type === "unique" && ld.symbology.values[lbl]) ? ld.symbology.values[lbl].color : (ld.symbology.color || '#475569');
                    h += `<div class="stat-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0;">
                        <div style="display:flex; align-items:center; gap:10px;"><div class="legend-color" style="background:${col};"></div><span style="color:#f1f5f9; font-size:0.85rem;">${lbl}</span></div>
                        <span style="font-family:monospace; font-size:0.85rem;">${val.toLocaleString()}</span></div>`;
                });
                container.innerHTML += `<div class="stats-section-dynamic">${h}</div>`;
            };
            if (ld.stats_1) render(ld.stats_1, "Estadísticas A");
            if (ld.stats_2) render(ld.stats_2, "Estadísticas B");
            container.innerHTML += `<hr class="stats-sep-dynamic">`;
        }
    });
    has ? document.getElementById('legend-panel').classList.remove('hidden') : document.getElementById('legend-panel').classList.add('hidden');
}
function openTable(ln, fid = null) {
    const ld = mapData.layers.find(l => l.name === ln); if (!ld) return;
    document.getElementById('table-title').innerText = "Atributos: " + ln;
    const props = Object.keys(ld.data.features[0].properties);
    document.getElementById('table-head').innerHTML = props.map(p => `<th>${p}</th>`).join('');
    document.getElementById('table-body').innerHTML = ld.data.features.map(f => {
        const id = f.properties.OBJECTID || f.properties.FID || f.id;
        return `<tr onclick="zoomTo('${ln}', '${id}')" data-id="${id}" class="${String(id)===String(fid)?'selected-row':''}">` + props.map(p => `<td>${f.properties[p]||''}</td>`).join('') + `</tr>`;
    }).join('');
    document.getElementById('attribute-table-container').classList.remove('collapsed');
    document.getElementById('map-container').classList.add('table-open');
    if (fid) { 
        const row = document.querySelector(`tr[data-id="${fid}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
function zoomTo(ln, id) {
    const l = layers[ln].featureMap[id]; if (!l) return;
    if (l.getBounds) map.fitBounds(l.getBounds(), {padding:[50,50]}); else map.setView(l.getLatLng(), 18);
    l.openPopup();
}
