const express = require("express")
var bodyParser = require('body-parser')
const authRoutes = require("./routes/authentication");
const musicRoutes = require("./routes/music");
let app = express();
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false, parameterLimit: 50000 }))
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('src'));
const PORT = process.env.PORT || 3000
var server = app.listen(PORT || 3000, function () {
    console.log("listening on port number %d", server.address().port);
});
app.get('/', (req, res) => res.sendStatus(200));
app.use("/auth", authRoutes);
app.use("/music", musicRoutes);