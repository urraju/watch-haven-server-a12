const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express')
require('dotenv').config()
const cors = require('cors');
const jwt = require('jsonwebtoken')
const app = express();
const stripe = require('stripe')(process.env.STRIP_SECRET)
const port = process.env.PORT || 2000

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrkwx23.mongodb.net/?retryWrites=true&w=majority`
 
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
     
    const   userCollection = client.db('watchDB').collection('users')
    const  watchCollection = client.db('watchDB').collection('watch')
     

    // user part 

    app.post('/jwt', async(req,res) => {
        const user = req.body
        const token = jwt.sign(user, process.env.SECRET_TOKEN, {expiresIn : '1h'})
        res.send({token})
      })
      
      // middlewerrs part 
      const verifyToken = (req,res,next) => {
        console.log('inside verify token', req.headers.authorization);
        if(!req.headers.authorization){
          return res.status(401).send({message : 'forbidden access'})
        }
        const token = req.headers.authorization.split(' ')[1]
        if(!token){
          return res.status(401).send({message : 'forbidden access'})
        }
         
        jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
          if(error){
            return res.status(401).send({message : 'forbidden access'})
  
          }
          req.decoded = decoded
          next()
        })
      }
  
      const verifyAdmin = async (req,res, next)=> {
        const email = req.decoded.email
        const query = {email : email};
        const user = await userCollection.findOne(query)
        const isAdmin = user?.role === 'admin'
        if(!isAdmin){
          return res.status(403).send({message : 'forbidden access'})
        }
        next()
      }
  
      // user part 
     
      app.delete('/users/:id', verifyToken,verifyAdmin, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await userCollection.deleteOne(query);
        res.send(result);
      })
  
      app.patch('/users/admin/:id', async(req,res) => {
        const id = req.params.id
        const filter = {_id: new ObjectId(id)}
        const updatedDoc = {
          $set : {
            role : 'admin'
          }
        }
        const result = await userCollection.updateOne(filter,updatedDoc)
        res.send(result)
      })
      
      app.get('/users', verifyToken, verifyAdmin,async(req,res) => {
         console.log(req.headers);
        const result = await userCollection.find().toArray()
        res.send(result)
      })
      app.get('/users/admin/:email', verifyToken, async(req,res) => {
        const email = req.params.email
        if(email !== req.decoded.email){
          return res.status(403).send({message : 'unathorized access'})
        }
        const query = {email : email}
        const user = await userCollection.findOne(query)
        let admin = false
        if(user){
          admin = user.role === 'admin'
        }
        res.send({admin})
      })
      app.post('/users', async(req,res) => {
        const user = req.body
        // insert email is user doenst exist : part
  
        const query = {email : user.email}
        const existingUser = await userCollection.findOne(query)
        if(existingUser) {
          return res.send({Message : 'user already Exisit', insertedId :  null})
        }
  
  
        const result = await userCollection.insertOne(user)
        res.send(result)
      })



    app.get('/watch', async(req,res) => {
        const result = await watchCollection.find().toArray()
         
        res.send(result)
    })
    app.patch('/update', async (req, res) => {
        const id = req.query.id;
        console.log(id);
        const filter = {
            _id: new ObjectId(id)
        }
         
       
        const pathData = {
            $inc: {
                 vote:  + 1
            }
        };
        const result = await watchCollection.updateOne(filter, pathData);
        res.send(result)
    })
   
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
  }
}
run().catch(console.dir);




app.get('/', async(req,res) => {
    res.send('Server is Running')
})
app.listen(port , () => {
    console.log('Server is Running on PORT ||', port);
})