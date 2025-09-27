import React, { useState, useEffect, useRef } from 'react';
import * as mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiaWxpeWFuLWhpcmFuaSIsImEiOiJjbThmNHRxMDMwYTJ2MmpxdHAzbDZxOTNuIn0.nw9ek8mR679n6H-C-Ydhzg';

function App() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  // ...existing code...
  // File upload handler
  const handleFileUpload = async (e) => {
    setError("");
    setUploading(true);
    const file = e.target.files[0];
    if (!file) {
      setUploading(false);
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    let properties = [];
    try {
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            properties = results.data.filter(row => row["Lot Number / Address"]);
            await processProperties(properties);
            setUploading(false);
          },
          error: (err) => {
            setError('CSV parsing error: ' + err.message);
            setUploading(false);
          }
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            // Convert rows to objects using header row
            const header = rows[0];
            properties = rows.slice(1).map(row => {
              const obj = {};
              header.forEach((key, i) => { obj[key] = row[i]; });
              return obj;
            }).filter(row => row["Lot Number / Address"]);
            await processProperties(properties);
            setUploading(false);
          } catch (err) {
            setError('XLSX parsing error: ' + err.message);
            setUploading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setError('Unsupported file type. Please upload a CSV or XLSX file.');
        setUploading(false);
      }
    } catch (err) {
      setError('File upload error: ' + err.message);
      setUploading(false);
    }
  };

  // Geocode, save to backend, and update UI for full property objects
  const processProperties = async (propertyList) => {
    setUploading(true);
    setError("");
    function parseLatLon(latStr, lonStr) {
      // Remove non-numeric, handle N/S/E/W, degree symbols, and special chars
      let lat = null, lon = null;
      if (latStr) {
        let cleaned = latStr.replace(/[^0-9.\-NS]/gi, "").replace(/�/g,"").trim();
        let match = cleaned.match(/([\-\d.]+)(N|S)?/i);
        if (match) {
          lat = parseFloat(match[1]);
          if (match[2] && match[2].toUpperCase() === 'S') lat = -lat;
        }
      }
      if (lonStr) {
        let cleaned = lonStr.replace(/[^0-9.\-EW]/gi, "").replace(/�/g,"").replace(/^\?/,"").trim();
        let match = cleaned.match(/([\-\d.]+)(E|W)?/i);
        if (match) {
          lon = parseFloat(match[1]);
          if (match[2] && match[2].toUpperCase() === 'W') lon = -Math.abs(lon);
        }
      }
      return { lat, lon };
    }
    const parsed = propertyList.map(prop => {
      // Copy all fields from prop, add address, lat, lon, but do NOT overwrite other fields
      const addr = prop["Lot Number / Address"] ?? prop.address;
      let { lat, lon } = parseLatLon(prop["Latitude"], prop["Longitude"]);
      // Only add address/lat/lon if not already present
      return {
        ...prop,
        ...(addr ? { address: addr } : {}),
        ...(lat !== null ? { lat } : {}),
        ...(lon !== null ? { lon } : {})
      };
    });
    try {
      setLoading(true);
      for (const row of parsed) {
        console.log('Saving property to backend:', JSON.stringify(row, null, 2));
        await fetch('https://deepnirwan-production.up.railway.app/api/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        });
      }
      await fetchAddressesFromBackend();
    } catch (err) {
      setError('Failed to save properties: ' + err.message);
    }
    setUploading(false);
    setLoading(false);
  };
  // Fetch all addresses from backend
  const fetchAddressesFromBackend = async () => {
    setLoading(true);
    try {
  const res = await fetch('https://deepnirwan-production.up.railway.app/api/address');
      const data = await res.json();
      setAddresses(data);
    } catch (err) {
      setError('Failed to fetch addresses: ' + err.message);
    }
    setLoading(false);
  };

  // Remove address by id
  const handleRemove = async (id) => {
    setLoading(true);
    try {
  await fetch(`https://deepnirwan-production.up.railway.app/api/address/${id}`, { method: 'DELETE' });
      await fetchAddressesFromBackend();
    } catch (err) {
      setError('Failed to remove address: ' + err.message);
    }
    setLoading(false);
  };

// ...existing code...
  // Remove address input state
  // ...existing code...
  const [geoLoading, setGeoLoading] = useState("");

  // No backend address fetch; all addresses are loaded via file upload.

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-113.5, 53.5],
      zoom: 6,
      projection: { name: 'globe' },
      preserveDrawingBuffer: true
    });
    mapRef.current.on('style.load', () => {
      mapRef.current.setFog({});
      setTimeout(() => mapRef.current.resize(), 500);
      setMapReady(true);
    });
    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  // Fetch addresses on initial load
  useEffect(() => {
    fetchAddressesFromBackend();
  }, []);

  useEffect(() => {
    // Only add markers if map is fully initialized and ready
    if (!mapRef.current || !mapReady) return;
    // Remove old markers
    if (mapRef.current._markers) {
      mapRef.current._markers.forEach(m => m.remove());
    }
    mapRef.current._markers = [];
    // Show markers for geocoded addresses from file upload
    const validCoords = [];
    addresses.forEach(row => {
      const lat = row.lat;
      const lon = row.lon;
      if (!lat || !lon) return;
      validCoords.push([lon, lat]);
      // Build beautiful popup HTML
      const popupHtml = `
        <div class="property-popup">
          <div class="popup-header">${row.address}</div>
          <div class="popup-details">
            <div><strong>Builder:</strong> ${row["Builder Name"] ?? "-"}</div>
            <div><strong>City:</strong> ${row["City"] ?? "-"}</div>
            <div><strong>Community:</strong> ${row["Community Name"] ?? "-"}</div>
            <div><strong>Status:</strong> ${row["Status"] ?? "-"}</div>
            <div><strong>Possession:</strong> ${row["Possession Date"] ?? "-"}</div>
            <div><strong>Price:</strong> ${row["Listing Price"] ?? "-"}</div>
            <div><strong>Sqft:</strong> ${row["Square Footage"] ?? "-"}</div>
            <div><strong>Bedrooms:</strong> ${row["Bedrooms"] ?? "-"}</div>
            <div><strong>Bathrooms:</strong> ${row["Bathrooms"] ?? "-"}</div>
            <div><strong>Garage:</strong> ${row["Garage Type"] ?? "-"}</div>
            <div><strong>Agent:</strong> ${row["Agent Name"] ?? "-"} ${row["Agent Phone"] ?? ""}</div>
            <div><strong>Email:</strong> ${row["Agent Email"] ?? "-"}</div>
            <div><strong>Lat/Lon:</strong> ${lat}, ${lon}</div>
          </div>
        </div>
      `;
      const marker = new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml))
        .addTo(mapRef.current);
      mapRef.current._markers.push(marker);
    });
    // Fit map to markers if any
    if (validCoords.length > 0) {
      const bounds = validCoords.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(validCoords[0], validCoords[0]));
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
    // Only show markers for geocoded addresses from file upload
  }, [addresses, mapReady]);

  // Address input and marker logic removed. Ready for file upload feature.

  return (
    <div className="main-container">
      <header className="header">
        <h2>Property Map & Inventory</h2>
        <div className="upload-section">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} id="file-upload" style={{ display: 'none' }} />
          <label htmlFor="file-upload" className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload CSV/XLSX'}
          </label>
        </div>
        {error && <div className="error-msg">{error}</div>}
      </header>
      <section>
        <h3>Map</h3>
        <div
          ref={mapContainer}
          id="map"
          style={{ width: '100%', height: '70vh', minHeight: '600px', borderRadius: '12px', border: '2px solid #ccc', marginBottom: '32px', background: '#eaeaea', position: 'relative' }}
        >
          {!mapReady && (
            <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#888', fontSize: 18}}>
              Loading map...
            </div>
          )}
        </div>
      </section>
      <section>
        <h3>Uploaded Addresses</h3>
        {uploading && <div className="spinner"><div className="loader"></div>Geocoding addresses...</div>}
        <div className="table-container">
          <table className="address-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Address</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {addresses.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>No addresses uploaded yet.</td></tr>
              ) : (
                addresses.map((row, idx) => (
                  <tr key={row._id || idx}>
                    <td>{idx + 1}</td>
                    <td>{row.address}</td>
                    <td>{row.lat ?? '-'}</td>
                    <td>{row.lon ?? '-'}</td>
                    <td>
                      <button className="remove-btn" onClick={() => handleRemove(row._id)} disabled={loading}>Remove</button>
                    </td>
      <style>{`
        .property-popup {
          font-family: system-ui, sans-serif;
          background: #fff;
          color: #222;
          border-radius: 10px;
          box-shadow: 0 2px 12px #0002;
          padding: 18px 16px 12px 16px;
          min-width: 220px;
          max-width: 320px;
        }
        .popup-header {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #10b981;
          text-align: center;
        }
        .popup-details {
          font-size: 14px;
          line-height: 1.7;
        }
        .popup-details div {
          margin-bottom: 2px;
        }
      `}</style>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <style>{`
        body { font-family: system-ui, sans-serif; background: #222; color: #fff; margin: 0; }
        * { box-sizing: border-box; }
        .main-container { max-width: 1200px; margin: 32px auto; background: #222; border-radius: 12px; box-shadow: 0 2px 16px #0002; padding: 32px; }
        h1, h2, h3 { text-align: center; }
        #map { width: 100%; height: 70vh; min-height: 600px; border-radius: 12px; border: 2px solid #ccc; margin-bottom: 32px; background: #eaeaea; }
        .upload-section { text-align: center; margin: 18px 0; }
        .upload-btn { display: inline-block; padding: 10px 24px; background: #10b981; color: white; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; border: none; margin-top: 8px; }
        .upload-btn:hover { background: #059669; }
        .error-msg { color: #ef4444; background: #fff0f0; border-radius: 6px; padding: 8px 16px; margin: 12px auto; max-width: 400px; text-align: center; font-weight: 500; }
        .spinner { display: flex; align-items: center; gap: 12px; justify-content: center; margin: 16px 0; }
        .loader { width: 24px; height: 24px; border: 4px solid #10b981; border-top: 4px solid #fff; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .table-container { overflow-x: auto; margin-top: 18px; }
        .address-table { width: 100%; border-collapse: collapse; background: #18181b; color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px #0002; }
        .address-table th, .address-table td { padding: 10px 12px; border-bottom: 1px solid #333; }
        .address-table th { background: #262626; font-weight: 600; }
        .address-table tr:last-child td { border-bottom: none; }
        .status.success { color: #10b981; font-weight: 600; }
        .status.error { color: #ef4444; font-weight: 600; }
      `}</style>
    </div>
  );
}
export default App;