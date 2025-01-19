
const userService = require("./service");

exports.showLoginPage = async (req, res) => {

    console.log("showLoginPage");
    const { f } = req.query;
    let errorMessage = "";
    if (f == "error") {
        errorMessage = "Wrong username or password";
    }
    const username = req.session.user_name || "Guest";
    const game = { username: "" };
    res.render("login", { errorMessage, game, username });
};

exports.logout = async (req, res) => {
    req.session.user_id = null;
    req.session.destroy();
    res.redirect('/login'); // or home
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await userService.findUser(username, password);
    if (foundUser) {
        console.log("user authenticated");
        req.session.user_id = foundUser._id;
        req.session.user_name = foundUser.username;
        res.redirect('/lobby');
    }
    else {
        console.log("login failed");
        res.redirect('/login?f=error');
    }
};

exports.showRegistrationPage = async (req, res) => {
    res.render('register');
};

exports.register = async (req, res) => {
    const { username, password } = req.body;
    const user = await userService.registerNewUser(username, password);
    req.session.user_id = user._id;
    req.session.user_name = username;
    res.redirect('/lobby');
};