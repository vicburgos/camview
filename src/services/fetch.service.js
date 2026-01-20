export async function fetchManifest(camara) {
    try {
        const response = await fetch(
            `/camview/camara/?cam=${camara}`
        );
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("Error fetching metadata:", error);
    }
}

export async function fetchSeries(camara, x, y, startDate, endDate) {
    try {
        const params = new URLSearchParams({
            cam: camara,
            x: x.toFixed(4),
            y: y.toFixed(4),
            start: startDate.toISOString(),
            end: endDate.toISOString()
        });
        
        const response = await fetch(`/camview/series?${params}`);
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("Error fetching series data:", error);
        return null;
    }
}
