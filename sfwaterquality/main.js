/**
 * Ladies and gentlemen -- and the one poor soul who has to look through
 * this -- I wish you a lot of fun, because this is a godforsaken place.
 */

// UTILITY //

/**
 * Swaps an array tuple (a, b) in-place such that it becomes (b, a).
 * @param {*} param0 the array tuple (a, b)
 */
const swap = ([a, b]) => [b, a]

/**
 * Initializes the map with all relevant values for it to work.
 * @returns The initialized map as a Leaflet Map object
 */
const genMap = () => {
    const map = L.map('leaflet-map');
    map.setView([37.648, -122.169], 11);
    map.setMinZoom(10);
    map.setMaxZoom(13);

    const boundsNE = L.latLng(38.238, -121.600);
    const boundsSW = L.latLng(37.385, -122.615);
    const bounds = L.latLngBounds(boundsNE, boundsSW);
    map.setMaxBounds(bounds);

    return map;
}

const genD3Map = (data) => {
    const margin = { top: 20, right: 20, bottom: 20, left: 30 };
    const width = 320 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3.select('#timeplotter')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const adjustedData = [ ];
    for (let i = 1; i < 12; i++) {
        const curMonth = data.filter(entry => entry['Month'] === i.toString());
        if (!curMonth || curMonth.length === 0) continue;

        const payload = { 'temp': 0, 'spm': 0, 'chloro': 0, 'salinity': 0 };
        for (const entry of curMonth) {
            console.log(entry);
            payload.temp += Number(entry["Temperature (Degrees Celsius)"]);
            payload.spm += Number(entry["Calculated SPM (mg/L)"]);
            payload.chloro += Number(entry["Calculated Chlorophyll-a (micrograms/L)"]);
            payload.salinity += Number(entry["Salinity"]);
        }
        payload.month = i;

        payload.temp /= curMonth.length;
        payload.spm /= curMonth.length;
        payload.chloro /= curMonth.length;
        payload.salinity /= curMonth.length;

        adjustedData.push(payload);
    }

    //console.log(adjustedData);
    
    const groups = ['Temperature', 'SPM', 'Chlorophyll-A', 'Salinity'];
    d3.select('#selectButton')
        .selectAll('myOptions')
        .data(groups)
        .enter()
        .append('option')
        .text(d => { return d; })
        .attr('value', d => { return d; });

    const colors = d3.scaleOrdinal()
        .domain(groups)
        .range(d3.schemeSet2);

    const x = d3.scaleTime()
        .range([0, width]);

    const y = d3.scaleLinear()
        .range([height, 0]);

    const dateFormat = d3.time.format('%b');

    const nestedData = d3.nest()
        .key(d => { return d.temp })
        .key(d => { return d.month })
        .entries(adjustedData);

    // Drawing

    // Actual dogwater code, so deleted, lol.
}

/**
 * A simple csv to json parser function.
 * @param {*} csv The csv content to be converted
 * @returns The csv file as workable JS object
 */
const csvToJs = (csv) => {
    const lines = csv.split('\n');

    const result = [];
    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].split(',');

        const entry = { };
        for (let [j, header] of headers.entries()) {
            header = header.replace(/\r/g, '');
            entry[header] = line[j].replace(/\r/g, '');
        }
        result.push(entry);
    }

    return result;
}

const filterDataByYear = (raw, year) => {
    return raw.filter(el => Number(el["Year"]) === year);
}

const swapData = (year) => {
    if (year === selectedYear) return;

    filteredData = filterDataByYear(data, year);
    selectedYear = year;
    
    for (let i = 2021; i <= 2023; i++) {
        const curSelector = document.getElementById(i);
        curSelector.style.backgroundColor = (i === selectedYear) 
            ? 'var(--color-sun)' 
            : 'transparent';
    }

    if (dfStatus[0]) editInformation('df-1-');
    if (dfStatus[1]) editInformation('df-2-');
}

const getSamplePoint = (location) => {
    for (const [key, value] of Object.entries(stationLookup)) {
        const [ lat, long ] = value;

        if (location[0].toFixed(3) === lat.toFixed(3) && location[1].toFixed(3) === long.toFixed(3)) {
            return key;
        }
    }

    return false;
}

const cToF = (temp) => {
    return temp * 1.8 + 32;
}

const distance = (a, b) => {
    const x = a[0] - b[0];
    const y = a[1] - b[1];
    return Math.sqrt(x * x + y * y);
}

/**
 * Calculates the average data. If a location matching a data point is
 * found, that data point is assumed to be a marker and is solely considered. If not,
 * the weighted average of the five closest neighbors (5NN) is taken and averaged.
 * @param {*} location The location of the point of interest
 * @returns The averaged value as typeof Number
 */
const calcAvgs = (location) => {
    const sp = getSamplePoint(location);
    if (sp) {
        const spEntries = filteredData.filter(entry => entry['Station'] === sp);

        //genD3Map(spEntries);

        const payload = { };

        const tempSum = spEntries.reduce((sum, entry) => sum + Number(entry['Temperature (Degrees Celsius)']), 0);
        payload.temp = tempSum / spEntries.length;
        const spmSum = spEntries.reduce((sum, entry) => sum + Number(entry['Calculated SPM (mg/L)']), 0);
        payload.spm = spmSum / spEntries.length;
        const chloroSum = spEntries.reduce((sum, entry) => sum + Number(entry['Calculated Chlorophyll-a (micrograms/L)']), 0);
        payload.algae = chloroSum / spEntries.length;
        const salinitySum = spEntries.reduce((sum, entry) => sum + Number(entry['Salinity']), 0);
        payload.salinity = salinitySum / spEntries.length;

        return payload;
    }

    // Calculate distance between selected location and all stations
    const distances = [ ];
    for (const coords of Object.values(stationLookup)) {
        distances.push(distance(location, coords));
    }

    // ... and get the distance and index of the 5 nearest
    const n = 5;
    const minDists = [...distances.keys()]
        .sort((a, b) => distances[a] - distances[b])
        .slice(0, n);

    const data = [ ];
    for (const distIndex of minDists) {
        data.push({
            'distance': distances[distIndex],
            'stationPos': Object.values(stationLookup)[distIndex]
        });
    }

    // Calculate the weights of the 5 nearest
    const lowest = data[0].distance;
    const weights = [ ];
    for (const entry of data) {
        weights.push(lowest / entry.distance);
    }

    // ... and weigh the data accordingly
    // TODO: Unify this with the single-node approach above
    const payload = { 'temp': 0, 'spm': 0, 'algae': 0, 'salinity': 0 };

    for (let i = 0; i < n; i++) {
        const entry = data[i];
        const sp = getSamplePoint(entry.stationPos);
        const spEntries = filteredData.filter(entry => entry['Station'] === sp);

        const tempSum = spEntries.reduce((sum, entry) => sum + Number(entry['Temperature (Degrees Celsius)']), 0);
        payload.temp += (tempSum / spEntries.length) * weights[i];
        const spmSum = spEntries.reduce((sum, entry) => sum + Number(entry['Calculated SPM (mg/L)']), 0);
        payload.spm += (spmSum / spEntries.length) * weights[i];
        const chloroSum = spEntries.reduce((sum, entry) => sum + Number(entry['Calculated Chlorophyll-a (micrograms/L)']), 0);
        payload.algae += (chloroSum / spEntries.length) * weights[i];
        const salinitySum = spEntries.reduce((sum, entry) => sum + Number(entry['Salinity']), 0);
        payload.salinity += (salinitySum / spEntries.length) * weights[i];
    }

    const weightsSum = weights.reduce((sum, a) => sum + a, 0);
    payload.temp /= weightsSum;
    payload.spm /= weightsSum;
    payload.algae /= weightsSum;
    payload.salinity /= weightsSum;

    return payload;
}

/**
 * Very vaguely based on https://www.researchgate.net/publication/26547985_Short-term_Influences_on_Suspended_Particulate_Matter_Distribution_in_the_Northern_Gulf_of_Mexico_Satellite_and_Model_Observations
 * Requires more research for more correct labeling
 * @param {*} spm The SPM value as number
 * @returns A string containing the SPM label
 */
const getSPMLabel = (spm) => {
    if (spm < 0.5) return 'None';
    if (spm < 3.0) return 'Low';
    if (spm < 15) return 'Medium';
    return 'High';
}

/**
 * Based on page 11 of https://www.deq.nc.gov/documents/pdf/coastal-resources-commission-meeting-agendas-minutes/presentations/chlorophyll-considerations-ppt-063017/download
 * @param {*} chloro The chloro-a value as number
 * @returns A string containing the chloro label
 */
const getChloroLabel = (chloro) => {
    if (chloro < 10) return 'Low';
    if (chloro < 20) return 'Noticeable';
    if (chloro < 30) return 'High';
    return 'Concerning';
}

/**
 * Returns a salinity label based on https://www.watereducation.org/aquapedia-background/salinity
 * @param {*} salinity The salinity value as number
 * @returns A string containing the salinity label
 */
const getSalinityLabel = (salinity) => {
    if (salinity < 1.0) return 'Fresh';
    if (salinity < 3.0) return 'Slight';
    if (salinity < 10.0) return 'Moderate';
    return 'High';
}

const editInformation = (panelId) => {
    let coords = document.getElementById(panelId + 'coords');
    coords = coords.innerText.substring(1, coords.innerText.length - 1);
    coords = coords.split(',');
    coords = coords.map(Number);
    const avg = calcAvgs(coords);
    
    // Probably improvable but good enough for now, not trying to win a beautiful code contest
    const temp = document.getElementById(panelId + 'temp');
    let isNaN = Number.isNaN(avg.temp);
    temp.children[1].innerHTML = isNaN ? 'N/A' : `${avg.temp.toFixed(1)}°C`;
    temp.children[2].innerHTML = isNaN ? 'N/A' : `${cToF(avg.temp).toFixed(1)}°F`;

    const muddiness = document.getElementById(panelId + 'muddiness');
    isNaN = Number.isNaN(avg.spm);
    muddiness.children[1].innerHTML = isNaN ? 'N/A' : getSPMLabel(avg.spm);
    muddiness.children[2].innerHTML = isNaN ? 'N/A' : `${avg.spm.toFixed(1)}mg/L`;

    const algae = document.getElementById(panelId + 'algae');
    isNaN = Number.isNaN(avg.algae);
    algae.children[1].innerHTML = isNaN ? 'N/A' : getChloroLabel(avg.algae);
    algae.children[2].innerHTML = isNaN ? 'N/A' : `${avg.algae.toFixed(1)}µg/L`;

    const salinity = document.getElementById(panelId + 'salinity');
    isNaN = Number.isNaN(avg.salinity);
    salinity.children[1].innerHTML = isNaN ? 'N/A' : getSalinityLabel(avg.salinity);
    salinity.children[2].innerHTML = isNaN ? 'N/A' : `${avg.salinity.toFixed(1)}g/Kg`;
}

const editDataDisplay = (e, isMarker) => {
    const id = !dfStatus[0] ? 'df-1-' : 'df-2-';

    let dataField = document.getElementById(id + 'default');
    dataField.classList.add('hidden');

    dataField = document.getElementById(id + 'data');
    dataField.classList.remove('hidden');

    if (e !== null && isMarker !== null) {
        const title = document.getElementById(id + 'title');
        const coords = document.getElementById(id + 'coords');

        title.innerHTML = isMarker ? e.target._tooltip._content : 'Custom Selection';
        const { lat, lng } = e.latlng;
        coords.innerHTML = `[${lat.toFixed(3)}, ${lng.toFixed(3)}]`;
    }
    
    editInformation(id);

    const index = (id === 'df-1-') ? 0 : 1;
    dfStatus[index] = [e.latlng[0], e.latlng[1]];
}

const resetDataDisplay = (id) => {
    let dataField = document.getElementById(id + 'data');
    dataField.classList.add('hidden');

    dataField = document.getElementById(id + 'default');
    dataField.classList.remove('hidden');

    const index = (id === 'df-1-') ? 0 : 1;
    dfStatus[index] = null;
}

// MAIN //

const LOC_JSON_PATH = './Stations.geojson';
const CSV_PATH = './full_dataset.csv';

const map = genMap();
let data;
let filteredData;
let stationLookup = { };
let dfStatus = [null, null];
let selectedYear = 2023;

(async () => {
    // Map stuff
    const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });
    layer.addTo(map);

    // Add on-click event listener for map
    map.on('click', (e) => {
        editDataDisplay(e, false);
    });

    // Add on-click event listener for del icon
    const titleWrappers = document.getElementsByClassName('title-wrapper');
    for (let i = 0; i < titleWrappers.length; i++) {
        const children = [...titleWrappers[i].children]
        const icons = children.filter(child => child.tagName.toLowerCase() === 'i');
        icons[0].addEventListener('click', () => resetDataDisplay(`df-${i + 1}-`));
    }

    // Map markers
    const response = await fetch(LOC_JSON_PATH);
    const stations = await response.json();
    
    for (const location of stations.features) {
        const { properties, geometry } = location;

        const marker = L.marker(swap(geometry.coordinates), {
            opacity: 0.33,
            riseOnHover: true
        });
        marker.bindTooltip(properties.name).openTooltip();
        marker.addTo(map);
        
        // Add on-click event listener for each marker
        marker.on('click', (e) => {
            editDataDisplay(e, true);
        });

        // Fill up station lookup table for later use
        stationLookup[properties.id] = swap(geometry.coordinates);
    }

    // Fetch data from csv and optimize it
    const csv = await fetch(CSV_PATH);
    data = csvToJs(await csv.text());
    filteredData = filterDataByYear(data, selectedYear);

    // Highlight currently selected year
    const curSelector = document.getElementById(selectedYear);
    curSelector.style.backgroundColor = 'var(--color-sun)'

    // Add event listeners to year selectors
    let y = 2021;
    const selectors = document.getElementsByClassName('unselectable selector-item');
    for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        selector.addEventListener('click', () => swapData(y + i));
    }
})();