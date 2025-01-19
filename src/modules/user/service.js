const User = require("./model");
const bcrypt = require("bcrypt");


exports.findUser = async (username, password) => {
    const foundUser = await User.authenticate(username, password);
    if (foundUser) {
        return foundUser;
    }
    return null;
};

exports.registerNewUser = async (username, password) => {
    const hash = await bcrypt.hash(password, 12);
    const user = new User({
        username,
        password: hash
    });
    await user.save();
    return user;
};

/*
app.get('/login', (req, res) => {
    const { f } = req.query;
    let errorMessage = ""
    if (f == "error") {
        errorMessage = "Wrong username or password"
    }
    let username = req.session.user_name || "Guest"
    const game = { username: "" }
    res.render("login", { errorMessage, game, username })
})

app.post('/login', async (req, res) => {

    const { username, password } = req.body;
    const foundUser = await User.authenticate(username, password)
    if (foundUser) {
        req.session.user_id = foundUser._id;
        req.session.user_name = foundUser.username;
        res.redirect('/lobby')
    }
    else {
        console.log("login failed")
        res.redirect('/login?f=error')
    }
});

*/