import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Use environment variable for MongoDB URI (set in Render dashboard)
const mongoUri = process.env.MONGO_URI;
const dbName = "GeoCortex";
const collectionName = "addresses";

let db, addresses;

// Connect to MongoDB
MongoClient.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(client => {
    db = client.db(dbName);
    addresses = db.collection(collectionName);
    console.log("✅ Connected to MongoDB Atlas");
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ✅ API ROUTES

// Add new address
app.post("/api/address", async (req, res) => {
  const property = req.body;
  console.log("Received property:", JSON.stringify(property, null, 2));

  if (!property.address && !property["Lot Number / Address"]) {
    return res.status(400).json({ error: "Address required" });
  }

  try {
    const result = await addresses.insertOne(property);
    res.json({ _id: result.insertedId, ...property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete one address
app.delete("/api/address/:id", async (req, res) => {
  try {
    const result = await addresses.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all addresses
app.delete("/api/address", async (req, res) => {
  try {
    await addresses.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all addresses
app.get("/api/address", async (req, res) => {
  try {
    const list = await addresses.find().toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geocode address (OpenStreetMap)
app.get("/api/geocode/:id", async (req, res) => {
  try {
    const doc = await addresses.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Address not found" });

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      doc.address
    )}`;
    const geoRes = await axios.get(url);

    res.json({ address: doc.address, geocode: geoRes.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Use Render’s assigned port or fallback for local development
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
