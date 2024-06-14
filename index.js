const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

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


    // JWT related API => 01
    app.post('/jwt', async(req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({token});
    })

    // middlewares => 02
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verify token => 03
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'Admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next()
    }


    
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
        } else {
          // if existing user login again
          return res.send(isExist)
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

    // get a user info by email from DB (role)
    app.get('/user/:email', async(req, res) => {
      const email = req.params.email
      const result = await usersCollection.findOne({email})
      res.send(result)
    })


    // get all users data from DB => 02
    app.get('/users', verifyToken, verifyAdmin, async(req, res) =>{
      // console.log(req.headers);
      const result = await usersCollection.find().toArray()
      res.send(result)    
    })

    app.get('/users/admin/:email', verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !==  req.decoded.email) {
        return res.status(403).send({message: 'forbidden access'})
      }

      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let admin = false
      if(user){
        admin = user?.role === 'Admin';
      }
      res.send({ Admin: admin })
    })

    // update a user role
    app.patch('/users/update/:email', async(req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: {
          ...user, 
          timestamp: Date.now(),
        },
      }
      const result = await usersCollection.updateOne(query, updateDoc)
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
