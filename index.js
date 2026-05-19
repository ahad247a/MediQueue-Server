const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
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
   
    await client.connect();
    
    const database = client.db("mediQueueDB");
    const tutorsCollection = database.collection("tutors");
    const bookingsCollection = database.collection("bookings");

    console.log("Pinged your deployment. You successfully connected to MongoDB!");

   

    
    app.get('/', (req, res) => {
        res.send('আমাদের এক্সপ্রেস সার্ভার সফলভাবে রান করছে!');
    });

    app.get('/featured-tutors', async (req, res) => {
      try {
        const result = await tutorsCollection.find().limit(6).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching featured tutors:", error);
        res.status(500).send({ message: "Server Error" });
      }
    });


    app.get('/api/tutors', async (req, res) => {
      try {
        const result = await tutorsCollection.find({}).sort({ _id: -1 }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching all tutors:", error);
        res.status(500).send({ error: "Failed to fetch tutors" });
      }
    });


    app.get('/api/tutors/:id', async (req, res) => {
      try {
        const id = req.params.id;
        
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

    
    app.post('/api/my-tutors', async (req, res) => {
      try {
        const tutorData = req.body;
        const email = req.query.email;

        if (email && !tutorData.tutorEmail) {
          tutorData.tutorEmail = email;
        }

        const result = await tutorsCollection.insertOne(tutorData);
        
        res.status(201).send({
          success: true,
          message: "Tutor added successfully!",
          insertedId: result.insertedId
        });
      } catch (error) {
        console.error("Error adding new tutor:", error);
        res.status(500).send({ error: "Failed to add tutor" });
      }
    });

    
    app.get('/api/my-tutors', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ error: "Email query parameter is required" });
        }

        const query = { tutorEmail: email };
        const result = await tutorsCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching my-tutors:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    
    app.delete('/api/tutors/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await tutorsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({ success: true, message: "Tutor slot deleted successfully!" });
        } else {
          res.status(404).send({ error: "Tutor not found" });
        }
      } catch (error) {
        console.error("Error deleting tutor:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    
    app.patch('/api/tutors/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        
        if (updatedData.hourlyFee) updatedData.hourlyFee = Number(updatedData.hourlyFee);
        if (updatedData.totalSlot) updatedData.totalSlot = Number(updatedData.totalSlot);

        const updateDoc = {
          $set: updatedData
        };

        const result = await tutorsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Tutor not found" });
        }

        res.send({ success: true, message: "Tutor information updated successfully!", result });
      } catch (error) {
        console.error("Error updating tutor:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });


    
    app.post('/api/bookings', async (req, res) => {
      try {
        const { studentName, phone, tutorId, tutorName, studentEmail } = req.body;

      
        if (!ObjectId.isValid(tutorId)) {
          return res.status(400).send({ error: "Invalid Tutor ID format" });
        }

        const tutorQuery = { _id: new ObjectId(tutorId) };
        const tutor = await tutorsCollection.findOne(tutorQuery);

        if (!tutor) {
          return res.status(404).send({ error: "Tutor not found" });
        }

        const slotFieldName = tutor.totalSlot !== undefined ? "totalSlot" : "slots";
        const currentSlots = tutor[slotFieldName] || 0;

        if (currentSlots <= 0) {
          return res.status(400).send({ error: "This session is fully booked." });
        }

        if (tutor.sessionDate) {
          const currentDate = new Date();
          const sessionDate = new Date(tutor.sessionDate);
          
          if (currentDate < sessionDate) {
            return res.status(400).send({ error: "Booking is not available yet" });
          }
        }

      
        const bookingData = {
          studentName,
          phone,
          tutorId: new ObjectId(tutorId),
          tutorName,
          studentEmail,
          bookStatus: "Confirmed",
          createdAt: new Date()
        };

        
        const bookingResult = await bookingsCollection.insertOne(bookingData);

        
        await tutorsCollection.updateOne(
          tutorQuery,
          { $inc: { [slotFieldName]: -1 } } 
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


    
    app.get('/api/bookings', async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ error: "Student email query parameter is required" });
        }

        const query = { studentEmail: email };
        const result = await bookingsCollection.find(query).sort({ createdAt: -1 }).toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching my bookings:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });


    app.patch('/api/bookings/cancel/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid Booking ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { bookStatus: "cancelled" }
        };

        const result = await bookingsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Booking not found" });
        }

        res.send({ success: true, message: "Booking cancelled successfully!" });
      } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });



    app.listen(PORT, () => {
        console.log(`server runnig this link : http://localhost:${PORT}`);
    });

  } catch (error) {
    console.log("Database initialization error:", error);
  }
}

run().catch(console.dir);