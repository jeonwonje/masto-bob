import express from 'express';
import session from 'express-session';
import Mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv'

import { login } from 'masto';

const masto = await login({
  url: 'https://tinkertofu.com',
  accessToken: process.env.APIKEY,
});

const app = express();
const port = 3000;
const sessionKey = randomBytes(32).toString('hex');

dotenv.config()

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: sessionKey,
    resave: false,
    saveUninitialized: false,
  })
);

// dbPasword is in env var for now...
Mongoose.connect(
  process.env.DB_STRING,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
  .then(() => {
    console.log('Connected to mongodb');
  })
  .catch((err) => {
    console.log('Error connecting to mongodb', err);
  });

const trainerSchema = new Mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    apikey: { type: String, required: true },
  },
  { collection: 'trainers' }
);

const Trainer = Mongoose.model('Trainer', trainerSchema);

app.get('/', (req, res) => {
  res.send("Welcome to tinkertofu's submission tracker.");
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  // Would be nice to split this into routes
  const { email, password, name, apikey, admin } = req.body;
  if (admin == 'wonnie') {
    const existingTrainer = await Trainer.findOne({ email });

    if (existingTrainer) {
      return res.status(400).send('Email already exists');
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new trainer object
      const newTrainer = new Trainer({
        email,
        password: hashedPassword,
        name,
        apikey,
      });

      await newTrainer.save();
      res.status(201).send('Trainer registered successfully');
    }
    // Send a response indicating success
  } else {
    res.status(400).send('You are not the admin bruh');
  }
});

app.get('/login', (req, res) => {
  res.render('login');
  //  res.send("hello world, this is my default page");
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const trainer = await Trainer.findOne({ email });
  const validPassword = await bcrypt.compare(password, trainer.password);

  if (!validPassword) {
    return res.status(400).send('Error!');
  } else {
    // Save the user ID in the session
    //const trainer = await Trainer.findOne({ email });
    req.session.userId = trainer._id;
    // Add a line to create a mastodon instance using APIKEY
    res.redirect('/dashboard');
  }
});

app.get('/dashboard', async (req, res) => {
  const userId = req.session.userId;

  // Check if the user is logged in
  if (!userId) {
    return res.redirect('/login');
  }

  // Find the user in the database
  const trainer = await Trainer.findById(userId);
  if (!trainer) {
    return res.status(400).send('Invalid trainer');
  }

  const data = ['hello', 'metoo'];
  res.render('dashboard', { trainer, data });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

app.listen(port, () => {
  console.log(`example app listening on ${port}`);
});