const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");
const path = require("path");
const ExpressError = require("./utils/ExpressError");


const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));


app.use(session({ secret: process.env.JWT_SECRET, resave: true, saveUninitialized: true }));
console.log(__dirname);
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "src")));
app.use(express.static(path.join(__dirname, "assets")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

const userRoutes = require("./modules/user"); // Import the user routes
const gamesManagerRoutes = require("./modules/gamesManager"); // Import the games manager routes
const gameRoutes = require("./modules/game"); // Import the games manager routes


app.use("/", userRoutes);
app.use("/", gamesManagerRoutes);
app.use("/", gameRoutes);

//production script
app.use(express.static("./client/build"));

app.all("*", (req, res, next) => {
    next(new ExpressError("Page not found", 404));
});

app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Sorry, Something went wrong" } = err;
    res.status(statusCode).render("error",{statusCode, message});
    console.error(statusCode);
    next(err);
});


module.exports = app;