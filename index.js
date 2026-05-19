const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
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
    const bookingsCollection = database.collection("bookings"); // 🌟 বুকিং ডাটা সেভ করার কালেকশন

    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // ১. হোম পেইজের জন্য সর্বোচ্চ ৬টি টিউটর ডেটা ফেচ করার এপিআই
    app.get('/featured-tutors', async (req, res) => {
      try {
        const result = await tutorsCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching featured tutors:", error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // 🎯 ২. সব টিউটর একসাথে নিয়ে আসার এক্সপ্রেস এপিআই (সব টিউটর পেজের জন্য)
    app.get('/api/tutors', async (req, res) => {
      try {
        const result = await tutorsCollection.find({}).sort({ _id: -1 }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching all tutors:", error);
        res.status(500).send({ error: "Failed to fetch tutors" });
      }
    });

    // 🎯 ৩. আইডি দিয়ে সুনির্দিষ্ট ১ জন টিউটরের ডিটেইলস বের করার এক্সপ্রেস এপিআই
    app.get('/api/tutors/:id', async (req, res) => {
      try {
        const id = req.params.id;
        
        // আইডি ফরম্যাট ভ্যালিড কি না চেক করা
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid ID format" });
        }
        
        const query = { _id: new ObjectId(id) };
        const result = await tutorsCollection.findOne(query);
        
        if (!result) {
          return res.status(404).send({ error: "Tutor not found" });
        }
        res.send(result);
      } catch (error) {
        console.error("Error fetching tutor details:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // 🎯 ৪. রিকোয়ারমেন্ট অনুসারে সেশন বুকিং করার এবং স্লট ১ কমানোর (Auto Decrease) এপিআই
    app.post('/api/bookings', async (req, res) => {
      try {
        const { studentName, phone, tutorId, tutorName, studentEmail } = req.body;

        // আইডি ফরম্যাট ভ্যালিড কি না চেক করা
        if (!ObjectId.isValid(tutorId)) {
          return res.status(400).send({ error: "Invalid Tutor ID format" });
        }

        // ডাটাবেজ থেকে টিউটরের বর্তমান স্লট এবং সেশনের ডেট খুঁজে বের করা
        const tutorQuery = { _id: new ObjectId(tutorId) };
        const tutor = await tutorsCollection.findOne(tutorQuery);

        if (!tutor) {
          return res.status(404).send({ error: "Tutor not found" });
        }

        // কন্ডিশন ১: টোটাল স্লট চেক করা (totalSlot = 0 হলে বুকিং ব্লক হবে)
        const totalSlot = tutor.totalSlot || tutor.slots || 0;
        if (totalSlot <= 0) {
          return res.status(400).send({ error: "This session is fully booked. You can’t join at the moment." });
        }

        // কন্ডিশন ২: সেশন ডেট রেস্ট্রিকশন চেক করা (আজকের তারিখ সেশন ডেটের আগে হলে বুকিং ব্লক হবে)
        if (tutor.sessionDate) {
          const currentDate = new Date();
          const sessionDate = new Date(tutor.sessionDate);
          
          if (currentDate < sessionDate) {
            return res.status(400).send({ error: "Booking is not available yet for this tutor" });
          }
        }

        // কন্ডিশন ৩: সেশন বুকিং ডাটা স্ট্রাকচার এবং অটো-জেনারেটেড বুক স্ট্যাটাস
        const bookingData = {
          studentName,
          phone,
          tutorId: new ObjectId(tutorId),
          tutorName,
          studentEmail,
          bookStatus: "Confirmed", // System auto-generated status
          createdAt: new Date()
        };

        // bookings কালেকশনে ডাটা ইনসার্ট করা
        const bookingResult = await bookingsCollection.insertOne(bookingData);

        // 🌟 কন্ডিশন ৪: সফল বুকিং শেষে টিউটরের totalSlot অটোমেটিকভাবে ১ কমিয়ে দেওয়া (Auto Decrease)
        await tutorsCollection.updateOne(
          tutorQuery,
          { $inc: { totalSlot: -1 } } // $inc: -1 ডাটাবেজের ভ্যালু ১ কমিয়ে দেয়
        );

        res.status(201).send({ 
          success: true, 
          message: "Booking completed successfully!", 
          bookingId: bookingResult.insertedId 
        });

      } catch (error) {
        console.error("Error processing booking:", error);
        res.status(500).send({ error: "Internal Server Error" });
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