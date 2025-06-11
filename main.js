// Generate weekly Tuesdays from startDate to endDate
function generateWeeklyTuesdays(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);

  // Align to Tuesday if startDate isn't Tuesday
  while (current.getDay() !== 2) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= endDate) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);

    // Advance one week
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

// Format Date object as 'YYYY-MM-DD'
function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Determine latest available Tuesday date based on current ET time and release schedule
function getLatestAvailableDate() {
  const now = new Date();

  // Convert now to Eastern Time using Intl API
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  const day = etTime.getDay(); // 0=Sun, 1=Mon, ..., 2=Tue, ..., 4=Thu

  // Find most recent Tuesday on or before today in ET
  const daysSinceTuesday = (day + 7 - 2) % 7;
  let thisTuesday = new Date(etTime);
  thisTuesday.setDate(etTime.getDate() - daysSinceTuesday);

  // Previous Tuesday is one week before thisTuesday
  let prevTuesday = new Date(thisTuesday);
  prevTuesday.setDate(thisTuesday.getDate() - 7);

  // Calculate this Thursday 9:00 AM ET
  const daysToThursday = (4 + 7 - day) % 7;
  let thisThursday = new Date(etTime);
  thisThursday.setDate(etTime.getDate() + daysToThursday);
  thisThursday.setHours(9, 0, 0, 0); // 9:00 AM

  // Before Thursday 9 AM ET -> use previous Tuesday's data
  if (etTime < thisThursday) {
    return formatDate(prevTuesday);
  } else {
    return formatDate(thisTuesday);
  }
}

// Color function for drought categories based on numeric DM property
function getColor(dm) {
  switch (dm) {
    case 4: return '#800026'; // D4 - Exceptional Drought
    case 3: return '#E31A1C'; // D3 - Extreme Drought
    case 2: return '#FC4E2A'; // D2 - Severe Drought
    case 1: return '#FD8D3C'; // D1 - Moderate Drought
    case 0: return '#FFFFCC'; // D0 - Abnormally Dry
    case -1: return '#FFFFCC'; // None / No drought (assuming -1 or something)
    default: return '#FFFFFF'; // Unknown / No data
  }
}

// Get descriptive text for drought category by DM code
function getDroughtCategoryText(dm) {
  switch (dm) {
    case 4: return 'Exceptional Drought';
    case 3: return 'Extreme Drought';
    case 2: return 'Severe Drought';
    case 1: return 'Moderate Drought';
    case 0: return 'Abnormally Dry';
    case -1: return 'None';
    default: return 'Unknown';
  }
}



// Load GeoJSON for a given date string (YYYY-MM-DD)
function loadDroughtGeoJSON(date) {
  const dateForUrl = date.replace(/-/g, '');
  const url = `https://droughtmonitor.unl.edu/data/json/usdm_${dateForUrl}.json`;
  document.getElementById('date-display').innerText = `Date: ${date}`;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('GeoJSON not found for date: ' + date);
      }
      return response.json();
    })
    .then(data => {
      geojsonLayerGroup.clearLayers();
      L.geoJSON(data, {
        style: feature => ({
          fillColor: getColor(feature.properties.DM),
          weight: 1,
          color: 'black',
          fillOpacity: 0.7,
        }),
        onEachFeature: (feature, layer) => {
          const dm = feature.properties.DM;
          const code = dm !== undefined ? 'D' + dm : 'Unknown';
          const desc = getDroughtCategoryText(dm);
          layer.bindPopup(`<strong>${code}</strong> (${desc})`);
        },
      }).addTo(geojsonLayerGroup);
    })
    .catch(error => {
      console.error(error);
      geojsonLayerGroup.clearLayers();
    });
}

// Debounce helper function
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Initialize map
const map = L.map('map').setView([39.5, -98.5], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

const geojsonLayerGroup = L.layerGroup().addTo(map);

// Prepare dates and slider
const startDate = new Date('2000-01-04');
const latestAvailableDateStr = getLatestAvailableDate();
const latestAvailableDate = new Date(latestAvailableDateStr);

const droughtDates = generateWeeklyTuesdays(startDate, latestAvailableDate);

const slider = document.getElementById('slider');
slider.max = droughtDates.length - 1;
slider.value = 0; // reversed logic means 0 corresponds to newest date on right

// Reverse slider direction with debounce: only load when slider stops moving for 300ms
const debouncedLoad = debounce(() => {
  const reversedIndex = droughtDates.length - 1 - slider.value;
  loadDroughtGeoJSON(droughtDates[reversedIndex]);
}, 300);

slider.addEventListener('input', debouncedLoad);

// Initial load: show latest available date (right side)
loadDroughtGeoJSON(latestAvailableDateStr);
