const express = require("express");
const session = require("express-session");
const path = require("path");
const app = express();

app.set("view engine", 'ejs');
app.set("views", path.join(__dirname, "/views"));


app.use(session({ secret: 'notagoodsecret', resave: true, saveUninitialized: true }));
console.log(__dirname);
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const userRoutes = require("./modules/user"); // Import the user routes
const gamesManagerRoutes = require("./modules/gamesManager"); // Import the games manager routes
const gameRoutes = require("./modules/game"); // Import the games manager routes
app.use("/", userRoutes);
app.use("/", gamesManagerRoutes);
app.use("/", gameRoutes);

//production script
app.use(express.static("./client/build"));
app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});


module.exports = app;