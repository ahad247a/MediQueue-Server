const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const database = client.db("mediQueueDB");
    const tutorsCollection = database.collection("tutors");

    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // হোম পেইজের জন্য সর্বোচ্চ ৬টি টিউটর ডেটা ফেচ করার এপিআই
    app.get('/featured-tutors', async (req, res) => {
      try {
        const result = await tutorsCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching featured tutors:", error);
        res.status(500).send({ message: "Server Error" });
      }
    });

  } catch (error) {
    console.error("Database error:", error);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('আমাদের এক্সপ্রেস সার্ভার সফলভাবে রান করছে!');
});

app.listen(PORT, () => {
    console.log(`সার্ভার চলছে এই লিঙ্কে: http://localhost:${PORT}`);
});