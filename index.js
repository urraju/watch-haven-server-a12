const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.STRIP_SECRET);
const port = process.env.PORT || 2000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zrkwx23.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("watchDB").collection("users");
    const watchCollection = client.db("watchDB").collection("watch");
    const reviewCollection = client.db("watchDB").collection("review");
    const reportCollection = client.db("watchDB").collection("report");
    const postedCollection = client.db("watchDB").collection("postProduct");
    const paymantCollection = client.db("watchDB").collection("paymants");
    const couponCollection = client.db("watchDB").collection("coupon");

    // user part

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewerrs part
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      if (!token) {
        return res.status(401).send({ message: "forbidden access" });
      }

      jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        // console.log(decoded);
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === "admin";
      console.log(isAdmin);
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isModerator = user?.mode === "moderator";
      if (!isModerator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user part

    app.delete(
      "/users/:id",
      verifyToken,
      verifyAdmin,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      }
    );

    // make admin part
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // make moderator part
    app.put("/users/mode/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          mode: "moderator",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // review part

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    // make admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unathorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user.role === "admin";
      }
      res.send({ admin });
    });
    // make moderator
    app.get("/users/moderator/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unathorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let moderator = false;
      if (user) {
        moderator = user.mode === "moderator";
      }
      res.send({ moderator });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email is user doenst exist : part

      // const query = { email: user.email };
      // const existingUser = await userCollection.findOne(query);
      // if (existingUser) {
      //   return res.send({ Message: "user already Exisit", insertedId: null });
      // }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const query = req.body;
      const result = await reviewCollection.insertOne(query);
      res.send(result);
    });
    app.get("/review", verifyToken, async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    // review status reject or accepted part
    app.patch("/review/status2/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status2: "accepted",
        },
      };
      const result = await reviewCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.put("/review/status3/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status3: "rejected",
        },
      };
      const result = await reviewCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // report part data get post
    app.post("/report", async (req, res) => {
      const query = req.body;
      const result = await reportCollection.insertOne(query);
      res.send(result);
    });
    app.get("/report", verifyToken, verifyModerator, async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result);
    });
    app.delete(
      "/report/:id",
      verifyToken,
      verifyModerator,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await reportCollection.deleteOne(filter);
        res.send({ result, deleted });
      }
    );

    // posted data part
    app.post("/postProduct", async (req, res) => {
      const query = req.body;
      const result = await postedCollection.insertOne(query);
      res.send(result);
    });
    app.get("/postProduct/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await postedCollection.findOne(filter);
      console.log(result);
      res.send(result);
    });
    app.get("/postProduct", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { owner_email: req.query.email };
      }

      const result = await postedCollection.find(query).toArray();
      res.send(result);
    });

    // post data update function

    app.put("/postProduct/updateProduct/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const body = req.body;
      const updatedDoc = {
        $set: {
          product_name: body.product_name,
          product_image: body.product_image,
          description: body.description,
          external_links: body.external_links,
          tags: body.tags,
        },
      };
      const result = await postedCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.patch("/postProduct/status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "accepted",
        },
      };
      const result = await postedCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.put("/postProduct/status2/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status2: "rejected",
        },
      };
      const result = await postedCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // add features product
    app.put("/postProduct/addFeature/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          featured: true,
        },
      };
      const result = await postedCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // delete function

    app.delete("/postProduct/:id", async (req, res) => {
      const id = req.params.id;
      console.log("deleted", id);
      const query = { _id: new ObjectId(id) };
      const result = await postedCollection.deleteOne(query);
      res.send(result);
    });

    // paymant api
    app.post("/paymants", async (req, res) => {
      const query = req.body;
      const result = await paymantCollection.insertOne(query);
      res.send(result);
    });
    app.get("/paymants", async (req, res) => {
      const result = await paymantCollection.find().toArray();
      res.send(result);
    });

    // payment intent part
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price) * 100;
      console.log(amount, "price inside the intant");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // couponCollection part
    app.post("/coupon", async (req, res) => {
      const query = req.body;
      const result = await couponCollection.insertOne(query);
      res.send(result);
    });
    app.get("/coupon", async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });
    app.get("/coupon/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await couponCollection.findOne(filter);
      console.log(result);
      res.send(result);
    });
    app.get("/getcoupon", async (req, res) => {
      console.log(req.query);
      const coupon = req.query.code;
      const filter = { coupon_code: coupon };
      console.log("filter", filter);
      const result = await couponCollection.find(filter).toArray();
      console.log(result);
      res.send(result);
    });
    app.delete("/coupon/:id", async (req, res) => {
      const id = req.params.id;
      console.log("deleted", id);
      const query = { _id: new ObjectId(id) };
      const result = await couponCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/coupon/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const body = req.body;
      const updatedDoc = {
        $set: {
          coupon_code: body.coupon_code,
          expire_date: body.coupon_date,
          code_description: body.code_description,
          discount_amount: body.discount_amount,
        },
      };
      const result = await couponCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //  all data load part

    app.get("/watch", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const filter = req.query;
      console.log(filter);
      const query = {
        tags: { $regex: filter.search || "" },
      };
      const result = await watchCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    app.post("/watch", async (req, res) => {
      const query = req.body;
      const result = await watchCollection.insertOne(query);
      res.send(result);
    });
    app.get("/watchCount", async (req, res) => {
      const count = await watchCollection.estimatedDocumentCount();
      res.send({ count });
    });
    app.get("/watch/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const result = await watchCollection.findOne(filter);
      console.log(result);
      res.send(result);
    });
    app.patch("/watch/update", async (req, res) => {
      const id = req.query.id;
      console.log(id);
      const filter = { _id: id };

      const pathData = {
        $inc: {
          vote: +1,
        },
      };
      const result = await watchCollection.updateOne(filter, pathData);
      console.log(result);
      res.send(result);
    });
    app.put("/watch/updateVote", async (req, res) => {
      const id = req.query.id2;
      console.log(id);
      const filter = { _id: id };

      const pathData = {
        $inc: {
          vote: +1,
        },
      };
      const result = await watchCollection.updateOne(filter, pathData);
      console.log(result);
      res.send(result);
    });

    // status or analytics
    app.get("/admin-status", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const product = await watchCollection.estimatedDocumentCount();
      const post = await postedCollection.estimatedDocumentCount();
      const review = await reviewCollection.estimatedDocumentCount();

      res.send({ users, product, post, review });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Server is Running");
});
app.listen(port, () => {
  console.log("Server is Running on PORT ||", port);
});
