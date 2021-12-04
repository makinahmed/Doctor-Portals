const { MongoClient } = require('mongodb');
const express = require('express')
const app = express()
const admin = require("firebase-admin");
require("dotenv").config();
const port = process.env.PORT || 5000;
const ObjectId = require('mongodb').ObjectId;
const cors = require('cors')
app.use(express.json())
app.use(cors())
const stripe = require("stripe")(process.env.STRIPE_SECREAT)

const serviceAccount = require("./doctors-portal-adminSdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m8c0v.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req?.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        } catch {

        }
    }
    next()
}


async function run() {
    try {
        await client.connect();
        const database = client.db("doctors_portal");
        const appoinmentsCollection = database.collection("appoinments");
        const usersCollection = database.collection('users')

        app.get('/appoinments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, bookingTime: date };
            const cursor = appoinmentsCollection.find(query);
            const appoinments = await cursor.toArray();
            // console.log(date);
            res.json(appoinments)
        })


        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await appoinmentsCollection.findOne(query)
            res.json(result)
        })

        app.post('/appoinments', async (req, res) => {
            const appoinment = req.body;
            const result = await appoinmentsCollection.insertOne(appoinment)
            console.log(result);
            res.json(result)

        })


        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc = { $set: { payment: payment } }
            const result = await appoinmentsCollection.updateOne(filter, updateDoc)
            res.json(result)

        })

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })
        })

        app.post('/users', async (req, res) => {
            const users = req.body;
            const result = await usersCollection.insertOne(users)
            console.log(result);
            res.json(result)

        })


        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email }
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result)
        })

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester })
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } }
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: 'You do not have access as an admin!' })
            }

        })

        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body.price;
            const amount = paymentInfo * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            })
            res.json({ clientSecret: paymentIntent.client_secret })
        })



    } finally {
        // await client.close();
    }
}

run().catch(console.dir);








app.get('/', (req, res) => {
    res.send("Hello World")
})


app.listen(port, () => {
    console.log("App is running in ", port);
})



