//const Game = require('./models/game');
const Game = require("../modules/game/model");
require("dotenv").config();  // Load environment variables

class Database {

  static #mongoose = require("mongoose");


  constructor() {

  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  connect() {
    //Database.#mongoose.connect('mongodb://127.0.0.1:27017/chess')
    Database.#mongoose.connect(process.env.DATABASE_URL)

      .then(async () => {
        console.log("db connected");
        //  await Game.deleteMany({})

      })

      .catch(() => {
        console.log("error connecting to db");
      });

  }
}

module.exports = { Database, Game };