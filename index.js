const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
// const cookieParser = require('cookie-parser')
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


    
    // Get all pets from db
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

    // Get a single pets data
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
