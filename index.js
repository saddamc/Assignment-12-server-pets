const express = require('express')
const app = express()
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://assignment-pets.web.app',
    'https://assignment-pets.firebaseapp.com'  
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
    const campaignsCollection = client.db('Petco').collection('campaigns');
    const donationsCollection = client.db('Petco').collection('donations');
    const paymentCollection = client.db('Petco').collection('payments');
    

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
    app.get('/user/:email', verifyToken, async(req, res) => {
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
    app.patch('/users/update/:email', verifyToken, async(req, res) => {
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

    // update Pet data
    app.put('/pet/update/:id', verifyToken,  async (req, res) => {
      const id = req.params.id
      const petData = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: petData,
      }
      const result = await petsCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    
    // Get all pets from db => 01
    app.get('/pets',  async (req, res) => {
      const category = req.query.category
      console.log(category)
      let query = {}
      if(category && category !== 'null') {
        query = {category: category}
      }
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    })

      // Get all pets for Manage Pets  => 02
      app.get('/all-pets', verifyToken, verifyAdmin, async (req, res) => {
        const query = req.body
        const result = await petsCollection.find(query).toArray();
        res.send(result);
      })

   


    // Save a pet data in DB => 03
    app.post('/pet', verifyToken, async(req, res) => {
      const petData = req.body
      const result = await petsCollection.insertOne(petData)
      res.send(result)
    })

    // get all pet for User => 04
    app.get('/my-pets/:email',  async (req, res) => {
      const email =  req.params.email

      let query = {'User.email': email}
      
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    })

    

    // delete a pet => 05
    app.delete('/pet/:id', verifyToken, async (req, res) =>{
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

    // get all pet for Adopt => 01
    app.get('/adopt/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await petsCollection.findOne(query)
      res.send(result);
    })

    // adopt pet in DB => 02
    app.patch('/adopt/:id', async (req, res) => {
      const id = req.params.id
      const adoptData = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: adoptData,
      }
      const result = await petsCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // my Adopt list show  => 03
    app.get('/my-adopt/:email', verifyToken, async (req, res) => {
      const email =  req.params.email

      let query = {'adopter.email': email}
      
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    })
    

    // delete my-pet data => 04
    app.delete('/my-pet/:id', verifyToken, async (req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $unset: { adopter: "", status: ""},
      }
      const result = await petsCollection.updateOne(query, updateDoc) 
      res.send(result)
    })  

        // Create campaign  => 01
    app.post('/campaign', verifyToken, async(req, res) => {
      const petData = req.body
      const result = await campaignsCollection.insertOne(petData)
      res.send(result)
    })  

    // get Campaign => 02
    app.get('/my-campaign/:email',  async (req, res) => {
      const email =  req.params.email

      let query = {'User.email': email}     
      
      const result = await campaignsCollection.find(query).toArray();
      res.send(result);
    })
    
    // delete a Campaign => 03
    app.delete('/my-campaign/:id', verifyToken, async (req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await campaignsCollection.deleteOne(query)
      res.send(result)
    })
    
    // Get a single Campaign data from DB using _id => 04
    app.get('/campaign/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await campaignsCollection.findOne(query)
      res.send(result);
    })

    // campaign Pet data => 05
    app.put('/campaign/update/:id', verifyToken,  async (req, res) => {
      const id = req.params.id
      const petData = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: petData,
      }
      const result = await campaignsCollection.updateOne(query, updateDoc)
      res.send(result)
    })

     // Get all pets for Manage Pets  => 02
     app.get('/all-campaign', verifyToken, async (req, res) => {
      const query = req.body
      const result = await campaignsCollection.find(query).toArray();
      res.send(result);
    })

    
      // Create Donation => 01
      app.post('/donation', verifyToken, async(req, res) => {
        const donateData = req.body
        const result = await donationsCollection.insertOne(donateData)
        res.send(result)
      })

      // get Donation => 02
    app.get('/my-donation/:email',  async (req, res) => {   
      const email =  req.params.email

      let query = {'User.email': email}
      
      const result = await donationsCollection.find(query).toArray();
      res.send(result);
    })

    // delete a Donation => 03
    app.delete('/my-donation/:id', async (req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await donationsCollection.deleteOne(query)
      res.send(result)
    })

    // stats
    // app.get('/admin-stats', async(req, res) => {
    //   const campaign = await campaignsCollection.estimatedDocumentCount();
    //   const payment = await paymentCollection.estimatedDocumentCount();
    //   console.log(campaign)

    //   const donationProgress = await paymentCollection.aggregate([
    //     {
    //       $group: {
    //         _id: null,
    //         totalDonation: {
    //           $sum: '$payment'
    //         }

    //       }
    //     }
    //   ]).toArray();

    //   const donation = donationProgress.length > 0 ? donationProgress[0].totalDonation : 0;

    //   res.send({
    //     campaign,
    //     payment,
    //     donation
    //   })
    // })

    
    
    app.get('/progress-stats', async (req, res) => {
      try {
        const result = await paymentCollection.aggregate([
          {
            $unwind: '$campaignIds'
          },
          {
            $unwind: '$donateIds'
          },
          {
            $unwind: '$note'
          },
          // if ObjectId so need addFields
          {
            $addFields: {
              campaignIds: { $toObjectId: '$campaignIds' }
            }
          },
          {
            $lookup: {
              from: 'campaigns',
              localField: 'campaignIds',
              foreignField: '_id',
              as: 'campaignDetails'
            }
          },
          {
            $group: {
              _id: '$campaignDetails._id',
              quantity: {
                $sum: 1
              },
              totalDonate: {
                $sum: '$payment'
              },
            }
          },
          {
            $unwind: '$_id'
          },
          {
            $project: {
              _id: '$_id',
              // progressId: '$_id',
              quantity: '$quantity',
              totalDonate: '$totalDonate',
            }
          }


        ]).toArray();
        console.log(result); // Check the output here
        
    
        res.send(result);
      } catch (error) {
        console.error("Error in aggregation:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    
    

    



    // payment intent
    app.post('/create-payment-intent', async(req, res) => {
      const { donate } = req.body;
      const amount = parseInt(donate * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    }) 

    app.post('/payments', verifyToken, async  (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment)

      // carefully delete each item from the donation
      console.log('payment info', payment);

      const query = {_id: {
        $in: payment.donateIds.map( id => new ObjectId(id))
      }};
      const deleteResult = await donationsCollection.deleteMany(query);

      res.send({paymentResult, deleteResult})
    })

 
    

    // SSLCOMMERZ
    // app.post('/create-payment', async(req, res => {

    //   const paymentInfo = req.body

    //   console.log(paymentInfo)
      
    //   res.send(result)
    // }))






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
