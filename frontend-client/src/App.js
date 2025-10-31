import React, { useState, useEffect, useRef } from 'react';
import * as mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiaWxpeWFuLWhpcmFuaSIsImEiOiJjbThmNHRxMDMwYTJ2MmpxdHAzbDZxOTNuIn0.nw9ek8mR679n6H-C-Ydhzg';

function App() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Fetch all addresses from backend
  const fetchAddressesFromBackend = async () => {
    console.log('🚀 fetchAddressesFromBackend called');
    setLoading(true);
    setError("");
    try {
      const backendURL = process.env.REACT_APP_API_URL || "http://localhost:4000";
      console.log('📡 Fetching from backend:', `${backendURL}/api/address`);
      const res = await fetch(`${backendURL}/api/address`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('✅ Received addresses:', data.length);
      console.log('📋 Address data:', JSON.stringify(data, null, 2));
      setAddresses(data || []);
    } catch (err) {
      console.error('❌ Failed to fetch addresses:', err);
      setError('Failed to fetch addresses: ' + err.message);
      setAddresses([]); // Set empty array on error
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!mapContainer.current) {
      console.log('⚠️ Map container not available');
      return;
    }
    if (mapRef.current) {
      console.log('⚠️ Map already initialized');
      return;
    }
    console.log('🗺️ Initializing map...');
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-113.5, 53.5],
        zoom: 6,
        projection: { name: 'globe' },
        preserveDrawingBuffer: true
      });
      
      mapRef.current.on('load', () => {
        console.log('✅ Map loaded event fired');
        setMapReady(true);
      });
      
      mapRef.current.on('style.load', () => {
        console.log('✅ Map style loaded event fired');
        mapRef.current.setFog({});
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize();
            console.log('✅ Map resized');
          }
        }, 500);
        setMapReady(true);
      });
      
      mapRef.current.on('error', (e) => {
        console.error('❌ Map error:', e);
      });
      
    } catch (err) {
      console.error('❌ Failed to initialize map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
    
    return () => {
      if (mapRef.current) {
        console.log('🧹 Cleaning up map');
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fetch addresses on initial load
  useEffect(() => {
    console.log('🔄 useEffect: Fetching addresses on mount...');
    fetchAddressesFromBackend();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    if (mapRef.current._markers) {
      mapRef.current._markers.forEach(m => m.remove());
    }
    mapRef.current._markers = [];
    const validCoords = [];
    addresses.forEach((row, index) => {
      // Try to get lat/lon from various possible field names
      let lat = row.lat ?? row.Latitude ?? row.latitude;
      let lon = row.lon ?? row.Longitude ?? row.longitude;
      
      // Convert to number if string - preserve full precision, no rounding
      lat = typeof lat === 'number' ? lat : parseFloat(String(lat));
      lon = typeof lon === 'number' ? lon : parseFloat(String(lon));
      
      // Log raw values for debugging
      if (index === 0) {
        console.log(`🔍 Raw coordinate values for row ${index + 1}:`, {
          rawLat: row.lat ?? row.Latitude ?? row.latitude,
          rawLon: row.lon ?? row.Longitude ?? row.longitude,
          parsedLat: lat,
          parsedLon: lon,
          latType: typeof lat,
          lonType: typeof lon
        });
      }
      
      // Validate coordinates are valid numbers
      if (isNaN(lat) || isNaN(lon) || lat === null || lon === null || lat === undefined || lon === undefined) {
        console.warn(`⚠️ Skipping row ${index + 1}: Invalid coordinates`, {
          rawLat: row.lat ?? row.Latitude ?? row.latitude,
          rawLon: row.lon ?? row.Longitude ?? row.longitude,
          parsedLat: lat,
          parsedLon: lon,
          row: row
        });
        return;
      }
      
      // Validate coordinate ranges
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.warn(`⚠️ Skipping row ${index + 1}: Coordinates out of range (lat: ${lat}, lon: ${lon})`);
        return;
      }
      
      // Final validation before pushing
      if (!isNaN(lat) && !isNaN(lon) && typeof lat === 'number' && typeof lon === 'number') {
        // Double-check the values are actually numbers - preserve full precision
        const finalLat = Number(lat);
        const finalLon = Number(lon);
        if (!isNaN(finalLat) && !isNaN(finalLon)) {
          // Store the precise coordinates
          validCoords.push([finalLon, finalLat]);
          console.log(`✅ Added valid coordinate for row ${index + 1}: [${finalLon}, ${finalLat}]`);
          
          // Create custom marker element - FIXED VERSION
          const markerEl = document.createElement('div');
          markerEl.className = 'custom-marker';
          markerEl.innerHTML = `<span class="marker-number">${index + 1}</span>`;
          
          // Add click event
          markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedProperty(row);
            setSidebarOpen(true);
          });

          // Create marker with proper anchor - USE THE PRECISE COORDINATES
          const marker = new mapboxgl.Marker({
            element: markerEl,
            anchor: 'center' // This ensures the marker stays centered
          })
            .setLngLat([finalLon, finalLat]) // Use finalLon and finalLat for precision
            .addTo(mapRef.current);
          
          console.log(`📍 Created marker ${index + 1} at precise coordinates: [${finalLon}, ${finalLat}]`);
          mapRef.current._markers.push(marker);
        } else {
          console.warn(`⚠️ Skipping row ${index + 1}: Number conversion failed (lat: ${lat}, lon: ${lon})`);
        }
      } else {
        console.warn(`⚠️ Skipping row ${index + 1}: Final validation failed (lat: ${lat}, lon: ${lon}, latType: ${typeof lat}, lonType: ${typeof lon})`);
        return;
      }
    });
    
    if (validCoords.length > 0) {
      try {
        console.log('📍 Processing validCoords:', validCoords);
        
        // Filter out any invalid coordinates first
        const filteredCoords = validCoords.filter(coord => {
          const [lon, lat] = coord;
          const isValid = !isNaN(lon) && !isNaN(lat) && 
                          typeof lon === 'number' && typeof lat === 'number' &&
                          lon >= -180 && lon <= 180 && 
                          lat >= -90 && lat <= 90;
          if (!isValid) {
            console.warn('⚠️ Filtered out invalid coord:', coord);
          }
          return isValid;
        });
        
        if (filteredCoords.length === 0) {
          console.warn('⚠️ No valid coordinates after filtering');
          return;
        }
        
        // Get the first coordinate - already validated
        const [firstLon, firstLat] = filteredCoords[0];
        console.log('📍 Creating bounds with first coord:', { lon: firstLon, lat: firstLat });
        
        // Create bounds with the first coordinate
        const bounds = new mapboxgl.LngLatBounds([firstLon, firstLat], [firstLon, firstLat]);
        
        // Extend bounds with remaining valid coordinates
        for (let i = 1; i < filteredCoords.length; i++) {
          const [lon, lat] = filteredCoords[i];
          bounds.extend([lon, lat]);
        }
        
        // Validate bounds values
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();
        
        console.log('📍 Bounds calculated:', { north, south, east, west });
        
        // Final validation
        if (!isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west) &&
            typeof north === 'number' && typeof south === 'number' &&
            typeof east === 'number' && typeof west === 'number') {
          
          // Check if it's a single point (all bounds are the same)
          const isSinglePoint = (north === south && east === west);
          
          // Wait a bit for map to be fully ready
          setTimeout(() => {
            if (!mapRef.current) return;
            
            const executeFit = () => {
              if (isSinglePoint && filteredCoords.length > 0) {
                // For single point, use setCenter with zoom
                const [lon, lat] = filteredCoords[0];
                mapRef.current.setCenter([lon, lat]);
                mapRef.current.setZoom(14); // Zoom level 14 shows street level
                console.log(`✅ Map centered on single point: [${lon}, ${lat}] at zoom 14`);
              } else {
                // For multiple points or if bounds are different, use fitBounds
                // Add padding to bounds if they're too close
                if (Math.abs(north - south) < 0.001 || Math.abs(east - west) < 0.001) {
                  // Add a small buffer for single points
                  const latBuffer = 0.01;
                  const lonBuffer = 0.01;
                  const expandedBounds = new mapboxgl.LngLatBounds(
                    [west - lonBuffer, south - latBuffer],
                    [east + lonBuffer, north + latBuffer]
                  );
                  mapRef.current.fitBounds(expandedBounds, { 
                    padding: 60, 
                    maxZoom: 16,
                    duration: 1000
                  });
                  console.log(`✅ Map fitted to ${filteredCoords.length} markers (expanded bounds)`);
                } else {
                  mapRef.current.fitBounds(bounds, { 
                    padding: 60, 
                    maxZoom: 16,
                    duration: 1000
                  });
                  console.log(`✅ Map fitted to ${filteredCoords.length} markers`);
                }
              }
            };
            
            if (mapRef.current.isStyleLoaded()) {
              executeFit();
            } else {
              // If style not loaded yet, wait for idle event
              mapRef.current.once('idle', executeFit);
            }
          }, 200);
        } else {
          console.warn('⚠️ Invalid bounds calculated, skipping fitBounds', { north, south, east, west });
        }
      } catch (err) {
        console.error('❌ Error fitting bounds:', err);
        console.error('Valid coords:', validCoords);
        console.error('Error details:', err.message);
      }
    } else {
      console.log('ℹ️ No valid coordinates found to display on map');
    }
  }, [addresses, mapReady]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="modern-header">
        <div className="header-content">
          <h1 className="header-title">
            <span className="gradient-text">Property Explorer</span>
          </h1>
          <div className="header-stats">
            <div className="stat-item">
              <span className="stat-number">{addresses.length}</span>
              <span className="stat-label">Properties</span>
            </div>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </header>

      {/* Main Content */}
      <div className="main-layout">
        {/* Map Container */}
        <div className="map-section">
          <div className="map-header">
            <h2 className="section-title">Interactive Map</h2>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? '✕' : '☰'} Details
            </button>
          </div>
          <div className="map-container-wrapper" style={{ position: 'relative', minHeight: '600px', height: 'calc(100vh - 300px)' }}>
            <div
              ref={mapContainer}
              className="map-container"
            />
            {!mapReady && (
              <div className="map-loading" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
                <div className="loading-spinner"></div>
                <span>Loading interactive map...</span>
              </div>
            )}
          </div>
        </div>

        {/* Property Sidebar */}
        <div className={`property-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Property Details</h3>
            <button 
              className="close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
          
          {selectedProperty ? (
            <div className="property-details">
              <div className="property-hero">
                <h4 className="property-address">{selectedProperty.address}</h4>
                <div className="property-status">
                  <span className={`status-badge ${selectedProperty.Status?.toLowerCase()}`}>
                    {selectedProperty.Status || 'Unknown'}
                  </span>
                </div>
              </div>
              
              <div className="details-grid">
                <div className="detail-section">
                  <h5>Property Info</h5>
                  <div className="detail-row">
                    <span className="label">Builder</span>
                    <span className="value">{selectedProperty["Builder Name"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">City</span>
                    <span className="value">{selectedProperty["City"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Community</span>
                    <span className="value">{selectedProperty["Community Name"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Model</span>
                    <span className="value">{selectedProperty["Model Name / Plan"] || "-"}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h5>Specifications</h5>
                  <div className="detail-row">
                    <span className="label">Square Footage</span>
                    <span className="value">{selectedProperty["Square Footage"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Bedrooms</span>
                    <span className="value">{selectedProperty["Bedrooms"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Bathrooms</span>
                    <span className="value">{selectedProperty["Bathrooms"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Garage</span>
                    <span className="value">{selectedProperty["Garage Type"] || "-"}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h5>Pricing & Timeline</h5>
                  <div className="detail-row">
                    <span className="label">Listing Price</span>
                    <span className="value price">{selectedProperty["Listing Price"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Possession Date</span>
                    <span className="value">{selectedProperty["Possession Date"] || "-"}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h5>Contact Information</h5>
                  <div className="detail-row">
                    <span className="label">Agent</span>
                    <span className="value">{selectedProperty["Agent Name"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Phone</span>
                    <span className="value">{selectedProperty["Agent Phone"] || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Email</span>
                    <span className="value">{selectedProperty["Agent Email"] || "-"}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h5>Location</h5>
                  <div className="detail-row">
                    <span className="label">Coordinates</span>
                    <span className="value">{selectedProperty.lat}, {selectedProperty.lon}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <div className="no-selection-icon">🏠</div>
              <h4>Select a Property</h4>
              <p>Click on any numbered marker on the map to view detailed property information.</p>
            </div>
          )}
        </div>
      </div>

      {/* Property List */}
      <div className="property-list-section">
        <div className="list-header">
          <h3>Property Inventory</h3>
          {loading && (
            <div className="loading-indicator">
              <div className="mini-spinner"></div>
              <span>Loading properties...</span>
            </div>
          )}
        </div>
        
        <div className="property-grid">
          {addresses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏘️</div>
              <h4>No Properties Available</h4>
              <p>Property data will appear here once loaded from the server.</p>
            </div>
          ) : (
            addresses.map((row, idx) => (
              <div 
                key={row._id || idx} 
                className={`property-card ${selectedProperty?._id === row._id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedProperty(row);
                  setSidebarOpen(true);
                }}
              >
                <div className="card-header">
                  <span className="property-number">{idx + 1}</span>
                  <span className={`card-status ${row.Status?.toLowerCase()}`}>
                    {row.Status || 'Unknown'}
                  </span>
                </div>
                <h4 className="card-address">{row.address}</h4>
                <div className="card-details">
                  <span>{row["Builder Name"] || "Unknown Builder"}</span>
                  <span>{row["City"] || "Unknown City"}</span>
                </div>
                <div className="card-coords">
                  📍 {row.lat ? `${row.lat.toFixed(4)}, ${row.lon.toFixed(4)}` : 'No coordinates'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
          color: #ffffff;
          line-height: 1.6;
        }

        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header Styles */
        .modern-header {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1.5rem 2rem;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
        }

        .gradient-text {
          background: linear-gradient(135deg, #10b981, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-stats {
          display: flex;
          gap: 2rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #10b981;
        }

        .stat-label {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .error-banner {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 1rem;
          border-radius: 0.75rem;
          margin-top: 1rem;
          text-align: center;
          font-weight: 500;
        }

        /* Main Layout */
        .main-layout {
          display: flex;
          flex: 1;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          gap: 0;
        }

        /* Map Section */
        .map-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 80vh;
        }

        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem 1rem;
        }

        .section-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .sidebar-toggle {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sidebar-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        }

        .map-container {
          flex: 1;
          min-height: 600px;
          height: calc(100vh - 300px);
          margin: 0 2rem 2rem;
          border-radius: 1.5rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0a0a0a;
          position: relative;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .map-container-wrapper {
          min-height: 600px;
          height: calc(100vh - 300px);
        }

        .map-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: rgba(255, 255, 255, 0.7);
          font-size: 1.125rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(16, 185, 129, 0.2);
          border-top: 4px solid #10b981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ===== FIXED CUSTOM MARKER STYLES ===== */
        .custom-marker {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #10b981, #059669);
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          pointer-events: auto;
          /* REMOVED transform - this was causing the positioning issue */
          transition: box-shadow 0.3s ease, border-width 0.3s ease, background 0.3s ease;
        }

        .custom-marker:hover {
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
          border-width: 4px;
          background: linear-gradient(135deg, #059669, #047857);
          /* NO transform here - that's what was causing the movement */
        }

        .custom-marker:active {
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
        }

        .marker-number {
          color: white;
          font-weight: bold;
          font-size: 13px;
          user-select: none;
          pointer-events: none;
        }

        /* Property Sidebar */
        .property-sidebar {
          width: 400px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          transform: translateX(100%);
          transition: transform 0.3s ease;
          overflow-y: auto;
          max-height: 100vh;
        }

        .property-sidebar.open {
          transform: translateX(0);
        }

        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
        }

        .sidebar-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.1);
        }

        .property-details {
          padding: 1.5rem;
        }

        .property-hero {
          margin-bottom: 2rem;
        }

        .property-address {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: #10b981;
        }

        .property-status {
          display: flex;
          gap: 0.5rem;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.active {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }

        .status-badge.sold {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
        }

        .status-badge.pending {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }

        .details-grid {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .detail-section {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
          padding: 1.5rem;
        }

        .detail-section h5 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .detail-row .value {
          font-weight: 600;
          text-align: right;
        }

        .detail-row .value.price {
          color: #10b981;
          font-size: 1.1rem;
        }

        .no-selection {
          padding: 3rem 1.5rem;
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
        }

        .no-selection-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .no-selection h4 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: white;
        }

        /* Property List */
        .property-list-section {
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 2rem;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          max-width: 1400px;
          margin-left: auto;
          margin-right: auto;
        }

        .list-header h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }

        .loading-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .mini-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(16, 185, 129, 0.2);
          border-top: 2px solid #10b981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .property-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .property-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .property-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border-color: #10b981;
        }

        .property-card.selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .property-number {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.875rem;
        }

        .card-status {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .card-status.active {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .card-status.sold {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .card-status.pending {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .card-address {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: white;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 1rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .card-coords {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.5);
          font-family: 'Courier New', monospace;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem 2rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .empty-icon {
          font-size: 5rem;
          margin-bottom: 1rem;
        }

        .empty-state h4 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .main-layout {
            flex-direction: column;
          }
          
          .property-sidebar {
            width: 100%;
            max-height: 50vh;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            transform: translateY(100%);
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .property-sidebar.open {
            transform: translateY(0);
          }
          
          .property-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
          }
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .map-header {
            padding: 1rem;
            flex-direction: column;
            gap: 1rem;
          }
          
          .map-container {
            margin: 0 1rem 1rem;
            min-height: 400px;
            height: 50vh;
          }
          
          .map-container-wrapper {
            min-height: 400px;
            height: 50vh;
          }
          
          .property-list-section {
            padding: 1rem;
          }
          
          .property-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
export default App;
