const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
// const jwt = require('jsonwebtoken')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173',
    
  ],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m0qpfuk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {

    /******* *******/


    // connection 
    const petsCollection = client.db('Petco').collection('pets');
    const usersCollection = client.db('Petco').collection('users');


    
    // Save user data in DB => DashBoard Admin => 01
    app.put('/user', async (req, res)=> {
      const user = req.body
      const query = { email: user?.email }
      // check if user already exists in DB
      const isExist = await usersCollection.findOne({email: user?.email})
      if(isExist) {
        if(user?.status === 'Requested') {
          const result = await usersCollection.updateOne(query, {
            $set: { status: user?.status },
          })
          return res.send(result)
        }
      } 

        // save user for the first time
      const options = { upsert: true }
      // const query = { email: user?.email }
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    // get all users data from DB => 02
    app.get('/users', async(req, res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result)    
    })

    
    // Get all pets from db => 01
    app.get('/pets', async (req, res) => {
      const category = req.query.category
      console.log(category)
      let query = {}
      if(category && category !== 'null') {
        query = {category: category}
      }
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    })

   


    // Save a pet data in DB => 03
    app.post('/pet', async(req, res) => {
      const petData = req.body
      const result = await petsCollection.insertOne(petData)
      res.send(result)
    })

    // get all pet for User => 04
    app.get('/my-pets/:email', async (req, res) => {
      const email =  req.params.email

      let query = {'User.email': email}
      
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    })

    // delete a pet => 05
    app.delete('/pet/:id', async (req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await petsCollection.deleteOne(query)
      res.send(result)
    })


    // Get a single pets data from DB using _id => 02
    app.get('/pet/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await petsCollection.findOne(query)
      res.send(result);
    })






       /******* *******/

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from Petco Server..')
})

app.listen(port, () => {
  console.log(`Petco is running on port ${port}`)
})
