document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Inicializar el mapa (Coordenadas por defecto si el GPS tarda)
    const map = L.map('mapa').setView([-33.4474, -70.6736], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // VARIABLES GLOBALES
    let todosLosLocales = [];  
    let marcadoresActuales = []; 
    let miLat = 0;
    let miLon = 0;

    // Fórmula de Haversine para medir distancias
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

    // Consulta simplificada y más rápida a Overpass API
    async function buscarComidaRapidaEnInternet(lat, lon) {
        const radioMetros = 4000; // 4 KM a la redonda
        
        const query = `
            [out:json][timeout:25];
            (
              node["amenity"="fast_food"](around:${radioMetros},${lat},${lon});
              node["amenity"="restaurant"](around:${radioMetros},${lat},${lon});
              node["amenity"="cafe"](around:${radioMetros},${lat},${lon});
            );
            out body;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const respuesta = await fetch(url);
            if (!respuesta.ok) throw new Error("Error en la respuesta del servidor");
            const datos = await respuesta.json();
            
            if (!datos.elements) return [];

            return datos.elements.map(elemento => {
                return {
                    nombre: elemento.tags.name || "Local de comida",
                    tipo: elemento.tags.cuisine || elemento.tags.amenity || "comida",
                    lat: elemento.lat,
                    lon: elemento.lon
                };
            }).filter(e => e.lat && e.lon);
        } catch (error) {
            console.error("Error consultando Overpass API:", error);
            return [];
        }
    }

    // 4. Activar Geolocalización con sistema de respaldo inteligente
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (posicion) => {
                miLat = posicion.coords.latitude;
                miLon = posicion.coords.longitude;

                // Centrar el mapa exactamente donde tú estás
                map.setView([miLat, miLon], 14);

                // Tu marcador de posición
                const marcadorUsuario = L.marker([miLat, miLon]).addTo(map);
                marcadorUsuario.bindPopup("<b>📍 Estás aquí</b>").openPopup();

                // 1. Intentamos buscar en internet primero
                console.log("Buscando en la base de datos de internet...");
                todosLosLocales = await buscarComidaRapidaEnInternet(miLat, miLon);
                
                // 2. RESPALDO INTELIGENTE: Si internet no tiene nada, inyectamos tus propios locales locales
                if (todosLosLocales.length === 0) {
                    console.warn("No se encontraron locales en internet. Activando locales de respaldo manuales.");
                    
                    // Datos calculados dinámicamente a unos metros de tu posición GPS real
                    todosLosLocales = [
                        { nombre: "Mi Hamburguesería Favorita", lat: miLat + 0.003, lon: miLon + 0.002, tipo: "burger" },
                        { nombre: "Pizzería de la Esquina", lat: miLat - 0.002, lon: miLon - 0.004, tipo: "pizza" },
                        { nombre: "Sushi Delivery Express", lat: miLat + 0.005, lon: miLon - 0.001, tipo: "sushi" },
                        { nombre: "Heladería del Barrio", lat: miLat - 0.004, lon: miLon + 0.005, tipo: "ice_cream" }
                    ];
                }

                // Calcular distancias, ordenar y mostrar
                todosLosLocales.forEach(local => {
                    local.distancia = calcularDistancia(miLat, miLon, local.lat, local.lon);
                });

                todosLosLocales.sort((a, b) => a.distancia - b.distancia);
                mostrarLocalesEnMapa(todosLosLocales);
            },
            (error) => {
                alert("Por favor, acepta el GPS para que la app pueda calcular las distancias.");
            }
        );
    } else {
        alert("Tu navegador no soporta geolocalización.");
    }

    // FUNCIÓN PARA PINTAR MARCADORES (CORREGIDA COMPLETAMENTE)
    function mostrarLocalesEnMapa(listaFiltrada) {
        // Borrar marcadores anteriores
        marcadoresActuales.forEach(m => map.removeLayer(m));
        marcadoresActuales = []; 

        // Dibujar los nuevos marcadores
        listaFiltrada.forEach(local => {
            const marcadorLocal = L.marker([local.lat, local.lon]).addTo(map);
            const distanciaTexto = local.distancia.toFixed(2);

            // Plantilla corregida para evitar que falle el renderizado
            marcadorLocal.bindPopup(`
                <div style="color: #000; font-family: sans-serif; width: 180px;">
                    <strong style="font-size: 1.1rem;">${local.nombre}</strong><br>
                    <span style="color: #666; text-transform: capitalize;">Tipo: ${local.tipo}</span><br>
                    <span style="color: #ff9800; font-weight: bold;">A ${distanciaTexto} km</span><br>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lon}" target="_blank" style="color: #007bff; text-decoration: none; font-weight: 500;">¿Cómo llegar?</a>
                </div>
            `);

            marcadoresActuales.push(marcadorLocal);
        });
    }

    // FUNCIÓN GLOBAL PARA FILTRAR ADAPTADA AL ESPAÑOL
    window.filtrarCategoria = function(categoria, botonPresionado) {
        document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('activo'));
        botonPresionado.classList.add('activo');

        if (categoria === 'todos') {
            mostrarLocalesEnMapa(todosLosLocales);
        } else {
            const filtrados = todosLosLocales.filter(local => {
                const tipoMinuscula = local.tipo.toLowerCase();
                const nombreMinuscula = local.nombre.toLowerCase();
                
                let terminosBusqueda = [];
                
                if (categoria === 'burger') {
                    terminosBusqueda = ['burger', 'hamburguesa', 'hamburguesería', 'mcdonald', 'king', 'bembos'];
                } else if (categoria === 'pizza') {
                    terminosBusqueda = ['pizza', 'pizzería', 'pizzeria', 'italiana'];
                } else if (categoria === 'sushi') {
                    terminosBusqueda = ['sushi', 'rolls', 'japonés', 'japonesa', 'handroll'];
                } else if (categoria === 'ice_cream') {
                    terminosBusqueda = ['ice_cream', 'helado', 'heladería', 'heladeria', 'cream'];
                }

                return terminosBusqueda.some(termino => 
                    tipoMinuscula.includes(termino) || nombreMinuscula.includes(termino)
                );
            });
            
            mostrarLocalesEnMapa(filtrados);
        }
    }
});
