document.addEventListener("DOMContentLoaded", () => {
    
    const map = L.map('mapa').setView([-33.4474, -70.6736], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // VARIABLES GLOBALES
    let todosLosLocales = [];  // Guarda TODO lo que baje de internet
    let marcadoresActuales = []; // Guarda los pines dibujados actualmente para poder borrarlos
    let miLat = 0;
    let miLon = 0;

    function calcularDistancia(lat1, lon1, lat2, lon2) {
        const Radio_Tierra = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Radio_Tierra * c; 
    }

    async function buscarComidaRapidaEnInternet(lat, lon) {
        const radioMetros = 4000; // Ampliamos a 4 KM para capturar más variedad
        const query = `
            [out:json];
            (
              node["amenity"="fast_food"](around:${radioMetros},${lat},${lon});
              way["amenity"="fast_food"](around:${radioMetros},${lat},${lon});
              node["amenity"="restaurant"](around:${radioMetros},${lat},${lon});
            );
            out center;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const respuesta = await fetch(url);
            const datos = await respuesta.json();
            
            return datos.elements.map(elemento => {
                const laLat = elemento.lat || (elemento.center ? elemento.center.lat : null);
                const laLon = elemento.lon || (elemento.center ? elemento.center.lng : null);
                
                return {
                    nombre: elemento.tags.name || "Local de comida",
                    tipo: elemento.tags.cuisine || elemento.tags.amenity || "comida",
                    lat: laLat,
                    lon: laLon
                };
            }).filter(e => e.lat && e.lon);
        } catch (error) {
            console.error("Error consultando Overpass API:", error);
            return [];
        }
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (posicion) => {
                miLat = posicion.coords.latitude;
                miLon = posicion.coords.longitude;

                map.setView([miLat, miLon], 14);

                const marcadorUsuario = L.marker([miLat, miLon]).addTo(map);
                marcadorUsuario.bindPopup("<b>📍 Estás aquí</b>").openPopup();

                // Descargar datos de internet y calcular sus distancias iniciales
                todosLosLocales = await buscarComidaRapidaEnInternet(miLat, miLon);
                
                todosLosLocales.forEach(local => {
                    local.distancia = calcularDistancia(miLat, miLon, local.lat, local.lon);
                });

                // Ordenar por cercanía por única vez
                todosLosLocales.sort((a, b) => a.distancia - b.distancia);

                // Mostrar todos al inicio
                mostrarLocalesEnMapa(todosLosLocales);
            },
            (error) => {
                alert("Por favor, acepta el GPS para buscar locales a tu alrededor.");
            }
        );
    }

    // FUNCIÓN PARA PINTAR FILTROS
    function mostrarLocalesEnMapa(listaFiltrada) {
        // 1. BORRAR los marcadores anteriores del mapa
        marcadoresActuales.forEach(m => map.removeLayer(m));
        marcadoresActuales = []; // Vaciar el contenedor de pines antiguos

        // 2. DIBUJAR los nuevos marcadores filtrados
        listaFiltrada.forEach(local => {
            const marcadorLocal = L.marker([local.lat, local.lon]).addTo(map);
            const distanciaTexto = local.distancia.toFixed(2);

            marcadorLocal.bindPopup(`
                <div style="color: #000; font-family: sans-serif; width: 180px;">
                    <strong style="font-size: 1.1rem;">${local.nombre}</strong><br>
                    <span style="color: #666; text-transform: capitalize;">Categoría: ${local.tipo}</span><br>
                    <span style="color: #ff9800; font-weight: bold;">A ${distanciaTexto} km</span><br>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lon}" target="_blank" style="color: #007bff; text-decoration: none; font-weight: 500;">¿Cómo llegar?</a>
                </div>
            `);

            // Guardamos la referencia de este marcador para poder borrarlo después
            marcadoresActuales.push(marcadorLocal);
        });
    }

// FUNCIÓN PARA FILTRAR ADAPTADA AL ESPAÑOL
window.filtrarCategoria = function(categoria, botonPresionado) {
    // Cambiar la clase estética del botón seleccionado
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('activo'));
    botonPresionado.classList.add('activo');

    if (categoria === 'todos') {
        mostrarLocalesEnMapa(todosLosLocales);
    } else {
        const filtrados = todosLosLocales.filter(local => {
            const tipoMinuscula = local.tipo.toLowerCase();
            const nombreMinuscula = local.nombre.toLowerCase();
            
            // Creamos un diccionario de sinónimos e idiomas
            let terminosBusqueda = [];
            
            if (categoria === 'burger') {
                terminosBusqueda = ['burger', 'hamburguesa', 'hamburguesería', 'bembos', 'mcdonald', 'burger king'];
            } else if (categoria === 'pizza') {
                terminosBusqueda = ['pizza', 'pizzería', 'pizzeria', 'italiana'];
            } else if (categoria === 'sushi') {
                terminosBusqueda = ['sushi', 'rolls', 'japonés', 'japonesa', 'handroll'];
            } else if (categoria === 'ice_cream') {
                terminosBusqueda = ['ice_cream', 'helado', 'heladería', 'heladeria', 'ice cream'];
            }

            // Verificamos si alguna de las palabras clave en español o inglés coincide con el local
            return terminosBusqueda.some(termino => 
                tipoMinuscula.includes(termino) || nombreMinuscula.includes(termino)
            );
        });
        
        mostrarLocalesEnMapa(filtrados);
    }
}
