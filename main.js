// Define the showLoading function to handle loading screen visibility
function showLoading(show) {
	document.getElementById("loading-screen").style.display = show ? "flex" : "none";
  }
  
  // Initialize the map
  var map = L.map("map").setView([3.139, 101.6869], 12);
  
  // Add a base map layer
  L.tileLayer(
	`https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=xacBPft0jp4adcI7TaUP`,
	{
	  attribution:
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}
  ).addTo(map);
  
  var busRoutesLayer;
  var busStopsLayer;
  
  // Function to fetch and parse local GTFS data
  function fetchGTFSData() {
	showLoading(true);
  
	// URL to the locally available GTFS zip file
	var gtfsUrl = 'gtfs_rapid_bus_kl.zip';
  
	axios.get(gtfsUrl, { responseType: 'arraybuffer' })
	  .then(function (response) {
		var zip = new JSZip();
		return zip.loadAsync(response.data);
	  })
	  .then(function (zip) {
		return zip.file("routes.txt").async("text")
		  .then(function (routesData) {
			var routes = parseCSV(routesData);
			populateDropdown(routes);
			showLoading(false);
		  });
	  })
	  .catch(function (error) {
		console.log("Error fetching data from GTFS API:", error);
		showLoading(false);
	  });
  }
  
  // Function to populate the dropdown with routes
  function populateDropdown(routes) {
	var dropdown = document.getElementById('bus-route-select');
	routes.forEach(route => {
	  var option = document.createElement('option');
	  option.value = route.route_id;
	  option.text = `${route.route_short_name} - ${route.route_long_name}`;
	  dropdown.add(option);
	});
  }
  
  // Function to fetch and display route and stop data
  function fetchRouteData(routeId) {
	showLoading(true);
  
	// URL to the locally available GTFS zip file
	var gtfsUrl = 'gtfs_rapid_bus_kl.zip';
  
	axios.get(gtfsUrl, { responseType: 'arraybuffer' })
	  .then(function (response) {
		var zip = new JSZip();
		return zip.loadAsync(response.data);
	  })
	  .then(function (zip) {
		return Promise.all([
		  zip.file("shapes.txt").async("text"),
		  zip.file("stops.txt").async("text"),
		  zip.file("stop_times.txt").async("text"),
		  zip.file("trips.txt").async("text")
		]);
	  })
	  .then(function ([shapesData, stopsData, stopTimesData, tripsData]) {
		var shapes = parseCSV(shapesData);
		var stops = parseCSV(stopsData);
		var stopTimes = parseCSV(stopTimesData);
		var trips = parseCSV(tripsData);
  
		var tripIds = trips.filter(trip => trip.route_id === routeId).map(trip => trip.trip_id);
		var shapeIds = trips.filter(trip => trip.route_id === routeId).map(trip => trip.shape_id);
		var filteredShapes = shapes.filter(shape => shapeIds.includes(shape.shape_id));
		var stopIds = stopTimes.filter(stopTime => tripIds.includes(stopTime.trip_id)).map(stopTime => stopTime.stop_id);
		var filteredStops = stops.filter(stop => stopIds.includes(stop.stop_id));
  
		console.log('Filtered Shapes:', filteredShapes); // Debugging statement
		console.log('Filtered Stops:', filteredStops);   // Debugging statement
  
		displayBusRoutes(filteredShapes);
		displayBusStops(filteredStops);
		showLoading(false);
	  })
	  .catch(function (error) {
		console.log("Error fetching data from GTFS API:", error);
		showLoading(false);
	  });
  }
  
  // Function to parse CSV data
  function parseCSV(data) {
	var lines = data.split('\n');
	var headers = lines[0].split(',');
	return lines.slice(1).filter(line => line.trim() !== '').map(line => {
	  var values = line.split(',');
	  var obj = {};
	  headers.forEach((header, index) => {
		obj[header] = values[index];
	  });
	  return obj;
	});
  }
  
  // Function to display bus routes on the map
  function displayBusRoutes(shapes) {
	if (busRoutesLayer) {
	  map.removeLayer(busRoutesLayer);
	}
  
	var routeLines = {};
  
	shapes.forEach(shape => {
	  var shapeId = shape.shape_id;
	  if (!routeLines[shapeId]) {
		routeLines[shapeId] = [];
	  }
	  routeLines[shapeId].push([parseFloat(shape.shape_pt_lat), parseFloat(shape.shape_pt_lon)]);
	});
  
	busRoutesLayer = L.layerGroup(Object.values(routeLines).map(line => {
	  return L.polyline(line, { color: 'blue' });
	})).addTo(map);
  
	// Fit map to route bounds
	map.fitBounds(busRoutesLayer.getBounds());
  }
  
  // Function to display bus stops on the map
  function displayBusStops(stops) {
	if (busStopsLayer) {
	  map.removeLayer(busStopsLayer);
	}
  
	busStopsLayer = L.layerGroup(stops.map(stop => {
	  var lat = parseFloat(stop.stop_lat);
	  var lon = parseFloat(stop.stop_lon);
	  var popupContent = `
		<b>Bus Stop:</b> ${stop.stop_name}<br>
		<b>Stop ID:</b> ${stop.stop_id}<br>
		<b>Description:</b> ${stop.stop_desc}<br>
		<b>Location:</b> (${lat}, ${lon})
	  `;
	  return L.marker([lat, lon], {
		icon: L.divIcon({
		  className: 'bus-stop-icon',
		  html: '<div style="background-color: orange; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; color: white;">🚌</div>',
		})
	  }).bindPopup(popupContent);
	})).addTo(map);
  
	// Fit map to stop bounds
	if (stops.length > 0) {
	  var bounds = L.latLngBounds(stops.map(stop => [parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)]));
	  map.fitBounds(bounds);
	}
  }
  
  // Event listener for the find route button
  document
	.getElementById("find-route-btn")
	.addEventListener("click", function () {
	  var routeId = document.getElementById("bus-route-select").value;
	  if (routeId) {
		fetchRouteData(routeId);
	  } else {
		alert("Please select a bus route.");
	  }
	});
  
  // Populate the dropdown with routes when the page loads
  fetchGTFSData();
  