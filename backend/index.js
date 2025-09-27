import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = 'mongodb+srv://Nirwan_a:Nirwan%4012@cluster0.dedlzm0.mongodb.net/GeoCortex?retryWrites=true&w=majority&tlsInsecure=true';
const dbName = 'GeoCortex';
const collectionName = 'addresses';

let db, addresses;

MongoClient.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(client => {
    db = client.db(dbName);
    addresses = db.collection(collectionName);
    console.log('Connected to MongoDB Atlas');
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Add address
app.post('/api/address', async (req, res) => {
  const property = req.body;
  console.log('Received property:', JSON.stringify(property, null, 2));
  if (!property.address && !property["Lot Number / Address"]) {
    return res.status(400).json({ error: 'Address required' });
  }
  try {
    const result = await addresses.insertOne(property);
    res.json({ _id: result.insertedId, ...property });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove address
app.delete('/api/address/:id', async (req, res) => {
  try {
    const result = await addresses.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List addresses

// Clear all addresses (for reset)
app.delete('/api/address', async (req, res) => {
  try {
    await addresses.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/address', async (req, res) => {
  try {
    const list = await addresses.find().toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Geocode address (using OpenStreetMap Nominatim)
app.get('/api/geocode/:id', async (req, res) => {
  try {
    const doc = await addresses.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Address not found' });
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(doc.address)}`;
    const geoRes = await axios.get(url);
    res.json({ address: doc.address, geocode: geoRes.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
